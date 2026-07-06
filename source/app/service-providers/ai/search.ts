/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        runSearch (web search for the AI)
 * CVM-Role:        Utility (AIProvider helper)
 * Maintainer:      Mint Stylus
 * License:         GNU GPL v3
 *
 * Description:     Performs a web search on behalf of the AI so results can be
 *                  injected into a prompt (RAG). MAIN-PROCESS ONLY — every HTTP
 *                  call and every API key stays here; the renderer only ever
 *                  receives the returned text block. Supports Tavily (primary,
 *                  ToS-clean), Brave (optional BYOK) and DuckDuckGo's Instant
 *                  Answer API (no key, supplement only). Uses the global fetch;
 *                  no Electron imports are required.
 *
 * END HEADER
 *
 * <!-- created by AI for Mint Stylus -->
 */

/**
 * A single normalized search result.
 */
export interface SearchResult {
  title: string
  url: string
  snippet: string
}

/**
 * The shape returned by {@link runSearch}. `block` is a ready-to-inject,
 * date-stamped context block for RAG prompts; `results` is the structured form.
 */
export interface SearchResponse {
  query: string
  retrievedAt: string
  results: SearchResult[]
  block: string
}

/**
 * Which search backend to hit. Tavily is the recommended primary (1,000
 * credits/mo, no card); Brave is an optional BYOK upgrade; DuckDuckGo is a
 * no-key supplement that only returns instant-answer style entity summaries.
 */
export type SearchProvider = 'tavily'|'brave'|'duckduckgo'

/**
 * Arguments for {@link runSearch}.
 */
export interface RunSearchArgs {
  provider: SearchProvider
  /**
   * The provider API key. Required for Tavily and Brave; ignored (may be empty)
   * for DuckDuckGo. This value is only ever handled in the main process.
   */
  apiKey: string
  query: string
}

// Cap on the number of results we surface / inject.
const MAX_RESULTS = 5

/**
 * In-memory cache keyed by normalized query. Entries expire after CACHE_TTL_MS.
 * TTL is intentionally short (15 min) — long enough to dedupe rapid repeat
 * queries and debounce, short enough that "live" searches stay reasonably
 * fresh. This cache is per-process and is discarded on app restart; it is not
 * persisted anywhere.
 */
const CACHE_TTL_MS = 15 * 60 * 1000
interface CacheEntry {
  expires: number
  value: SearchResponse
}
const cache: Map<string, CacheEntry> = new Map()

/**
 * Normalize a query for cache keying: trim, collapse internal whitespace and
 * lowercase. The provider is folded into the key by the caller (see runSearch)
 * so that switching providers does not return another backend's cached block.
 */
function normalizeQuery (query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Strip a small set of inline HTML tags (notably Brave's <strong> highlight
 * markup) and collapse whitespace, so snippets are plain text.
 */
function stripHtml (input: string): string {
  return input
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Build the delimited, date-stamped RAG context block from a set of results.
 * The block is capped at MAX_RESULTS and is safe to concatenate directly into
 * a prompt: it announces the retrieval date so the model can reason about
 * recency and cite the URLs.
 */
function buildBlock (query: string, retrievedAt: string, results: SearchResult[]): string {
  const lines: string[] = []
  lines.push('=== WEB SEARCH RESULTS ===')
  lines.push(`Query: ${query}`)
  lines.push(`Retrieved: ${retrievedAt}`)
  lines.push('Use these sources to answer and cite the URLs where relevant.')
  lines.push('')

  if (results.length === 0) {
    lines.push('(No results were returned for this query.)')
  } else {
    for (const [ i, res ] of results.slice(0, MAX_RESULTS).entries()) {
      lines.push(`[${i + 1}] ${res.title}`)
      lines.push(`URL: ${res.url}`)
      if (res.snippet.length > 0) {
        lines.push(res.snippet)
      }
      lines.push('')
    }
  }

  lines.push('=== END WEB SEARCH RESULTS ===')
  return lines.join('\n')
}

/**
 * Build a "quota exhausted" response block. Returned (rather than throwing) on
 * HTTP 429 / 402 so the AI can surface a clear, visible state instead of
 * silently answering without the promised search.
 */
function buildQuotaBlock (query: string, retrievedAt: string, provider: SearchProvider): SearchResponse {
  const block = [
    '=== WEB SEARCH UNAVAILABLE ===',
    `Query: ${query}`,
    `Retrieved: ${retrievedAt}`,
    `The ${provider} search quota is exhausted or the request was rate-limited.`,
    'No web results are available for this query right now.',
    '=== END WEB SEARCH UNAVAILABLE ===',
    '',
    'Answer from your own knowledge and clearly note that live web search was unavailable.'
  ].join('\n')

  return { query, retrievedAt, results: [], block }
}

/**
 * Tavily — PRIMARY backend (ToS-clean, 1,000 credits/mo, no card).
 *
 * POST https://api.tavily.com/search
 *
 * NOTE (see risks): Tavily historically accepted the key in the JSON body as
 * `api_key`; their current docs use a Bearer token. We implement the Bearer
 * form (`Authorization: Bearer <key>`) with a JSON body of {query, max_results,
 * search_depth}. If a deployment finds the key must go in the body instead,
 * this is the single spot to adjust.
 */
async function searchTavily (apiKey: string, query: string): Promise<SearchResult[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      query,
      max_results: MAX_RESULTS,
      search_depth: 'basic'
    })
  })

  if (res.status === 429 || res.status === 402) {
    throw new QuotaError(`Tavily returned HTTP ${res.status}`)
  }
  if (!res.ok) {
    throw new Error(`Tavily search failed: HTTP ${res.status} ${res.statusText}`)
  }

  const data = await res.json() as {
    results?: Array<{ title?: string, url?: string, content?: string }>
  }

  const results = Array.isArray(data.results) ? data.results : []
  return results.slice(0, MAX_RESULTS).map(r => ({
    title: (r.title ?? '').trim() || (r.url ?? 'Untitled'),
    url: (r.url ?? '').trim(),
    snippet: stripHtml(r.content ?? '')
  })).filter(r => r.url.length > 0)
}

/**
 * Brave — optional BYOK upgrade.
 *
 * GET https://api.search.brave.com/res/v1/web/search?q=&count=5&extra_snippets=true
 * Header: X-Subscription-Token: <key>
 *
 * Maps web.results[] {title, url, description} and strips the <strong> HTML
 * highlight markup Brave embeds in `description`.
 */
async function searchBrave (apiKey: string, query: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    count: String(MAX_RESULTS),
    extra_snippets: 'true'
  })

  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, {
    method: 'GET',
    headers: {
      'X-Subscription-Token': apiKey,
      'Accept': 'application/json'
    }
  })

  if (res.status === 429 || res.status === 402) {
    throw new QuotaError(`Brave returned HTTP ${res.status}`)
  }
  if (!res.ok) {
    throw new Error(`Brave search failed: HTTP ${res.status} ${res.statusText}`)
  }

  const data = await res.json() as {
    web?: { results?: Array<{ title?: string, url?: string, description?: string }> }
  }

  const results = data.web?.results ?? []
  return results.slice(0, MAX_RESULTS).map(r => ({
    title: stripHtml(r.title ?? '') || (r.url ?? 'Untitled'),
    url: (r.url ?? '').trim(),
    snippet: stripHtml(r.description ?? '')
  })).filter(r => r.url.length > 0)
}

/**
 * DuckDuckGo Instant Answer API — no key, supplement only.
 *
 * GET https://api.duckduckgo.com/?q=&format=json&no_html=1&t=mintstylus
 *
 * DDG explicitly states this is NOT a full search results API — it returns an
 * Abstract for well-known entities plus RelatedTopics. We build results from
 * the Abstract (if any) followed by RelatedTopics. We NEVER scrape
 * html.duckduckgo.com — that violates DDG's robots.txt / ToS.
 */
async function searchDuckDuckGo (query: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    no_html: '1',
    t: 'mintstylus'
  })

  const res = await fetch(`https://api.duckduckgo.com/?${params.toString()}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  })

  // DDG auto-throttles with HTTP 202 (and can 429). Treat both as quota.
  if (res.status === 202 || res.status === 429) {
    throw new QuotaError(`DuckDuckGo returned HTTP ${res.status}`)
  }
  if (!res.ok) {
    throw new Error(`DuckDuckGo search failed: HTTP ${res.status} ${res.statusText}`)
  }

  const data = await res.json() as {
    Heading?: string
    AbstractText?: string
    Abstract?: string
    AbstractURL?: string
    RelatedTopics?: Array<{
      Text?: string
      FirstURL?: string
      // Grouped topics nest their entries under Topics[]
      Topics?: Array<{ Text?: string, FirstURL?: string }>
    }>
  }

  const results: SearchResult[] = []

  const abstract = stripHtml(data.AbstractText ?? data.Abstract ?? '')
  const abstractUrl = (data.AbstractURL ?? '').trim()
  if (abstract.length > 0 && abstractUrl.length > 0) {
    results.push({
      title: stripHtml(data.Heading ?? '') || abstractUrl,
      url: abstractUrl,
      snippet: abstract
    })
  }

  // Flatten RelatedTopics (some entries are groups containing Topics[]).
  const flatTopics: Array<{ Text?: string, FirstURL?: string }> = []
  for (const topic of data.RelatedTopics ?? []) {
    if (Array.isArray(topic.Topics)) {
      flatTopics.push(...topic.Topics)
    } else {
      flatTopics.push(topic)
    }
  }

  for (const topic of flatTopics) {
    if (results.length >= MAX_RESULTS) {
      break
    }
    const url = (topic.FirstURL ?? '').trim()
    const text = stripHtml(topic.Text ?? '')
    if (url.length === 0 || text.length === 0) {
      continue
    }
    results.push({
      // DDG topic Text is usually "Title - description"; use the lead as title.
      title: text.split(' - ')[0] || url,
      url,
      snippet: text
    })
  }

  return results.slice(0, MAX_RESULTS)
}

/**
 * Internal marker error: a backend signalled that we hit a rate/quota limit
 * (HTTP 429 / 402 / DDG 202). runSearch catches this and returns a clear
 * "quota exhausted" block instead of throwing.
 */
class QuotaError extends Error {
  constructor (message: string) {
    super(message)
    this.name = 'QuotaError'
  }
}

/**
 * Run a web search for the AI and return both structured results and a
 * ready-to-inject, date-stamped RAG context block.
 *
 * Behaviour:
 *   - Results are capped at ~5 (MAX_RESULTS).
 *   - Successful responses are cached in-memory per normalized query+provider
 *     for CACHE_TTL_MS (15 min) to dedupe rapid repeats.
 *   - On HTTP 429 / 402 (and DDG's 202 throttle) a clear "quota exhausted"
 *     block is returned rather than throwing, so the AI can surface a visible
 *     state instead of silently answering without the promised search.
 *   - Other network/HTTP failures reject, so the caller can decide how to
 *     degrade.
 *
 * @param   args  provider, apiKey (main-process only) and query.
 * @returns the query, ISO retrieval timestamp, up to 5 results and the block.
 */
export async function runSearch (args: RunSearchArgs): Promise<SearchResponse> {
  const { provider, apiKey, query } = args
  const retrievedAt = new Date().toISOString()

  const trimmed = query.trim()
  if (trimmed.length === 0) {
    return {
      query,
      retrievedAt,
      results: [],
      block: buildBlock(query, retrievedAt, [])
    }
  }

  // Cache key folds in the provider so switching backends doesn't return
  // another backend's cached block for the same words.
  const cacheKey = `${provider}::${normalizeQuery(trimmed)}`
  const cached = cache.get(cacheKey)
  if (cached !== undefined && cached.expires > Date.now()) {
    return cached.value
  }

  try {
    let results: SearchResult[]
    switch (provider) {
      case 'tavily':
        results = await searchTavily(apiKey, trimmed)
        break
      case 'brave':
        results = await searchBrave(apiKey, trimmed)
        break
      case 'duckduckgo':
        results = await searchDuckDuckGo(trimmed)
        break
      default:
        // Exhaustiveness guard — should be unreachable with typed input.
        throw new Error(`Unknown search provider: ${String(provider)}`)
    }

    const response: SearchResponse = {
      query: trimmed,
      retrievedAt,
      results,
      block: buildBlock(trimmed, retrievedAt, results)
    }

    // Only cache non-empty successful responses.
    if (results.length > 0) {
      cache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, value: response })
    }

    return response
  } catch (err: unknown) {
    if (err instanceof QuotaError) {
      // Do NOT cache quota states — we want to retry once quota resets.
      return buildQuotaBlock(trimmed, retrievedAt, provider)
    }
    throw err
  }
}
