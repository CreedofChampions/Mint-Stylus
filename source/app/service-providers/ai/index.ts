/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        AIProvider
 * CVM-Role:        Service Provider
 * Maintainer:      Mint Stylus
 * License:         GNU GPL v3
 *
 * Description:     The AI service provider. This is the ONLY place in the whole
 *                  application that holds API keys or makes AI/search HTTP
 *                  requests. The renderer communicates exclusively over the
 *                  'ai-provider' IPC channel by sending { command, payload }
 *                  objects and receiving text / streamed deltas back. A key is
 *                  never sent to, nor readable from, the renderer: keys are
 *                  encrypted with Electron safeStorage and decrypted only inside
 *                  the outbound request. There is deliberately NO 'get-key'
 *                  command.
 *
 *                  ==== AI-created for Mint Stylus ====
 *                  This file was authored by AI as part of the Mint Stylus fork
 *                  of Zettlr. It has no upstream Zettlr counterpart.
 *
 * END HEADER
 */

import path from 'path'
import { promises as fs } from 'fs'
import { app, ipcMain, safeStorage } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import ProviderContract from '../provider-contract'
import type { IPCAPI } from '../provider-contract'
import type LogProvider from '../log'
import type ConfigProvider from '../config'
import PersistentDataContainer from '@common/modules/persistent-data-container'
import {
  chatCompletion,
  listModels,
  validateOpenRouterKey,
  type ChatMessage
} from './openai-client'
import { runSearch, type SearchProvider as WebSearchProvider } from './search'
import { buildMessages } from './prompts'
import { DEFAULT_PROVIDER, getProviderInfo } from '@common/util/ai-providers'

// Re-export the shared provider catalogue so callers importing from the AI
// service can reach it here too. PROVIDERS is the ONE source of truth for
// provider slugs, fixed base URLs, key requirements, and default models; it
// lives in a renderer-safe module (no Electron/Node imports) so the preferences
// and onboarding UIs can build their dropdowns from the exact same object.
export { PROVIDERS, DEFAULT_PROVIDER, PROVIDER_SLUGS, getProviderInfo, isProviderSlug } from '@common/util/ai-providers'
export type { AIProviderInfo, AIProviderSlug } from '@common/util/ai-providers'

/**
 * OpenRouter attribution headers (optional, for the app-rankings program). Sent
 * only for OpenRouter requests.
 */
const OPENROUTER_HEADERS: Record<string, string> = {
  'HTTP-Referer': 'https://mint-stylus.app',
  'X-OpenRouter-Title': 'Mint Stylus'
}

/**
 * The filename (under userData) that stores the encrypted per-provider API keys.
 * Shape on disk: { [provider: string]: base64String }.
 */
const KEY_STORE_FILE = 'ai-keys.json'

/**
 * The filename (under userData) of the "Write in My Style" guide the user can
 * author. Its contents are prepended (as a system message) to every chat.
 */
const STYLE_FILE = 'mint-style.md'

/**
 * The default contents written to the "Write in My Style" file the first time
 * the provider boots (when no file yet exists). A short, editable scaffold so
 * "Write in My Style" is never empty — the user replaces the example-filled
 * placeholders with their own preferences.
 */
const DEFAULT_STYLE_TEMPLATE = [
  '# Write in My Style',
  '',
  'This file describes how you want the AI to write. Edit each section below to',
  'match your own voice — everything here is just an example to get you started.',
  '',
  '## Voice',
  '',
  '- Warm but direct; sound like a knowledgeable friend, not a corporate memo.',
  '- Write in the first person when it fits; use "you" to address the reader.',
  '',
  '## Sentence length',
  '',
  '- Favour short, punchy sentences. Vary the rhythm; avoid long run-ons.',
  '- Break a complex idea into two sentences rather than one dense one.',
  '',
  '## Vocabulary',
  '',
  '- Plain, concrete words over jargon. Explain a technical term the first time.',
  '- Prefer strong verbs over adverbs (e.g. "sprinted", not "ran quickly").',
  '',
  '## Formatting',
  '',
  '- Use Markdown headings to structure longer answers.',
  '- Lean on bullet lists for options and steps; keep paragraphs to 3–4 lines.',
  '',
  '## Things to avoid',
  '',
  '- No filler openers ("In today\'s fast-paced world…").',
  '- No hedging clichés ("it depends", "there is no one-size-fits-all").',
  '- Do not overuse bold text or exclamation marks.',
  ''
].join('\n')

/**
 * The on-disk key-store shape. Each value is either a base64-encoded encrypted
 * buffer, or — when encryption is unavailable — a plaintext key flagged with a
 * sentinel prefix (see PLAINTEXT_PREFIX) so we never silently treat a plaintext
 * key as ciphertext.
 */
type KeyStore = Record<string, string>

/**
 * Marks a stored value as plaintext (used only when safeStorage encryption is
 * unavailable on the platform, e.g. a Linux box with no keyring). The base64 of
 * a real encrypted buffer will never begin with this ASCII marker.
 */
const PLAINTEXT_PREFIX = 'plaintext:'

/**
 * The typed IPC API this provider understands. Every command the renderer can
 * send over the 'ai-provider' channel is enumerated here. NOTE that there is no
 * 'get-key' — a decrypted key is never returned to the renderer.
 */
export type AIProviderIPCAPI = IPCAPI<{
  'list-models': { provider?: string, baseURL?: string }
  'validate-key': { provider?: string, baseURL?: string }
  'chat': {
    provider?: string
    baseURL?: string
    model?: string
    messages: ChatMessage[]
    system?: string
    pageContext?: string
    temperature?: number
    maxTokens?: number
  }
  'chat-stream': {
    id: string
    provider?: string
    baseURL?: string
    model?: string
    messages: ChatMessage[]
    system?: string
    pageContext?: string
    temperature?: number
    maxTokens?: number
  }
  'cancel': { id: string }
  'search': { provider?: WebSearchProvider, query: string }
  'save-key': { provider: string, key: string }
  'has-key': { provider: string }
  'delete-key': { provider: string }
  'get-style': unknown
  'set-style': { content: string }
}>

/**
 * The AI service provider. Mirrors the shape of the simple TargetProvider: it
 * registers a single ipcMain.handle channel, persists small state through a
 * PersistentDataContainer, and owns all outbound network I/O.
 */
export default class AIProvider extends ProviderContract {
  /**
   * Absolute path to the encrypted key store.
   */
  private readonly _keyFile: string
  /**
   * Persists the (encrypted) key store as JSON. Reuses the same container
   * pattern as every other provider.
   */
  private readonly _keyContainer: PersistentDataContainer<KeyStore>
  /**
   * The in-memory copy of the key store (base64 ciphertext per provider).
   */
  private _keys: KeyStore
  /**
   * Absolute path to the "Write in My Style" file.
   */
  private readonly _styleFile: string
  /**
   * Tracks in-flight streaming requests so they can be cancelled by id.
   */
  private readonly _inFlight: Map<string, AbortController>

  /**
   * Construct the provider and register the IPC handler.
   *
   * @param  {LogProvider}     _logger  The application logger
   * @param  {ConfigProvider}  _config  The application config provider
   */
  constructor (
    private readonly _logger: LogProvider,
    private readonly _config: ConfigProvider
  ) {
    super()

    this._keyFile = path.join(app.getPath('userData'), KEY_STORE_FILE)
    this._keyContainer = new PersistentDataContainer<KeyStore>(this._keyFile, 'json')
    this._keys = {}
    this._styleFile = path.join(app.getPath('userData'), STYLE_FILE)
    this._inFlight = new Map()

    ipcMain.handle('ai-provider', async (event, payload: AIProviderIPCAPI) => {
      try {
        return await this._handle(event, payload)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        this._logger.error(`[AIProvider] Command "${payload?.command}" failed: ${message}`, err)
        // Re-throw so the renderer's invoke() rejects and can show the error.
        throw err
      }
    })
  }

  /**
   * Load the encrypted key store from disk (initialising it on first run).
   */
  public async boot (): Promise<void> {
    if (!await this._keyContainer.isInitialized()) {
      await this._keyContainer.init({})
      this._keys = {}
    } else {
      const stored = await this._keyContainer.get()
      this._keys = (stored ?? {}) as KeyStore
    }

    if (!safeStorage.isEncryptionAvailable()) {
      this._logger.warning('[AIProvider] safeStorage encryption is NOT available on this platform. API keys will be stored in plaintext under userData. Consider configuring a system keyring.')
    }

    // Ensure a default "Write in My Style" file exists so the feature is never
    // empty on a fresh install. We honour a configured styleFilePath if the
    // sibling `ai` config group provides one, otherwise fall back to the
    // userData default. Only write when the target does not already exist —
    // never clobber a file the user has authored.
    await this._ensureDefaultStyleFile()
  }

  /**
   * Write the default style-guide template to the style file if (and only if) it
   * does not already exist. Best-effort: a failure here is logged but never
   * blocks boot, since the AI path already tolerates an empty/absent style file.
   */
  private async _ensureDefaultStyleFile (): Promise<void> {
    const target = this._resolveStyleFile()
    try {
      await fs.access(target)
      // Already exists — leave the user's file untouched.
      return
    } catch {
      // Does not exist (or is unreadable): write the default below.
    }

    try {
      await fs.writeFile(target, DEFAULT_STYLE_TEMPLATE, { encoding: 'utf-8' })
      this._logger.info(`[AIProvider] Wrote default "Write in My Style" template to ${target}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      this._logger.warning(`[AIProvider] Could not write the default style file at ${target}: ${message}`)
    }
  }

  /**
   * Cancel any in-flight streams and flush the key store to disk.
   */
  public async shutdown (): Promise<void> {
    this._logger.verbose('[AIProvider] AI provider shutting down …')
    for (const controller of this._inFlight.values()) {
      controller.abort()
    }
    this._inFlight.clear()
    this._keyContainer.shutdown()
  }

  /**
   * Dispatch a single IPC command. Extracted so the constructor's handler can
   * wrap it in uniform error logging.
   *
   * @param   {Electron.IpcMainInvokeEvent}  event    The IPC event (for sender)
   * @param   {AIProviderIPCAPI}             payload  The typed command payload
   *
   * @return  {Promise<any>}                          The command result
   */
  private async _handle (event: IpcMainInvokeEvent, payload: AIProviderIPCAPI): Promise<any> {
    switch (payload.command) {
      case 'list-models':
        return await this._listModels(payload.payload)
      case 'validate-key':
        return await this._validateKey(payload.payload)
      case 'chat':
        return await this._chat(payload.payload)
      case 'chat-stream':
        return await this._chatStream(event, payload.payload)
      case 'cancel':
        return this._cancel(payload.payload.id)
      case 'search':
        return await this._search(payload.payload)
      case 'save-key':
        return await this._saveKey(payload.payload.provider, payload.payload.key)
      case 'has-key':
        return this._hasKey(payload.payload.provider)
      case 'delete-key':
        return await this._deleteKey(payload.payload.provider)
      case 'get-style':
        return await this._getStyle()
      case 'set-style':
        return await this._setStyle(payload.payload.content)
      default:
        // Exhaustiveness guard — unreachable with typed input.
        throw new Error(`[AIProvider] Unknown command: ${String((payload as any).command)}`)
    }
  }

  // ==========================================================================
  // Key storage (safeStorage). NONE of these ever return a decrypted key to the
  // renderer. Decryption happens only inside the outbound request helpers below.
  // ==========================================================================

  /**
   * Encrypt and persist a provider's API key. This is the single inbound trip of
   * the plaintext key (the accepted norm): the renderer sends it once at save
   * time; from then on only ciphertext is stored and it is decrypted solely
   * inside outbound requests.
   *
   * @param   {string}  provider  The provider id (e.g. 'openrouter')
   * @param   {string}  key       The plaintext API key
   *
   * @return  {Promise<{ saved: boolean, encrypted: boolean }>}  Result flags
   */
  private async _saveKey (provider: string, key: string): Promise<{ saved: boolean, encrypted: boolean }> {
    if (typeof provider !== 'string' || provider.length === 0) {
      throw new Error('[AIProvider] save-key requires a provider id')
    }

    const trimmed = typeof key === 'string' ? key.trim() : ''
    if (trimmed.length === 0) {
      // An empty key means "clear it".
      return await this._deleteKey(provider).then(() => ({ saved: false, encrypted: false }))
    }

    let stored: string
    let encrypted = false
    if (safeStorage.isEncryptionAvailable()) {
      const buffer = await this._encrypt(trimmed)
      stored = buffer.toString('base64')
      encrypted = true
    } else {
      // No keyring available. Store as flagged plaintext rather than pretending
      // it is ciphertext, and keep the boot-time warning honest.
      this._logger.warning(`[AIProvider] Storing the ${provider} key WITHOUT encryption (safeStorage unavailable).`)
      stored = `${PLAINTEXT_PREFIX}${trimmed}`
      encrypted = false
    }

    this._keys[provider] = stored
    this._keyContainer.set(this._keys)
    return { saved: true, encrypted }
  }

  /**
   * Whether a key is stored for the given provider. Returns only a boolean —
   * never the key itself.
   *
   * @param   {string}   provider  The provider id
   *
   * @return  {boolean}            True if a non-empty key is stored
   */
  private _hasKey (provider: string): boolean {
    const value = this._keys[provider]
    return typeof value === 'string' && value.length > 0
  }

  /**
   * Delete a provider's stored key.
   *
   * @param   {string}   provider  The provider id
   *
   * @return  {Promise<{ deleted: boolean }>}  Whether a key was removed
   */
  private async _deleteKey (provider: string): Promise<{ deleted: boolean }> {
    if (this._keys[provider] === undefined) {
      return { deleted: false }
    }
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete this._keys[provider]
    this._keyContainer.set(this._keys)
    return { deleted: true }
  }

  /**
   * Decrypt a provider's stored key for use in an outbound request. PRIVATE and
   * never reachable over IPC — this is the only path that yields plaintext, and
   * its result is used solely to set an Authorization header.
   *
   * @param   {string}  provider  The provider id
   *
   * @return  {Promise<string>}   The decrypted key, or '' if none is stored
   */
  private async _decryptKey (provider: string): Promise<string> {
    const stored = this._keys[provider]
    if (typeof stored !== 'string' || stored.length === 0) {
      return ''
    }

    if (stored.startsWith(PLAINTEXT_PREFIX)) {
      return stored.slice(PLAINTEXT_PREFIX.length)
    }

    if (!safeStorage.isEncryptionAvailable()) {
      // We have ciphertext but no way to decrypt it (keyring vanished). Fail
      // loudly rather than sending garbage as a key.
      throw new Error(`[AIProvider] A key is stored for "${provider}" but safeStorage encryption is unavailable to decrypt it.`)
    }

    const buffer = Buffer.from(stored, 'base64')
    return await this._decrypt(buffer)
  }

  /**
   * Encrypt a string, preferring the async safeStorage variant when present and
   * falling back to the synchronous one otherwise.
   *
   * @param   {string}  plaintext  The value to encrypt
   *
   * @return  {Promise<Buffer>}    The encrypted buffer
   */
  private async _encrypt (plaintext: string): Promise<Buffer> {
    // NOTE: We deliberately use the SYNCHRONOUS safeStorage.encryptString.
    // Electron 42's encryptStringAsync/decryptStringAsync do NOT round-trip to a
    // plain string here (decryptStringAsync returns a non-string), which
    // silently corrupted the API key and caused every request to 401. The sync
    // methods are stable and cheap for a short key. See _decrypt.
    return safeStorage.encryptString(plaintext)
  }

  /**
   * Decrypt a buffer, preferring the async safeStorage variant when present and
   * falling back to the synchronous one otherwise.
   *
   * @param   {Buffer}  buffer  The encrypted buffer
   *
   * @return  {Promise<string>}  The decrypted plaintext
   */
  private async _decrypt (buffer: Buffer): Promise<string> {
    // SYNCHRONOUS ONLY — decryptStringAsync returns a non-string in Electron 42,
    // which corrupts the key and yields 401 Unauthorized on every request. The
    // sync decryptString reliably returns the original key (and reads blobs that
    // were written by either variant). Defensive guard: ensure a string.
    const result = safeStorage.decryptString(buffer)
    return typeof result === 'string' ? result : String(result)
  }

  // ==========================================================================
  // Provider resolution helpers
  // ==========================================================================

  /**
   * Resolve the provider id from a payload, falling back to the configured
   * default provider, then to DEFAULT_PROVIDER.
   */
  private _resolveProvider (payloadProvider?: string): string {
    if (typeof payloadProvider === 'string' && payloadProvider.length > 0) {
      return payloadProvider
    }
    const configured = this._readConfig<string>('ai.provider')
    return (typeof configured === 'string' && configured.length > 0) ? configured : DEFAULT_PROVIDER
  }

  /**
   * Resolve the base URL for a request. For every named provider the base URL is
   * derived AUTOMATICALLY from the provider (see PROVIDERS) so users never see or
   * type an endpoint. The ONE exception is the 'custom' provider, whose base URL
   * the user types in the UI (stored in `ai.baseURL`).
   *
   * Order of precedence: an explicit payload baseURL wins (internal use); then —
   * ONLY for the 'custom' provider — the non-empty configured `ai.baseURL` the
   * user typed; then the provider's fixed canonical base URL from PROVIDERS. The
   * configured `ai.baseURL` is deliberately NOT applied to named providers, so a
   * URL left over from a previous 'custom' selection can never leak into (or
   * silently redirect) a named provider like OpenRouter.
   */
  private _resolveBaseURL (provider: string, payloadBaseURL?: string): string {
    if (typeof payloadBaseURL === 'string' && payloadBaseURL.length > 0) {
      return payloadBaseURL
    }
    if (provider === 'custom') {
      const configured = this._readConfig<string>('ai.baseURL')
      if (typeof configured === 'string' && configured.length > 0) {
        return configured
      }
    }
    return getProviderInfo(provider).baseURL
  }

  /**
   * Resolve the model for a request: an explicit payload model wins, then a
   * configured `ai.model`, then the provider's default model (see PROVIDERS).
   */
  private _resolveModel (provider: string, payloadModel?: string): string {
    if (typeof payloadModel === 'string' && payloadModel.length > 0) {
      return payloadModel
    }
    const configured = this._readConfig<string>('ai.model')
    if (typeof configured === 'string' && configured.length > 0) {
      return configured
    }
    return getProviderInfo(provider).defaultModel
  }

  /**
   * Compute the extra headers for a provider (OpenRouter attribution headers).
   */
  private _extraHeaders (provider: string): Record<string, string> | undefined {
    if (provider === 'openrouter') {
      return { ...OPENROUTER_HEADERS }
    }
    return undefined
  }

  /**
   * Read a config value defensively. The `ai` config group is added by a sibling
   * agent; until it exists (or if the key is absent) this returns undefined
   * rather than throwing, so the provider degrades to its own defaults.
   */
  private _readConfig<T> (key: string): T | undefined {
    try {
      return this._config.get(key) as T
    } catch {
      return undefined
    }
  }

  // ==========================================================================
  // Model listing / key validation
  // ==========================================================================

  /**
   * List the models available at a provider's endpoint. OpenRouter needs no
   * auth; other endpoints get the Bearer key if one is stored.
   */
  private async _listModels (payload: { provider?: string, baseURL?: string }): Promise<any[]> {
    const provider = this._resolveProvider(payload.provider)
    const baseURL = this._resolveBaseURL(provider, payload.baseURL)
    // OpenRouter model listing needs no key. For other backends, pass the key
    // if we have one (some require it, local Ollama ignores it).
    const apiKey = provider === 'openrouter' ? '' : await this._decryptKey(provider)
    return await listModels(baseURL, apiKey, this._extraHeaders(provider))
  }

  /**
   * Validate an OpenRouter key and return its quota info ({ limit, usage, … }).
   * Only OpenRouter exposes a /key endpoint; other providers reject.
   */
  private async _validateKey (payload: { provider?: string, baseURL?: string }): Promise<any> {
    const provider = this._resolveProvider(payload.provider)
    if (provider !== 'openrouter') {
      throw new Error(`[AIProvider] Key validation is only supported for OpenRouter (got "${provider}").`)
    }
    const baseURL = this._resolveBaseURL(provider, payload.baseURL)
    const apiKey = await this._decryptKey(provider)
    if (apiKey === '') {
      throw new Error('[AIProvider] No OpenRouter key is stored to validate.')
    }
    return await validateOpenRouterKey(apiKey, baseURL)
  }

  // ==========================================================================
  // Chat (non-streaming) and Chat-stream (SSE / NDJSON forwarded to renderer)
  // ==========================================================================

  /**
   * Assemble the final message list for a chat request: the "Write in My Style"
   * guide is always prepended (as a leading system message) via buildMessages,
   * along with any per-request system prompt and whole-page context. The
   * caller's `messages` array carries the conversation turns.
   */
  private async _assembleMessages (payload: {
    messages: ChatMessage[]
    system?: string
    pageContext?: string
  }): Promise<ChatMessage[]> {
    const style = await this._getStyle()
    const turns = Array.isArray(payload.messages) ? payload.messages : []

    // Separate any leading system turns the caller already supplied from the
    // user/assistant turns so buildMessages can put the style FIRST.
    const priorSystem = turns.filter(m => m.role === 'system').map(m => m.content)
    const conversation = turns.filter(m => m.role !== 'system')

    // The last user turn is the "user" content buildMessages expects; earlier
    // conversation turns are preserved by prepending them after the style/system
    // preamble.
    const lastUserIndex = [ ...conversation ].reverse().findIndex(m => m.role === 'user')
    const userContent = lastUserIndex === -1
      ? ''
      : conversation[conversation.length - 1 - lastUserIndex].content

    // Fold the caller's own system prompts and the explicit payload.system into
    // one system string so nothing is lost.
    const systemParts = [ ...priorSystem ]
    if (typeof payload.system === 'string' && payload.system.trim().length > 0) {
      systemParts.push(payload.system.trim())
    }
    const system = systemParts.length > 0 ? systemParts.join('\n\n') : undefined

    const preamble = buildMessages({
      style,
      system,
      user: userContent,
      pageContext: payload.pageContext
    })

    // buildMessages returns [ ...systemMessages, { user } ]. Re-attach any
    // earlier conversation turns (everything before the final user turn) between
    // the system preamble and that final user turn so multi-turn context is kept.
    const preambleSystem = preamble.filter(m => m.role === 'system')
    const earlierTurns = lastUserIndex === -1
      ? conversation
      : conversation.slice(0, conversation.length - 1 - lastUserIndex)
    const finalUser = preamble.filter(m => m.role === 'user')

    // If the latest user turn explicitly asks to "search", ground the answer by
    // injecting a web-search RAG block as an additional system message BEFORE
    // the model call. Never throws — degrades to a short unavailable note.
    const searchContext = await this._maybeBuildSearchContext(conversation)
    const searchSystem = searchContext !== undefined ? [ searchContext ] : []

    return [ ...preambleSystem, ...searchSystem, ...earlierTurns, ...finalUser ]
  }

  /**
   * Perform a non-streaming chat completion and return the assistant text.
   */
  private async _chat (payload: {
    provider?: string
    baseURL?: string
    model?: string
    messages: ChatMessage[]
    system?: string
    pageContext?: string
    temperature?: number
    maxTokens?: number
  }): Promise<string> {
    const provider = this._resolveProvider(payload.provider)
    const baseURL = this._resolveBaseURL(provider, payload.baseURL)
    const model = this._resolveModel(provider, payload.model)
    const apiKey = await this._decryptKey(provider)
    const messages = await this._assembleMessages(payload)

    return await chatCompletion({
      baseURL,
      apiKey,
      model,
      messages,
      stream: false,
      extraHeaders: this._extraHeaders(provider),
      temperature: payload.temperature,
      maxTokens: payload.maxTokens
    })
  }

  /**
   * Perform a streaming chat completion. Each content delta is forwarded to the
   * requesting renderer via event.sender.send('ai-stream', { id, delta }). A
   * final 'ai-stream' message with `done: true` (and the full text) is sent when
   * the stream completes; an error message is sent (and the promise rejects) on
   * failure. Cancellation is supported via the 'cancel' command keyed by `id`.
   */
  private async _chatStream (event: IpcMainInvokeEvent, payload: {
    id: string
    provider?: string
    baseURL?: string
    model?: string
    messages: ChatMessage[]
    system?: string
    pageContext?: string
    temperature?: number
    maxTokens?: number
  }): Promise<{ id: string, text: string }> {
    const { id } = payload
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error('[AIProvider] chat-stream requires a string id for cancellation.')
    }

    const provider = this._resolveProvider(payload.provider)
    const baseURL = this._resolveBaseURL(provider, payload.baseURL)
    const model = this._resolveModel(provider, payload.model)
    const apiKey = await this._decryptKey(provider)
    const messages = await this._assembleMessages(payload)

    const controller = new AbortController()
    this._inFlight.set(id, controller)

    const send = (msg: Record<string, any>): void => {
      // The sender may have been destroyed (window closed) mid-stream.
      if (!event.sender.isDestroyed()) {
        event.sender.send('ai-stream', { id, ...msg })
      }
    }

    try {
      const text = await chatCompletion({
        baseURL,
        apiKey,
        model,
        messages,
        stream: true,
        signal: controller.signal,
        extraHeaders: this._extraHeaders(provider),
        temperature: payload.temperature,
        maxTokens: payload.maxTokens,
        onDelta: (delta: string) => { send({ delta }) }
      })

      send({ done: true, text })
      return { id, text }
    } catch (err: unknown) {
      const aborted = controller.signal.aborted
      const message = err instanceof Error ? err.message : String(err)
      if (aborted) {
        send({ cancelled: true })
      } else {
        send({ error: message })
      }
      throw err
    } finally {
      this._inFlight.delete(id)
    }
  }

  /**
   * Cancel an in-flight streaming request by id.
   */
  private _cancel (id: string): { cancelled: boolean } {
    const controller = this._inFlight.get(id)
    if (controller === undefined) {
      return { cancelled: false }
    }
    controller.abort()
    this._inFlight.delete(id)
    return { cancelled: true }
  }

  // ==========================================================================
  // Web search (delegated to the search module) — key stays in main
  // ==========================================================================

  /**
   * Whole-word, case-insensitive test for the literal word "search" in a user
   * turn. Only an explicit "search" mention triggers RAG grounding — this keeps
   * the feature cheap (no search on every chat) and predictable.
   */
  private _mentionsSearch (text: string): boolean {
    return /\bsearch\b/i.test(text)
  }

  /**
   * If the latest user turn explicitly asks to "search", run a web search on it
   * and return a ready-to-inject system message carrying the formatted,
   * URL-bearing RAG block. Returns `undefined` when no search word is present.
   *
   * This never throws: if no search key is configured, or the search errors /
   * quota-exhausts, a short "(web search unavailable)" system note is returned
   * instead so the chat still completes (just ungrounded).
   */
  private async _maybeBuildSearchContext (messages: ChatMessage[]): Promise<ChatMessage | undefined> {
    // Only consider the latest user turn (search is per-turn, not per-history).
    const lastUser = [ ...messages ].reverse().find(m => m.role === 'user')
    const query = typeof lastUser?.content === 'string' ? lastUser.content.trim() : ''
    if (query.length === 0 || !this._mentionsSearch(query)) {
      return undefined
    }

    const configuredProvider = this._readConfig<WebSearchProvider>('ai.searchProvider')
    const searchProvider: WebSearchProvider = configuredProvider ?? 'tavily'

    try {
      // Search keys live under a distinct namespace (see _search).
      const apiKey = await this._decryptKey(`search:${searchProvider}`)

      // Tavily and Brave require a key; DuckDuckGo does not. Degrade gracefully
      // rather than firing a guaranteed-to-fail request.
      if (apiKey === '' && searchProvider !== 'duckduckgo') {
        this._logger.warning(`[AIProvider] Chat requested a web search but no key is configured for "${searchProvider}".`)
        return {
          role: 'system',
          content: '(web search unavailable: no search provider key is configured. Answer from your own knowledge and note that live web search was unavailable.)'
        }
      }

      const response = await runSearch({ provider: searchProvider, apiKey, query })
      return { role: 'system', content: response.block }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      this._logger.warning(`[AIProvider] In-chat web search failed; continuing without grounding: ${message}`)
      return {
        role: 'system',
        content: '(web search unavailable: the search request failed. Answer from your own knowledge and note that live web search was unavailable.)'
      }
    }
  }

  /**
   * Run a web search on behalf of the AI and return the structured response +
   * ready-to-inject RAG block. The search key is decrypted here and never
   * leaves the main process.
   */
  private async _search (payload: { provider?: WebSearchProvider, query: string }): Promise<any> {
    const configuredProvider = this._readConfig<WebSearchProvider>('ai.searchProvider')
    const searchProvider: WebSearchProvider = payload.provider
      ?? (configuredProvider ?? 'tavily')

    // Search keys are stored under a distinct namespace so they never collide
    // with LLM provider keys (e.g. 'openrouter').
    const apiKey = await this._decryptKey(`search:${searchProvider}`)

    return await runSearch({
      provider: searchProvider,
      apiKey,
      query: payload.query
    })
  }

  // ==========================================================================
  // "Write in My Style" file
  // ==========================================================================

  /**
   * Resolve the absolute path to the "Write in My Style" file. A configured
   * `ai.styleFilePath` (added by a sibling agent) wins; otherwise fall back to
   * the userData default computed in the constructor.
   */
  private _resolveStyleFile (): string {
    const configured = this._readConfig<string>('ai.styleFilePath')
    if (typeof configured === 'string' && configured.trim().length > 0) {
      return configured.trim()
    }
    return this._styleFile
  }

  /**
   * Read the "Write in My Style" guide. Returns '' if the file does not exist.
   */
  private async _getStyle (): Promise<string> {
    try {
      return await fs.readFile(this._resolveStyleFile(), { encoding: 'utf-8' })
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        return ''
      }
      throw err
    }
  }

  /**
   * Write the "Write in My Style" guide.
   *
   * @param   {string}  content  The new style-guide contents
   *
   * @return  {Promise<{ saved: boolean }>}  Result flag
   */
  private async _setStyle (content: string): Promise<{ saved: boolean }> {
    const text = typeof content === 'string' ? content : ''
    await fs.writeFile(this._resolveStyleFile(), text, { encoding: 'utf-8' })
    return { saved: true }
  }
}
