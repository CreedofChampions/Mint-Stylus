/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        useAIStore
 * CVM-Role:        Model
 * Maintainer:      Mint Stylus (AI-generated)
 * License:         GNU GPL v3
 *
 * Description:     This model manages the renderer-side AI state for Mint
 *                  Stylus. It holds the currently-selected provider and model,
 *                  the state of the AI panel (open/closed, its mode and
 *                  contents), whether a request is in flight, and the
 *                  Summarize replace/recover stack. All actual HTTP work and
 *                  every API key live only in the Electron main process (the
 *                  AIProvider); this store talks to it exclusively through the
 *                  narrow `window.ai` preload bridge and never sees a key.
 *
 *                  NOTE: This file was created by AI for Mint Stylus.
 *
 * END HEADER
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/**
 * A single chat message, mirroring the OpenAI chat-completions shape that every
 * supported backend (OpenRouter / Z.ai / Ollama) speaks.
 */
export interface AIChatMessage {
  role: 'system'|'user'|'assistant'
  content: string
}

/**
 * A model as returned by the provider's `list-models` command. Only the fields
 * the renderer actually needs are typed here; the raw provider payload may
 * carry more.
 */
export interface AIModel {
  /**
   * The model identifier passed back to the provider on a chat request (e.g.
   * `z-ai/glm-5.2`).
   */
  id: string
  /**
   * An optional human-friendly name for display in menus/dropdowns.
   */
  name?: string
  /**
   * The context length in tokens, if the provider reports it.
   */
  contextLength?: number
}

/**
 * The mode the AI panel is currently rendering. `idle` means the panel is
 * (typically) closed or has nothing to show yet.
 */
export type AIPanelMode = 'summarize'|'command'|'conversation'|'idle'

/**
 * A single rewrite option produced by the Summarize command.
 */
export interface AISummarizeOption {
  /**
   * The suggested replacement text for the current selection.
   */
  text: string
}

/**
 * A single stashed replacement, remembered so the user can Recover the original
 * text after a Summarize option was applied to the editor. `from`/`to` are the
 * document offsets the replacement occupied, and `original` is the text that
 * used to live there.
 */
export interface AIRecoverEntry {
  from: number
  to: number
  original: string
}

/**
 * The structured contents rendered by the AI panel. Which member is populated
 * depends on `panelMode`:
 *  - `summarize`     → `options`
 *  - `command`       → `text`
 *  - `conversation`  → `messages`
 */
export interface AIPanelContent {
  /**
   * The 7 rewrite options for the Summarize flow.
   */
  options: AISummarizeOption[]
  /**
   * The (possibly streaming) text output of a one-shot command.
   */
  text: string
  /**
   * The running conversation transcript.
   */
  messages: AIChatMessage[]
}

function emptyPanelContent (): AIPanelContent {
  return { options: [], text: '', messages: [] }
}

/**
 * The number of Summarize options we request from, and expect back from, the
 * model per the Mint Stylus spec.
 */
export const SUMMARIZE_OPTION_COUNT = 7

/**
 * The narrow AI bridge that a sibling preload agent exposes on `window.ai`.
 * Declared as an ambient augmentation of the existing `Window` interface (see
 * `source/global.d.ts`). The preload script owns the runtime; this only types
 * it so the store type-checks. NO API key ever crosses this bridge outward —
 * every method either sends a request or receives text/deltas back.
 */
declare global {
  interface Window {
    ai: {
      /**
       * One-shot (non-streaming) chat completion. Resolves with the assistant's
       * full text response.
       */
      chat: (payload: {
        provider?: string
        model?: string
        messages: AIChatMessage[]
        pageContext?: string
      }) => Promise<string>
      /**
       * Streaming chat completion. Subscribes `onDelta` (if given) BEFORE the
       * request is dispatched, so every delta is received, then resolves with
       * the request id once the stream has completed (the id can be passed to
       * `cancel`). Deltas can alternatively be consumed via `onStream(id, cb)`,
       * but callers must subscribe before awaiting — prefer the `onDelta` form.
       */
      chatStream: (payload: {
        provider?: string
        model?: string
        messages: AIChatMessage[]
        pageContext?: string
      }, onDelta?: (delta: string) => void) => Promise<string>
      /**
       * Lists the models available from the current (or given) provider.
       */
      listModels: (provider?: string) => Promise<AIModel[]>
      /**
       * Validates the stored key for a provider (e.g. quota check). Resolves
       * true if the key is usable.
       */
      validateKey: (provider: string) => Promise<boolean>
      /**
       * Persists (encrypts, in main) an API key for a provider. The plaintext
       * only travels inbound at save time; it is never read back out.
       */
      saveKey: (provider: string, key: string) => Promise<boolean>
      /**
       * Whether a key is stored for the given provider.
       */
      hasKey: (provider: string) => Promise<boolean>
      /**
       * Removes the stored key for a provider.
       */
      deleteKey: (provider: string) => Promise<boolean>
      /**
       * Runs a web search in main and resolves with a formatted, URL-bearing
       * results block for RAG injection.
       */
      search: (query: string) => Promise<string>
      /**
       * Reads the current "Write in My Style" precursor text.
       */
      getStyle: () => Promise<string>
      /**
       * Writes the "Write in My Style" precursor text.
       */
      setStyle: (style: string) => Promise<boolean>
      /**
       * Subscribes to stream deltas. The callback fires for every delta that
       * matches `id`. Returns an unsubscribe function.
       */
      onStream: (id: string, callback: (delta: string) => void) => () => void
      /**
       * Aborts an in-flight streaming request by its id.
       */
      cancel: (id: string) => void
    }
  }
}

export const useAIStore = defineStore('ai', () => {
  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------

  /**
   * The currently selected provider slug (e.g. `openrouter`). Empty until the
   * user (or config) picks one.
   */
  const currentProvider = ref<string>('')

  /**
   * The currently selected model id (e.g. `z-ai/glm-5.2`).
   */
  const currentModel = ref<string>('')

  /**
   * Whether the AI panel is currently visible.
   */
  const panelOpen = ref<boolean>(false)

  /**
   * What the AI panel is currently rendering.
   */
  const panelMode = ref<AIPanelMode>('idle')

  /**
   * The structured contents the panel renders, keyed by mode.
   */
  const panelContent = ref<AIPanelContent>(emptyPanelContent())

  /**
   * Whether an AI request is currently in flight (used to show spinners and to
   * guard against concurrent requests from the same surface).
   */
  const inFlight = ref<boolean>(false)

  /**
   * The stack of stashed Summarize replacements, most-recent last. Each entry
   * lets the user Recover (undo) a replacement that was applied to the editor.
   */
  const recoverStack = ref<AIRecoverEntry[]>([])

  // ---------------------------------------------------------------------------
  // GETTERS
  // ---------------------------------------------------------------------------

  /**
   * Whether there is at least one Summarize replacement that can be recovered.
   */
  const canRecover = computed<boolean>(() => recoverStack.value.length > 0)

  // ---------------------------------------------------------------------------
  // ACTIONS
  // ---------------------------------------------------------------------------

  /**
   * Opens the AI panel in the given mode, resetting its contents to a clean
   * slate for that mode.
   *
   * @param  {AIPanelMode}  mode  The mode to open the panel in.
   */
  function openPanel (mode: AIPanelMode): void {
    panelMode.value = mode
    panelContent.value = emptyPanelContent()
    panelOpen.value = true
  }

  /**
   * Closes the AI panel and returns it to the idle mode. Contents and the
   * recover stack are preserved so a re-open can continue where it left off.
   */
  function closePanel (): void {
    panelOpen.value = false
    panelMode.value = 'idle'
  }

  /**
   * Runs the Summarize command on the given selected text, requesting exactly
   * SUMMARIZE_OPTION_COUNT (7) rewrite options and rendering them in the panel.
   *
   * @param   {string}  selectedText  The editor selection to summarize.
   *
   * @return  {Promise<void>}
   */
  async function runSummarize (selectedText: string): Promise<void> {
    openPanel('summarize')
    inFlight.value = true

    const messages: AIChatMessage[] = [
      {
        role: 'system',
        content: `You are a writing assistant. Rewrite the user's text into exactly ${SUMMARIZE_OPTION_COUNT} distinct, concise summaries that preserve the original meaning. Respond with exactly ${SUMMARIZE_OPTION_COUNT} lines, one summary per line, each prefixed with "- ". Do not add any commentary, headings, bold, or quotation marks.`
      },
      { role: 'user', content: selectedText }
    ]

    try {
      const response = await window.ai.chat({
        provider: currentProvider.value || undefined,
        model: currentModel.value || undefined,
        messages
      })

      const options = parseSummarizeOptions(response)
      panelContent.value = { ...emptyPanelContent(), options }
    } catch (err: any) {
      console.error('AI Summarize failed', err)
      panelContent.value = {
        ...emptyPanelContent(),
        text: `Summarize failed: ${err?.message ?? String(err)}`
      }
    } finally {
      inFlight.value = false
    }
  }

  /**
   * Stashes an original selection range + text onto the recover stack, so a
   * subsequently-applied Summarize replacement can be undone. Called by the
   * editor surface right before it dispatches the replacement change.
   *
   * @param  {AIRecoverEntry}  entry  The range and original text to remember.
   */
  function pushSummarizeReplacement (entry: AIRecoverEntry): void {
    recoverStack.value.push(entry)
  }

  /**
   * Pops the most-recent stashed replacement so the editor surface can dispatch
   * a reverse change. Returns undefined when nothing is left to recover.
   *
   * @return  {AIRecoverEntry|undefined}  The entry to reverse, or undefined.
   */
  function recoverLast (): AIRecoverEntry|undefined {
    return recoverStack.value.pop()
  }

  /**
   * Runs a named AI command (e.g. Shorten Text, Synonyms, Challenge Idea) on
   * the given input, optionally with the whole-page context. The result streams
   * into `panelContent.text`.
   *
   * @param   {string}  name         The command preset name.
   * @param   {string}  input        The primary input (usually the selection).
   * @param   {string}  pageContext  Optional whole-document context.
   *
   * @return  {Promise<void>}
   */
  async function runCommand (name: string, input: string, pageContext?: string): Promise<void> {
    openPanel('command')
    inFlight.value = true
    panelContent.value = { ...emptyPanelContent(), text: '' }

    const messages: AIChatMessage[] = [
      { role: 'system', content: `You are the "${name}" command of a markdown editor. Respond in markdown.` },
      { role: 'user', content: input }
    ]

    try {
      // Pass the delta sink INTO chatStream so it is subscribed before the
      // request is dispatched; the promise resolves once the stream completes.
      await window.ai.chatStream({
        provider: currentProvider.value || undefined,
        model: currentModel.value || undefined,
        messages,
        pageContext
      }, (delta: string) => {
        panelContent.value.text += delta
      })
    } catch (err: any) {
      console.error(`AI command "${name}" failed`, err)
      panelContent.value.text = `Command failed: ${err?.message ?? String(err)}`
    } finally {
      inFlight.value = false
    }
  }

  /**
   * Sends a message in the conversation flow. Appends the user's message,
   * streams the assistant's reply into the last message, and keeps the running
   * transcript in `panelContent.messages`.
   *
   * @param   {string}  text  The user's message.
   *
   * @return  {Promise<void>}
   */
  async function askConversation (text: string): Promise<void> {
    // Ensure we're in conversation mode without wiping an existing transcript.
    if (panelMode.value !== 'conversation') {
      openPanel('conversation')
    }
    panelOpen.value = true

    inFlight.value = true

    // Append the user's turn and a placeholder assistant turn we stream into.
    panelContent.value.messages.push({ role: 'user', content: text })
    const assistantIdx = panelContent.value.messages.push({ role: 'assistant', content: '' }) - 1

    const messages: AIChatMessage[] = panelContent.value.messages
      .slice(0, assistantIdx) // everything up to (not including) the placeholder
      .map(m => ({ role: m.role, content: m.content }))

    try {
      await window.ai.chatStream({
        provider: currentProvider.value || undefined,
        model: currentModel.value || undefined,
        messages
      }, (delta: string) => {
        const msg = panelContent.value.messages[assistantIdx]
        if (msg !== undefined) {
          msg.content += delta
        }
      })
    } catch (err: any) {
      console.error('AI conversation failed', err)
      const msg = panelContent.value.messages[assistantIdx]
      if (msg !== undefined) {
        msg.content = `Conversation failed: ${err?.message ?? String(err)}`
      }
    } finally {
      inFlight.value = false
    }
  }

  return {
    // State
    currentProvider,
    currentModel,
    panelOpen,
    panelMode,
    panelContent,
    inFlight,
    recoverStack,
    // Getters
    canRecover,
    // Actions
    openPanel,
    closePanel,
    runSummarize,
    pushSummarizeReplacement,
    recoverLast,
    runCommand,
    askConversation
  }
})

/**
 * Parses a model's Summarize reply into individual options. Accepts either
 * "- "/"* " bullet lines or "1." numbered lines, trims surrounding quotes and
 * whitespace, drops blanks, and caps the result at SUMMARIZE_OPTION_COUNT.
 *
 * @param   {string}               response  The raw model text.
 *
 * @return  {AISummarizeOption[]}            The parsed options.
 */
export function parseSummarizeOptions (response: string): AISummarizeOption[] {
  return response
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => line
      // Strip a leading bullet ("- ", "* ", "• ") or numbering ("1.", "2)")
      .replace(/^[-*•]\s+/, '')
      .replace(/^\d+[.)]\s+/, '')
      // Strip surrounding straight/curly quotes
      .replace(/^["'“”‘’]+/, '')
      .replace(/["'“”‘’]+$/, '')
      .trim()
    )
    .filter(text => text.length > 0)
    .slice(0, SUMMARIZE_OPTION_COUNT)
    .map(text => ({ text }))
}
