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
import {
  reconcileCommands,
  type AICommandConfig,
  type AICommandFlow
} from 'source/app/service-providers/ai/ai-commands'

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
 * The selection the AI panel's command chooser will act upon. Captured when the
 * selection bubble's "Command" button is clicked (i.e. before any concrete
 * command has been chosen), so the panel can offer the preset buttons / the
 * free-text instruction input and run whichever the user picks against exactly
 * this text.
 */
export interface AIPendingSelection {
  /**
   * The selected text the chosen command will be applied to.
   */
  text: string
  /**
   * Optional whole-document context passed along with the command.
   */
  pageContext?: string
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
   * The options for the Summarize flow: 7 shorter rewrites for short input,
   * or 3 document summaries (TL;DR / comprehensive / outline) for long input.
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
 * model per the Mint Stylus spec (short-input rewrite mode).
 */
export const SUMMARIZE_OPTION_COUNT = 7

/**
 * Selections at or above this many characters are treated as "long" input
 * (e.g. a whole page): instead of 7 one-line rewrites, Summarize requests a
 * real document summary (TL;DR / comprehensive / outline — 3 options).
 */
export const SUMMARIZE_LONG_INPUT_THRESHOLD = 600

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
       * Opens a native folder picker and resolves with the chosen absolute path
       * (or '' if cancelled).
       */
      pickContextFolder: () => Promise<string>
      /**
       * Probes a context source and resolves with a short human status string.
       */
      testContext: (payload: { source: string, folder?: string, url?: string }) => Promise<string>
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

  /**
   * The selection the command chooser (panel `command` mode before any command
   * has run) will act upon. Set by App.vue when the selection bubble's
   * "Command" button is clicked; null when no selection has been captured.
   */
  const pendingSelection = ref<AIPendingSelection|null>(null)

  /**
   * The user-editable AI command set, mirrored from the `ai.commands` config
   * key (reconciled to a clean, non-empty list). Drives the command chooser and
   * every named command run. Kept in sync with the config via reloadCommands(),
   * which is called whenever the command panel is (re)opened so edits made in
   * Preferences take effect without a restart.
   */
  const commands = ref<AICommandConfig[]>(reconcileCommands(readCommandsConfig()))

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
   * Remembers (or clears) the selection the command chooser should act upon.
   * Called by the editor host (App.vue) when the selection bubble's "Command"
   * button captures a selection, BEFORE the panel is opened in command mode.
   *
   * @param  {AIPendingSelection|null}  selection  The captured selection, or
   *                                               null to clear it.
   */
  function setPendingSelection (selection: AIPendingSelection|null): void {
    pendingSelection.value = selection
    // Entering command mode: refresh the command set so the chooser reflects any
    // edits/additions made in Preferences since the last time it was shown.
    reloadCommands()
  }

  /**
   * Reads the raw `ai.commands` value from the config bridge. Isolated + guarded
   * so the store still works in contexts without a config bridge (tests), where
   * it falls back to the built-in defaults via reconcileCommands.
   *
   * @return  {unknown}  The raw stored value, or undefined if unavailable.
   */
  function readCommandsConfig (): unknown {
    try {
      return window.config?.get('ai.commands')
    } catch (err) {
      console.error('Could not read ai.commands from config', err)
      return undefined
    }
  }

  /**
   * Re-reads and reconciles the command set from config. Cheap; safe to call on
   * every command-mode entry so Preferences edits apply without a restart.
   */
  function reloadCommands (): void {
    commands.value = reconcileCommands(readCommandsConfig())
  }

  /**
   * Runs the Summarize command on the given selected text. The prompt adapts
   * to the input length:
   *
   *  - SHORT input (< SUMMARIZE_LONG_INPUT_THRESHOLD chars): exactly
   *    SUMMARIZE_OPTION_COUNT (7) rewrite options, each REQUIRED to be shorter
   *    than the original.
   *  - LONG input (a full page): exactly 3 real document summaries — a TL;DR
   *    paragraph, a comprehensive section-by-section summary, and a bullet
   *    outline — separated by "===" lines so multi-paragraph options survive
   *    parsing.
   *
   * @param   {string}  selectedText  The editor selection to summarize.
   *
   * @return  {Promise<void>}
   */
  async function runSummarize (selectedText: string): Promise<void> {
    openPanel('summarize')
    inFlight.value = true

    const isLongInput = selectedText.length >= SUMMARIZE_LONG_INPUT_THRESHOLD

    const systemPrompt = isLongInput
      ? [
        'You are a document summarization assistant. The user will give you a full document. Produce exactly 3 alternative summaries of it, separated by a line containing only "===".',
        'Option 1: A one-paragraph TL;DR of the whole document (3-5 sentences).',
        'Option 2: A comprehensive multi-paragraph summary that covers EVERY section and topic of the document, in order. It must summarize the whole document from beginning to end — never just the opening — and should be roughly 15-25% of the length of the original.',
        'Option 3: A structured bullet outline of the entire document: one bullet per major section, with indented sub-points for the key details of that section.',
        'Output ONLY the three summaries with a line containing exactly "===" between them. Do not add any commentary, introductions, headings, or labels such as "Here is..." or "Option 1:".'
      ].join('\n')
      : `You are a writing assistant. Rewrite the user's text into exactly ${SUMMARIZE_OPTION_COUNT} distinct, concise summaries that preserve the original meaning. Each rewrite MUST be shorter than the original text: use fewer words than the input, preserve its meaning, and add no commentary. Respond with exactly ${SUMMARIZE_OPTION_COUNT} lines, one summary per line, each prefixed with "- ". Do not add any commentary, headings, bold, or quotation marks.`

    const messages: AIChatMessage[] = [
      { role: 'system', content: systemPrompt },
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
   * Runs a named AI command by its id (e.g. `SHORTEN`, `SUMMARIZE`, or a custom
   * `custom-1`) on the given input, optionally with the whole-page context. The
   * command's editable prompt and `flow` are read from the reconciled command
   * set, so the behaviour follows whatever the user configured:
   *
   *  - `stream`    flow → the answer streams into `panelContent.text` (command mode).
   *  - `summarize` flow → the answer is parsed into clickable options the user
   *                       can apply over their selection (summarize mode).
   *
   * @param   {string}  id           The command id.
   * @param   {string}  input        The primary input (usually the selection).
   * @param   {string}  pageContext  Optional whole-document context.
   *
   * @return  {Promise<void>}
   */
  async function runCommand (id: string, input: string, pageContext?: string): Promise<void> {
    // Pick up any edits made in Preferences without needing a restart.
    reloadCommands()
    const cmd = commands.value.find(command => command.id === id)
    // Fall back to a generic instruction when the command is unknown OR its
    // prompt is still blank (a freshly-added command the user hasn't filled in),
    // so a run never sends an empty system prompt.
    const prompt = (cmd !== undefined && cmd.prompt.trim() !== '')
      ? cmd.prompt
      : `You are the "${id}" command of a markdown editor. Respond in markdown.`
    const flow: AICommandFlow = cmd?.flow ?? 'stream'

    if (flow === 'summarize') {
      await runCommandSummarizeFlow(prompt, input, pageContext)
    } else {
      await runCommandStreamFlow(id, prompt, input, pageContext)
    }
  }

  /**
   * Builds the (system + user) messages for a command run, scoping the TASK to
   * the selection while still giving the model the whole document as context.
   *
   * When a distinct page context exists (i.e. the user highlighted a portion of
   * a larger document), the user message explicitly marks the selection as the
   * ONLY text to act on and demotes the full document to clearly-labelled
   * background context — so a command like Shorten/Summarize transforms just the
   * highlighted text, never the whole page, even though the whole page is sent.
   * When there is no distinct selection (the command acts on the whole page, e.g.
   * run from the menu with nothing highlighted), the input is used as-is.
   *
   * @param   {string}  prompt       The command's system prompt.
   * @param   {string}  input        The selection (or the whole page).
   * @param   {string}  pageContext  Optional whole-document context.
   *
   * @return  {AIChatMessage[]}      The ordered [system, user] messages.
   */
  function buildCommandMessages (prompt: string, input: string, pageContext?: string): AIChatMessage[] {
    const page = (pageContext ?? '').trim()
    const scoped = page !== '' && page !== input.trim()
    const userContent = scoped
      ? [
        'Apply the command to the SELECTED TEXT only. Return ONLY the transformed version of the selected text — do not rewrite, repeat, summarise, or include the rest of the document. The full document is provided afterwards purely as background context to inform the result.',
        '',
        '----- SELECTED TEXT (act on THIS, and only this) -----',
        input,
        '----- END SELECTED TEXT -----',
        '',
        '----- FULL DOCUMENT (context only — do NOT act on this) -----',
        page,
        '----- END FULL DOCUMENT -----'
      ].join('\n')
      : input
    return [
      { role: 'system', content: prompt },
      { role: 'user', content: userContent }
    ]
  }

  /**
   * Streams a command's markdown answer into `panelContent.text` (command mode).
   *
   * @param   {string}  id           The command id (for error logging only).
   * @param   {string}  prompt       The command's system prompt.
   * @param   {string}  input        The text to act upon.
   * @param   {string}  pageContext  Optional whole-document context.
   */
  async function runCommandStreamFlow (id: string, prompt: string, input: string, pageContext?: string): Promise<void> {
    openPanel('command')
    inFlight.value = true
    panelContent.value = { ...emptyPanelContent(), text: '' }

    // The page (if distinct from the selection) is embedded in the user message
    // as clearly-labelled CONTEXT ONLY, so pageContext is NOT passed separately
    // (that would inject a second, ambiguous "the whole document" system message).
    const messages = buildCommandMessages(prompt, input, pageContext)

    try {
      // Pass the delta sink INTO chatStream so it is subscribed before the
      // request is dispatched; the promise resolves once the stream completes.
      await window.ai.chatStream({
        provider: currentProvider.value || undefined,
        model: currentModel.value || undefined,
        messages
      }, (delta: string) => {
        panelContent.value.text += delta
      })
    } catch (err: any) {
      console.error(`AI command "${id}" failed`, err)
      panelContent.value.text = `Command failed: ${err?.message ?? String(err)}`
    } finally {
      inFlight.value = false
    }
  }

  /**
   * Runs a command in the summarize flow: a single (non-streaming) request whose
   * answer is parsed into clickable options (summarize mode). Clicking an option
   * replaces the pending selection, exactly like the dedicated Summarize action.
   *
   * @param   {string}  prompt       The command's system prompt.
   * @param   {string}  input        The text to act upon.
   * @param   {string}  pageContext  Optional whole-document context.
   */
  async function runCommandSummarizeFlow (prompt: string, input: string, pageContext?: string): Promise<void> {
    openPanel('summarize')
    inFlight.value = true

    // Page embedded as context-only inside the user message (see buildCommandMessages);
    // pageContext is not passed separately.
    const messages = buildCommandMessages(prompt, input, pageContext)

    try {
      const response = await window.ai.chat({
        provider: currentProvider.value || undefined,
        model: currentModel.value || undefined,
        messages
      })
      const options = parseSummarizeOptions(response)
      panelContent.value = { ...emptyPanelContent(), options }
    } catch (err: any) {
      console.error('AI command (summarize flow) failed', err)
      panelContent.value = {
        ...emptyPanelContent(),
        text: `Command failed: ${err?.message ?? String(err)}`
      }
    } finally {
      inFlight.value = false
    }
  }

  /**
   * Runs a free-text (user-written) instruction against the given text —
   * the command chooser's "Or tell the AI what to do with the selection…"
   * path. The result streams into `panelContent.text` exactly like a preset
   * command run through `runCommand`.
   *
   * @param   {string}  instruction  The user's instruction (what to do).
   * @param   {string}  text         The text to apply the instruction to.
   * @param   {string}  pageContext  Optional whole-document context.
   *
   * @return  {Promise<void>}
   */
  async function runCustomCommand (instruction: string, text: string, pageContext?: string): Promise<void> {
    openPanel('command')
    inFlight.value = true
    panelContent.value = { ...emptyPanelContent(), text: '' }

    const messages: AIChatMessage[] = [
      {
        role: 'system',
        content: 'You are an editing assistant inside a markdown editor. Apply the user\'s instruction to the provided text. Respond in markdown with ONLY the result.'
      },
      { role: 'user', content: instruction + '\n\n---\n\n' + text }
    ]

    try {
      // As in runCommand: pass the delta sink INTO chatStream so it is
      // subscribed before the request is dispatched.
      await window.ai.chatStream({
        provider: currentProvider.value || undefined,
        model: currentModel.value || undefined,
        messages,
        pageContext
      }, (delta: string) => {
        panelContent.value.text += delta
      })
    } catch (err: any) {
      console.error('AI custom command failed', err)
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
    pendingSelection,
    commands,
    // Getters
    canRecover,
    // Actions
    openPanel,
    closePanel,
    setPendingSelection,
    reloadCommands,
    runSummarize,
    pushSummarizeReplacement,
    recoverLast,
    runCommand,
    runCustomCommand,
    askConversation
  }
})

/**
 * A line consisting solely of "===" (surrounding whitespace allowed) — the
 * separator used by the long-input document summary format.
 */
const SUMMARIZE_SEPARATOR_RE = /^[ \t]*===[ \t]*$/m

/**
 * Parses a model's Summarize reply into individual options. Handles BOTH
 * Summarize formats:
 *
 *  1. "==="-separated blocks (long-input document summaries): if the response
 *     contains a line that is exactly `===` (whitespace allowed), it is split
 *     on those lines and each trimmed, non-empty block becomes one option.
 *     Blocks are kept verbatim otherwise, so multi-paragraph summaries and
 *     bullet outlines survive intact.
 *  2. Bullet/numbered lines (short-input rewrites): accepts "- "/"* " bullet
 *     lines or "1." numbered lines, trims surrounding quotes and whitespace,
 *     drops blanks, and caps the result at SUMMARIZE_OPTION_COUNT.
 *
 * @param   {string}               response  The raw model text.
 *
 * @return  {AISummarizeOption[]}            The parsed options.
 */
export function parseSummarizeOptions (response: string): AISummarizeOption[] {
  if (SUMMARIZE_SEPARATOR_RE.test(response)) {
    return response
      .split(/^[ \t]*===[ \t]*$/gm)
      .map(block => block.trim())
      .filter(block => block.length > 0)
      .slice(0, SUMMARIZE_OPTION_COUNT)
      .map(text => ({ text }))
  }

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
