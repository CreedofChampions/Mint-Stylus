/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        buildMcpContext (remote MCP context retrieval for the AI)
 * CVM-Role:        Utility (AIProvider helper)
 * Maintainer:      Mint Stylus
 * License:         GNU GPL v3
 *
 * Description:     Pulls RAG context from a remote Model Context Protocol (MCP)
 *                  server for a given query using the modern Streamable HTTP
 *                  transport (spec revision 2025-06-18). MAIN-PROCESS ONLY —
 *                  every HTTP call stays here; the renderer only ever receives
 *                  the returned text block plus a short status string. Uses the
 *                  global fetch; no Electron imports are required. This function
 *                  NEVER throws: on any failure it resolves with an empty block
 *                  and an "MCP error: …" status so the caller (and a "Test"
 *                  button) can surface a clear, visible state.
 *
 * END HEADER
 *
 * <!-- created by AI for Mint Stylus -->
 */

/**
 * The shape returned by {@link buildMcpContext}.
 *
 * - `block` is a ready-to-inject RAG text block (or '' if nothing was
 *   collected). When present it starts with a header naming the MCP server and
 *   the query, followed by the collected snippets, each labelled with its
 *   source (tool name or resource uri). It is bounded to `opts.maxChars`.
 * - `info` is a SHORT human-readable status string suitable for a "Test"
 *   button, e.g. `Connected — 3 tools, 2 resources; used tool "search"` or
 *   `MCP error: <message>`.
 */
export interface McpContextResult {
  block: string
  info: string
}

// Default cap on the assembled block length (characters).
const DEFAULT_MAX_CHARS = 6000

// Per-request network timeout. Bounds a single round-trip. SSE replies are
// read INCREMENTALLY (see readRpcMessage) so a server that legitimately holds
// the event-stream open after answering does NOT burn this budget — we return
// the moment the matching JSON-RPC message arrives.
const REQUEST_TIMEOUT_MS = 10000

// Total wall-clock budget for the ENTIRE buildMcpContext call. buildMcpContext
// issues up to ~9 sequential requests (initialize, initialized, tools/list,
// resources/list, up to 2 tools/call, up to 3 resources/read); a slow-but-
// responsive server that answers each just under the per-request timeout could
// otherwise stall the chat for minutes. One deadline computed at the top caps
// the whole chain regardless of round-trip count.
const TOTAL_BUDGET_MS = 25000

// Cap on any single collected snippet before it is placed into the block, so
// one huge tool/resource payload cannot dominate the whole context window.
const MAX_SNIPPET_CHARS = 2000

// How many matching tools / resources we will actually pull from.
const MAX_TOOLS = 2
const MAX_RESOURCES = 3

// The MCP protocol revision we speak. Advertised on initialize and echoed back
// by well-behaved servers.
const PROTOCOL_VERSION = '2025-06-18'

/**
 * Tool names / descriptions we consider "retrieval-shaped" and therefore worth
 * calling with the user's query. Kept deliberately broad — a search/query/docs
 * style tool is the whole point of pulling MCP context for RAG.
 */
const RETRIEVAL_TOOL_RE = /search|query|find|retrieve|lookup|context|ask|grep|docs?|read/i

/**
 * String argument names (in priority order) that plainly want the user's query
 * text. If a tool exposes a string property with one of these names we pass the
 * query into the FIRST such property.
 */
const QUERY_ARG_NAMES = [
  'query', 'q', 'question', 'input', 'text', 'prompt', 'search', 'keyword', 'term', 'path'
]

/**
 * A minimal JSON-RPC 2.0 result envelope. We treat every `result` as an
 * unknown-shaped record and narrow defensively at each use site rather than
 * trusting a remote server's payload.
 */
type JsonValue = unknown

/**
 * Minimal shape of a tool as returned by `tools/list`.
 */
interface McpTool {
  name: string
  description?: string
  inputSchema?: {
    type?: string
    properties?: Record<string, { type?: string, description?: string }>
    required?: string[]
  }
}

/**
 * Minimal shape of a resource as returned by `resources/list`.
 */
interface McpResource {
  uri: string
  name?: string
}

/**
 * Build the AbortSignal for a single request. It fires on the FIRST of:
 *   - the per-request timeout (REQUEST_TIMEOUT_MS),
 *   - the shared total-budget deadline (`deadline`, computed once per
 *     buildMcpContext call so the sum of sequential requests can never exceed
 *     TOTAL_BUDGET_MS), and
 *   - the caller-supplied `external` signal.
 *
 * Prefers AbortSignal.any (Node 20+/Electron 42) to combine them. If that is
 * unavailable we degrade gracefully to the shared deadline alone (which is the
 * one that bounds the whole call), or failing that the per-request timeout.
 */
function requestSignal (deadline: AbortSignal, external?: AbortSignal): AbortSignal {
  const perRequest = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const signals: AbortSignal[] = [ perRequest, deadline ]
  if (external !== undefined) {
    signals.push(external)
  }
  // AbortSignal.any is the clean combinator; guard in case the runtime lacks it.
  const anyFn = (AbortSignal as unknown as { any?: (signals: AbortSignal[]) => AbortSignal }).any
  if (typeof anyFn === 'function') {
    return anyFn(signals)
  }
  // Fallback: the shared deadline bounds the whole call, so prefer it.
  return deadline
}

/**
 * Parse one raw SSE event block into its concatenated `data:` payload (an event
 * may carry several `data:` lines, joined by newlines). Returns '' if the event
 * has no data lines.
 */
function sseEventData (rawEvent: string): string {
  const dataLines: string[] = []
  for (const line of rawEvent.split(/\r?\n/)) {
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).replace(/^ /, ''))
    }
  }
  return dataLines.join('\n').trim()
}

/**
 * Try to interpret an SSE data payload as the JSON-RPC message we want.
 * Returns { done: true, msg } to stop, { done: false, fallback } to keep
 * scanning while remembering a response-shaped fallback.
 */
function matchSsePayload (
  payload: string,
  wantId: number
): { done: true, msg: Record<string, JsonValue> } | { done: false, fallback?: Record<string, JsonValue> } {
  if (payload.length === 0) {
    return { done: false }
  }
  try {
    const msg = JSON.parse(payload) as Record<string, JsonValue>
    if (msg !== null && typeof msg === 'object') {
      if (msg.id === wantId) {
        return { done: true, msg }
      }
      // Remember any response-shaped message as a loose fallback for servers
      // that echo a differently-typed id.
      if ('result' in msg || 'error' in msg) {
        return { done: false, fallback: msg }
      }
    }
  } catch {
    // Skip malformed SSE data payloads.
  }
  return { done: false }
}

/**
 * Read a `text/event-stream` body INCREMENTALLY and return the JSON-RPC message
 * matching `wantId` (or a response-shaped fallback) the instant it arrives.
 *
 * This is critical: a spec-compliant MCP Streamable-HTTP server may keep the
 * event stream OPEN after emitting the JSON-RPC result (so it can later push
 * server→client messages). Reading the whole body with res.text() would then
 * block until the stream closes — burning the entire timeout even though the
 * server answered in milliseconds. Instead we pull chunks from res.body,
 * decode incrementally, split complete SSE events on a blank line as they
 * arrive, and RETURN (cancelling the reader to release the socket) as soon as
 * we have our message.
 */
async function readSseStream (
  body: ReadableStream<Uint8Array>,
  wantId: number
): Promise<Record<string, JsonValue> | undefined> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fallback: Record<string, JsonValue> | undefined

  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (value !== undefined) {
        buffer += decoder.decode(value, { stream: true })
      }

      // Drain every COMPLETE event (terminated by a blank line) currently in
      // the buffer, keeping the trailing partial event for the next chunk.
      let sep = buffer.search(/\r?\n\r?\n/)
      while (sep !== -1) {
        const rawEvent = buffer.slice(0, sep)
        buffer = buffer.slice(sep).replace(/^\r?\n\r?\n/, '')
        const result = matchSsePayload(sseEventData(rawEvent), wantId)
        if (result.done) {
          return result.msg
        }
        if (result.fallback !== undefined) {
          fallback = result.fallback
        }
        sep = buffer.search(/\r?\n\r?\n/)
      }

      if (done) {
        break
      }
    }

    // Stream closed: try any trailing event that lacked a terminating blank
    // line, then fall back.
    const tail = matchSsePayload(sseEventData(buffer), wantId)
    if (tail.done) {
      return tail.msg
    }
    return tail.fallback ?? fallback
  } finally {
    // Release the socket. If the server is holding the stream open, this stops
    // us waiting on it. cancel() can reject on an already-errored stream — ignore.
    await reader.cancel().catch(() => undefined)
  }
}

/**
 * Parse a Streamable-HTTP response body into the single JSON-RPC message that
 * matches `wantId`.
 *
 * The transport permits two content types for a POST reply:
 *   - `application/json`  → the body is exactly one JSON-RPC object (the server
 *     closes the response normally, so we read it whole).
 *   - `text/event-stream` → Server-Sent Events; read INCREMENTALLY and return
 *     as soon as the matching message arrives, because the server is allowed to
 *     keep the stream open afterwards (see readSseStream).
 *
 * Returns the parsed JSON-RPC message object, or undefined if none matched.
 */
async function readRpcMessage (res: Response, wantId: number): Promise<Record<string, JsonValue> | undefined> {
  const contentType = (res.headers.get('content-type') ?? '').toLowerCase()

  if (contentType.includes('text/event-stream') && res.body !== null) {
    return readSseStream(res.body, wantId)
  }

  // Default: a single JSON object body. This closes normally, so read it whole.
  const bodyText = await res.text()
  const trimmed = bodyText.trim()
  if (trimmed.length === 0) {
    return undefined
  }
  const msg = JSON.parse(trimmed) as Record<string, JsonValue>
  return (msg !== null && typeof msg === 'object') ? msg : undefined
}

/**
 * Coerce an unknown JSON-RPC error payload into a readable message.
 */
function rpcErrorMessage (error: JsonValue): string {
  if (error !== null && typeof error === 'object') {
    const e = error as { message?: unknown, code?: unknown }
    const message = typeof e.message === 'string' ? e.message : 'unknown error'
    const code = typeof e.code === 'number' ? ` (code ${e.code})` : ''
    return `${message}${code}`
  }
  return 'unknown JSON-RPC error'
}

/**
 * Truncate a string to `max` characters, appending a short ellipsis note when
 * it was actually cut.
 */
function truncate (input: string, max: number): string {
  if (input.length <= max) {
    return input
  }
  return input.slice(0, max) + `\n… [truncated, ${input.length - max} more chars]`
}

/**
 * Pull the first N `type:'text'` entries out of an MCP content array
 * (`result.content[]` for tool calls). Non-text items (images, audio, blobs)
 * are ignored. Each snippet is bounded to MAX_SNIPPET_CHARS.
 */
function collectTextContent (content: JsonValue): string[] {
  if (!Array.isArray(content)) {
    return []
  }
  const out: string[] = []
  for (const item of content) {
    if (item !== null && typeof item === 'object') {
      const it = item as { type?: unknown, text?: unknown }
      if (it.type === 'text' && typeof it.text === 'string' && it.text.trim().length > 0) {
        out.push(truncate(it.text.trim(), MAX_SNIPPET_CHARS))
      }
    }
  }
  return out
}

/**
 * Pull `.text` out of an MCP resource-read result (`result.contents[]`). Each
 * snippet is bounded to MAX_SNIPPET_CHARS.
 */
function collectResourceText (contents: JsonValue): string[] {
  if (!Array.isArray(contents)) {
    return []
  }
  const out: string[] = []
  for (const item of contents) {
    if (item !== null && typeof item === 'object') {
      const it = item as { text?: unknown }
      if (typeof it.text === 'string' && it.text.trim().length > 0) {
        out.push(truncate(it.text.trim(), MAX_SNIPPET_CHARS))
      }
    }
  }
  return out
}

/**
 * Build the `arguments` object for a `tools/call` from the tool's inputSchema
 * and the user's query.
 *
 * Strategy:
 *   - If there are no declared properties, send `{}`.
 *   - Otherwise, if any string property is named one of QUERY_ARG_NAMES, put
 *     the query in the FIRST such property (priority order).
 *   - Additionally, fill every OTHER *required* string property with the query
 *     as a best-effort fallback (so servers that require e.g. both `collection`
 *     and `query` still receive something usable).
 */
function buildToolArguments (tool: McpTool, query: string): Record<string, string> {
  const props = tool.inputSchema?.properties
  if (props === undefined || Object.keys(props).length === 0) {
    return {}
  }

  const args: Record<string, string> = {}
  const required = new Set(tool.inputSchema?.required ?? [])

  const isString = (name: string): boolean => (props[name]?.type === 'string')

  // 1) Primary query slot: first schema-declared string prop matching our
  //    preferred names, in priority order.
  let primary: string | undefined
  for (const candidate of QUERY_ARG_NAMES) {
    if (candidate in props && isString(candidate)) {
      primary = candidate
      break
    }
  }
  if (primary !== undefined) {
    args[primary] = query
  }

  // 2) Fallback: fill any OTHER required string props with the query too, so
  //    the call is not rejected for a missing required field.
  for (const name of required) {
    if (name !== primary && isString(name) && !(name in args)) {
      args[name] = query
    }
  }

  return args
}

/**
 * Pull context from a remote MCP server for a query using the Streamable HTTP
 * transport, and assemble it into a ready-to-inject RAG block plus a short
 * status string. NEVER throws — every failure resolves to
 * `{ block: '', info: 'MCP error: <message>' }`.
 *
 * @param   url    the MCP server endpoint (POST target, e.g. https://host/mcp).
 * @param   query  the user's query to retrieve context for.
 * @param   opts   optional { maxChars, signal }. `maxChars` bounds the block
 *                 (default 6000); `signal` lets the caller cancel.
 * @returns a { block, info } pair (see {@link McpContextResult}).
 */
export async function buildMcpContext (
  url: string,
  query: string,
  opts?: { maxChars?: number, signal?: AbortSignal }
): Promise<McpContextResult> {
  const maxChars = opts?.maxChars ?? DEFAULT_MAX_CHARS
  const externalSignal = opts?.signal

  // ONE deadline for the whole call, computed up front. Combined into every
  // per-request signal so the sum of sequential (even slow-but-responsive)
  // requests can never exceed TOTAL_BUDGET_MS regardless of round-trip count.
  const deadline = AbortSignal.timeout(TOTAL_BUDGET_MS)

  // Captured from the initialize response header and echoed on every later
  // request per the Streamable HTTP session model.
  let sessionId: string | undefined

  // Monotonic JSON-RPC request id.
  let nextId = 1

  /**
   * POST a JSON-RPC request and return its `result`. Throws on a JSON-RPC
   * `error`, on a non-OK HTTP status, or if no matching response is found.
   * Sends the Streamable-HTTP required headers and the captured session id
   * (once known). Also captures the Mcp-Session-Id from the response so the
   * initialize step can seed the session.
   */
  const rpc = async (method: string, params: Record<string, JsonValue>, id: number): Promise<JsonValue> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'
    }
    if (sessionId !== undefined) {
      headers['Mcp-Session-Id'] = sessionId
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
      signal: requestSignal(deadline, externalSignal)
    })

    // Capture (or refresh) the session id from any response that carries it.
    const returnedSession = res.headers.get('mcp-session-id')
    if (returnedSession !== null && returnedSession.length > 0) {
      sessionId = returnedSession
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`)
    }

    const msg = await readRpcMessage(res, id)
    if (msg === undefined) {
      throw new Error(`no JSON-RPC response for ${method}`)
    }
    if ('error' in msg && msg.error !== undefined && msg.error !== null) {
      throw new Error(rpcErrorMessage(msg.error))
    }
    return msg.result
  }

  /**
   * Send a JSON-RPC *notification* (no id, no response expected). Failures are
   * swallowed — notifications are fire-and-forget.
   */
  const notify = async (method: string, params: Record<string, JsonValue>): Promise<void> => {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      }
      if (sessionId !== undefined) {
        headers['Mcp-Session-Id'] = sessionId
      }
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ jsonrpc: '2.0', method, params }),
        signal: requestSignal(deadline, externalSignal)
      })
      // Drain the body so the socket can be reused; ignore the content.
      await res.text().catch(() => '')
    } catch {
      // Ignore — the notification is advisory only.
    }
  }

  try {
    // 1) initialize — capture session id + server capabilities.
    const initResult = await rpc('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'Mint Stylus', version: '1.0.0' }
    }, nextId++) as { capabilities?: Record<string, JsonValue> } | undefined

    const capabilities = (initResult?.capabilities ?? {}) as Record<string, JsonValue>
    const hasTools = 'tools' in capabilities && capabilities.tools !== undefined
    const hasResources = 'resources' in capabilities && capabilities.resources !== undefined

    // 2) notifications/initialized — required handshake completion.
    await notify('notifications/initialized', {})

    // 3) tools/list (guarded by capability).
    let tools: McpTool[] = []
    if (hasTools) {
      try {
        const listed = await rpc('tools/list', {}, nextId++) as { tools?: JsonValue } | undefined
        if (Array.isArray(listed?.tools)) {
          tools = listed.tools.filter((t): t is McpTool =>
            t !== null && typeof t === 'object' && typeof (t as McpTool).name === 'string')
        }
      } catch {
        // Some servers advertise tools but reject the list; continue.
        tools = []
      }
    }

    // 4) resources/list (guarded; some servers return method-not-found).
    let resources: McpResource[] = []
    if (hasResources) {
      try {
        const listed = await rpc('resources/list', {}, nextId++) as { resources?: JsonValue } | undefined
        if (Array.isArray(listed?.resources)) {
          resources = listed.resources.filter((r): r is McpResource =>
            r !== null && typeof r === 'object' && typeof (r as McpResource).uri === 'string')
        }
      } catch {
        // Not fatal — carry on with whatever tools produced.
        resources = []
      }
    }

    // Track what we actually pull from for the status string.
    const snippets: string[] = []
    const usedTools: string[] = []
    let usedResourceCount = 0

    // 5) Choose up to MAX_TOOLS retrieval-shaped tools and call each.
    const chosen = tools
      .filter(t => RETRIEVAL_TOOL_RE.test(t.name) || RETRIEVAL_TOOL_RE.test(t.description ?? ''))
      .slice(0, MAX_TOOLS)

    for (const tool of chosen) {
      try {
        const args = buildToolArguments(tool, query)
        const callResult = await rpc('tools/call', { name: tool.name, arguments: args }, nextId++) as
          { content?: JsonValue, isError?: unknown } | undefined
        const texts = collectTextContent(callResult?.content)
        if (texts.length > 0) {
          usedTools.push(tool.name)
          for (const text of texts) {
            snippets.push(`--- from tool "${tool.name}" ---\n${text}`)
          }
        }
      } catch {
        // Skip a failing tool; other tools/resources may still yield context.
      }
    }

    // 6) Read up to MAX_RESOURCES resources.
    for (const resource of resources.slice(0, MAX_RESOURCES)) {
      try {
        const readResult = await rpc('resources/read', { uri: resource.uri }, nextId++) as
          { contents?: JsonValue } | undefined
        const texts = collectResourceText(readResult?.contents)
        if (texts.length > 0) {
          usedResourceCount++
          const label = resource.name !== undefined && resource.name.length > 0
            ? `${resource.name} <${resource.uri}>`
            : resource.uri
          for (const text of texts) {
            snippets.push(`--- from resource ${label} ---\n${text}`)
          }
        }
      } catch {
        // Skip an unreadable resource.
      }
    }

    // 7) Assemble the block (labelled + bounded) and the status string.
    const toolWord = tools.length === 1 ? 'tool' : 'tools'
    const resourceWord = resources.length === 1 ? 'resource' : 'resources'
    let info = `Connected — ${tools.length} ${toolWord}, ${resources.length} ${resourceWord}`
    if (usedTools.length > 0) {
      const names = usedTools.map(n => `"${n}"`).join(', ')
      const usedToolWord = usedTools.length === 1 ? 'tool' : 'tools'
      info += `; used ${usedToolWord} ${names}`
    }
    if (usedResourceCount > 0) {
      const usedResWord = usedResourceCount === 1 ? 'resource' : 'resources'
      info += `${usedTools.length > 0 ? ' and' : ';'} ${usedResourceCount} ${usedResWord}`
    }
    if (snippets.length === 0) {
      // Connection worked but produced nothing usable.
      return { block: '', info: `${info}; 0 results` }
    }

    const header = `Context retrieved from the MCP server (${url}) for this query:\n"${query}"`
    const body = [ header, '', ...snippets ].join('\n')
    const block = truncate(body, maxChars)

    return { block, info }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { block: '', info: `MCP error: ${message}` }
  }
}
