/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        OpenAI-compatible AI client
 * CVM-Role:        Utility (main process)
 * Maintainer:      Mint Stylus
 * License:         GNU GPL v3
 *
 * Description:     A provider-agnostic client for OpenAI-compatible chat
 *                  completion endpoints (OpenRouter, Z.ai, Ollama Cloud/local).
 *                  Handles both non-streaming responses and streaming responses
 *                  (SSE for OpenAI-compatible endpoints, NDJSON for Ollama's
 *                  native /api/chat endpoint). Runs ONLY in the Electron main
 *                  process — API keys never leave the main process.
 *
 * NOTE:            Created by AI for Mint Stylus. This file is not part of the
 *                  upstream Zettlr project.
 *
 * END HEADER
 */

/**
 * A single chat message in the OpenAI chat-completions shape.
 */
export interface ChatMessage {
  role: 'system'|'user'|'assistant'|'tool'
  content: string
}

/**
 * Options for a single client call. `stream` selects between the two return
 * modes; `onDelta` is invoked for every content delta while streaming.
 */
export interface ClientOptions {
  /** The API base URL, e.g. https://openrouter.ai/api/v1 (no trailing slash needed). */
  baseURL: string
  /** The (already decrypted) API key. May be an empty string for keyless local endpoints. */
  apiKey: string
  /** The model id, e.g. z-ai/glm-5.2. */
  model: string
  /** The conversation so far, in OpenAI shape. */
  messages: ChatMessage[]
  /** Whether to stream the response. */
  stream?: boolean
  /** Optional AbortSignal to cancel the request. */
  signal?: AbortSignal
  /** Extra headers to merge into the request (e.g. OpenRouter attribution). */
  extraHeaders?: Record<string, string>
  /** Optional sampling temperature. */
  temperature?: number
  /** Optional maximum tokens to generate. */
  maxTokens?: number
  /**
   * Optional reasoning-effort level ('low'|'medium'|'high'). When set (and not
   * 'off'), OpenAI-compatible requests carry `reasoning_effort` (harmlessly
   * ignored by providers that don't support it), and Ollama-native requests
   * carry `think: true` instead (Ollama has no effort levels).
   */
  reasoningEffort?: string
  /**
   * Callback invoked for every content delta while streaming. Only used when
   * `stream` is true.
   */
  onDelta?: (delta: string) => void
}

/**
 * Detects whether a given base URL points at Ollama's *native* chat endpoint
 * (which streams NDJSON), as opposed to an OpenAI-compatible endpoint (SSE).
 *
 * Ollama native lives under an `/api` path (…/api/chat), whereas the OpenAI
 * mirror lives under `/v1` (…/v1/chat/completions).
 *
 * @param   {string}   baseURL  The configured base URL
 *
 * @return  {boolean}           True if the base URL is Ollama-native
 */
export function isOllamaNative (baseURL: string): boolean {
  // Strip a trailing slash for a stable comparison.
  const trimmed = baseURL.replace(/\/+$/, '')
  // The OpenAI-compatible endpoints all end in `/v1`. The native Ollama API
  // ends in `/api` (e.g. http://localhost:11434/api or https://ollama.com/api).
  return /\/api$/.test(trimmed)
}

/**
 * Builds the full request URL for the chat endpoint given a base URL.
 *
 * @param   {string}  baseURL  The configured base URL
 *
 * @return  {string}           The absolute chat-completion URL
 */
export function buildChatURL (baseURL: string): string {
  const trimmed = baseURL.replace(/\/+$/, '')
  if (isOllamaNative(trimmed)) {
    return `${trimmed}/chat`
  }
  return `${trimmed}/chat/completions`
}

/**
 * Assembles the request headers, including the Bearer token (when present) and
 * any extra headers supplied by the caller.
 *
 * @param   {string}                  apiKey        The decrypted API key
 * @param   {Record<string,string>}   extraHeaders  Additional headers to merge
 *
 * @return  {Record<string,string>}                 The complete header map
 */
function buildHeaders (apiKey: string, extraHeaders?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extraHeaders ?? {})
  }

  // Only attach an Authorization header if we actually have a key. Local Ollama
  // endpoints ignore the key, and OpenRouter's model listing needs none.
  if (apiKey !== undefined && apiKey !== '') {
    headers.Authorization = `Bearer ${apiKey}`
  }

  return headers
}

/**
 * Constructs the request body for a chat call in the OpenAI-compatible shape.
 * Ollama-native accepts the same core fields (model, messages, stream), so a
 * single body shape works for both.
 *
 * @param   {ClientOptions}  opts  The call options
 *
 * @return  {Record<string,any>}   The JSON-serializable request body
 */
function buildBody (opts: ClientOptions): Record<string, any> {
  const body: Record<string, any> = {
    model: opts.model,
    messages: opts.messages,
    stream: opts.stream === true
  }

  if (typeof opts.temperature === 'number') {
    body.temperature = opts.temperature
  }

  if (typeof opts.maxTokens === 'number') {
    // OpenAI-compatible endpoints use max_tokens; Ollama-native ignores it
    // harmlessly (it reads options.num_predict), so passing it is safe.
    body.max_tokens = opts.maxTokens
  }

  if (typeof opts.reasoningEffort === 'string' && opts.reasoningEffort !== '' && opts.reasoningEffort !== 'off') {
    if (isOllamaNative(opts.baseURL)) {
      // Ollama's native API has no effort levels; `think` toggles reasoning.
      body.think = true
    } else {
      // OpenAI-compatible endpoints; providers without reasoning support
      // ignore the field harmlessly.
      body.reasoning_effort = opts.reasoningEffort
    }
  }

  return body
}

/**
 * The result of feeding a single SSE/NDJSON line to the stream parser: any
 * content delta extracted, and whether the stream is now complete.
 */
export interface ParsedStreamLine {
  /** The content delta extracted from this line, or '' if none. */
  delta: string
  /** True once the terminating line ([DONE] or done:true) has been seen. */
  done: boolean
}

/**
 * Parses a single line of an SSE stream (OpenAI-compatible) or an NDJSON stream
 * (Ollama-native) and extracts any content delta. This function is PURE — it has
 * no side effects and does no I/O — so it can be unit-tested in isolation.
 *
 * SSE rules:
 *   - Blank lines are ignored (delimiters between events).
 *   - Lines beginning with ':' are comments/keep-alives (e.g.
 *     ': OPENROUTER PROCESSING') and are ignored.
 *   - Lines beginning with 'data: ' carry the payload. 'data: [DONE]' ends the
 *     stream. Otherwise the payload is JSON with choices[0].delta.content.
 *
 * NDJSON rules (Ollama-native):
 *   - Each non-blank line is a complete JSON object with message.content.
 *   - An object with done === true ends the stream.
 *
 * @param   {string}   rawLine  A single line from the response stream
 * @param   {boolean}  ndjson   Whether to parse as Ollama NDJSON instead of SSE
 *
 * @return  {ParsedStreamLine}  The extracted delta and completion flag
 */
export function parseSSELine (rawLine: string, ndjson = false): ParsedStreamLine {
  const line = rawLine.trim()

  // Blank lines carry no information in either format.
  if (line === '') {
    return { delta: '', done: false }
  }

  if (ndjson) {
    // Ollama-native: every line is a standalone JSON object.
    try {
      const obj = JSON.parse(line)
      const delta: string = obj?.message?.content ?? ''
      const done: boolean = obj?.done === true
      return { delta, done }
    } catch {
      // A malformed line is skipped rather than crashing the whole stream.
      return { delta: '', done: false }
    }
  }

  // SSE comment / keep-alive line (e.g. ': OPENROUTER PROCESSING').
  if (line.startsWith(':')) {
    return { delta: '', done: false }
  }

  // We only care about `data:` field lines; other SSE fields (event:, id:) are
  // not used by these endpoints.
  if (!line.startsWith('data:')) {
    return { delta: '', done: false }
  }

  const payload = line.slice('data:'.length).trim()

  if (payload === '[DONE]') {
    return { delta: '', done: true }
  }

  try {
    const obj = JSON.parse(payload)
    // Mid-stream errors arrive on an HTTP-200 SSE event; surface them as thrown
    // errors so the caller's catch can report them.
    if (obj?.error !== undefined && obj?.error !== null) {
      const message = typeof obj.error === 'string'
        ? obj.error
        : (obj.error?.message ?? 'Unknown streaming error')
      throw new Error(String(message))
    }
    const delta: string = obj?.choices?.[0]?.delta?.content ?? ''
    return { delta, done: false }
  } catch (err: any) {
    // Re-throw genuine stream errors; swallow JSON parse failures on partial
    // chunks (should not happen after line-splitting, but be defensive).
    if (err instanceof Error && err.message !== '' && !(err instanceof SyntaxError)) {
      throw err
    }
    return { delta: '', done: false }
  }
}

/**
 * Consumes a full stream body (a ReadableStream of Uint8Array as returned by
 * fetch) line-by-line, invoking `onDelta` for each content delta and returning
 * the fully-assembled text once the stream completes. This is the streaming
 * counterpart used by the non-pure `chatCompletion` below, and is kept separate
 * so the line-buffering logic can be exercised independently.
 *
 * @param   {ReadableStream<Uint8Array>}  stream    The response body stream
 * @param   {boolean}                     ndjson    Whether the stream is NDJSON
 * @param   {(d: string) => void}         onDelta   Called for each content delta
 *
 * @return  {Promise<string>}                       The complete assembled text
 */
export async function parseSSEStream (
  stream: ReadableStream<Uint8Array>,
  ndjson: boolean,
  onDelta?: (delta: string) => void
): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let assembled = ''

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })

      // Split off complete lines; keep the trailing partial in the buffer.
      let newlineIndex = buffer.indexOf('\n')
      while (newlineIndex !== -1) {
        const rawLine = buffer.slice(0, newlineIndex)
        buffer = buffer.slice(newlineIndex + 1)

        const { delta, done: streamDone } = parseSSELine(rawLine, ndjson)
        if (delta !== '') {
          assembled += delta
          onDelta?.(delta)
        }
        if (streamDone) {
          return assembled
        }

        newlineIndex = buffer.indexOf('\n')
      }
    }

    // Flush any trailing buffered line (streams may end without a newline).
    if (buffer.trim() !== '') {
      const { delta } = parseSSELine(buffer, ndjson)
      if (delta !== '') {
        assembled += delta
        onDelta?.(delta)
      }
    }
  } finally {
    reader.releaseLock()
  }

  return assembled
}

/**
 * Extracts the assistant text from a non-streaming chat-completion response
 * body. Handles both the OpenAI-compatible shape (choices[0].message.content)
 * and the Ollama-native shape (message.content).
 *
 * @param   {any}     body    The parsed JSON response body
 * @param   {boolean} ndjson  Whether this was an Ollama-native response
 *
 * @return  {string}          The assistant's text
 */
function extractNonStreamText (body: any, ndjson: boolean): string {
  if (ndjson) {
    return body?.message?.content ?? ''
  }
  return body?.choices?.[0]?.message?.content ?? ''
}

/**
 * Performs a single chat-completion request against an OpenAI-compatible (or
 * Ollama-native) endpoint. When `stream` is true, deltas are delivered via
 * `onDelta` and the fully-assembled text is returned once the stream ends. When
 * `stream` is false, the assistant text is returned directly.
 *
 * @param   {ClientOptions}    opts  The request options (must include baseURL,
 *                                   model, messages; apiKey may be empty)
 *
 * @return  {Promise<string>}        The assistant's full text response
 */
export async function chatCompletion (opts: ClientOptions): Promise<string> {
  const ndjson = isOllamaNative(opts.baseURL)
  const url = buildChatURL(opts.baseURL)
  const headers = buildHeaders(opts.apiKey, opts.extraHeaders)
  const body = buildBody(opts)

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: opts.signal
  })

  if (!response.ok) {
    // Try to surface a useful error message from the body.
    let detail = ''
    try {
      const errBody = await response.text()
      detail = errBody.slice(0, 2000)
    } catch {
      detail = ''
    }
    throw new Error(`AI request failed (${response.status} ${response.statusText}): ${detail}`)
  }

  if (opts.stream === true) {
    if (response.body === null) {
      throw new Error('AI streaming request returned no response body')
    }
    return await parseSSEStream(response.body, ndjson, opts.onDelta)
  }

  const json = await response.json()
  return extractNonStreamText(json, ndjson)
}

/**
 * Fetches the list of available models from an OpenAI-compatible endpoint
 * (GET {baseURL}/models). OpenRouter serves this without auth; other endpoints
 * accept the Bearer key if supplied.
 *
 * @param   {string}                  baseURL       The API base URL
 * @param   {string}                  apiKey        Optional API key
 * @param   {Record<string,string>}   extraHeaders  Optional extra headers
 * @param   {AbortSignal}             signal        Optional abort signal
 *
 * @return  {Promise<any[]>}                        The `data` array of models
 */
export async function listModels (
  baseURL: string,
  apiKey = '',
  extraHeaders?: Record<string, string>,
  signal?: AbortSignal
): Promise<any[]> {
  const trimmed = baseURL.replace(/\/+$/, '')
  // Ollama-native exposes /api/tags; the OpenAI mirror uses /models. We
  // normalise both to a /models-style request where possible, but for native
  // Ollama we hit /api/tags and adapt the shape.
  if (isOllamaNative(trimmed)) {
    const response = await fetch(`${trimmed}/tags`, {
      method: 'GET',
      headers: buildHeaders(apiKey, extraHeaders),
      signal
    })
    if (!response.ok) {
      throw new Error(`Model listing failed (${response.status} ${response.statusText})`)
    }
    const json = await response.json()
    // Ollama /api/tags returns { models: [{ name, ... }] }; map to {id}.
    const models: any[] = Array.isArray(json?.models) ? json.models : []
    return models.map((m: any) => ({ id: m?.name ?? m?.model, ...m }))
  }

  const response = await fetch(`${trimmed}/models`, {
    method: 'GET',
    headers: buildHeaders(apiKey, extraHeaders),
    signal
  })

  if (!response.ok) {
    throw new Error(`Model listing failed (${response.status} ${response.statusText})`)
  }

  const json = await response.json()
  return Array.isArray(json?.data) ? json.data : []
}

/**
 * Validates an OpenRouter key and returns its quota info
 * (GET https://openrouter.ai/api/v1/key with the Bearer key).
 *
 * @param   {string}          apiKey   The OpenRouter API key
 * @param   {string}          baseURL  The OpenRouter base URL (defaults to the
 *                                     canonical one)
 * @param   {AbortSignal}     signal   Optional abort signal
 *
 * @return  {Promise<any>}             The `data` object with limit/usage fields
 */
export async function validateOpenRouterKey (
  apiKey: string,
  baseURL = 'https://openrouter.ai/api/v1',
  signal?: AbortSignal
): Promise<any> {
  const trimmed = baseURL.replace(/\/+$/, '')
  const response = await fetch(`${trimmed}/key`, {
    method: 'GET',
    headers: buildHeaders(apiKey),
    signal
  })

  if (!response.ok) {
    throw new Error(`Key validation failed (${response.status} ${response.statusText})`)
  }

  const json = await response.json()
  // OpenRouter wraps the payload in { data: {...} }.
  return json?.data ?? json
}
