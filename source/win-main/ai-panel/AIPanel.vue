<template>
  <div id="ai-panel">
    <!-- HEADER: current model + close button -->
    <div class="ai-panel-header">
      <span class="ai-panel-title">{{ headerTitle }}</span>
      <span class="ai-panel-model" v-bind:title="modelTitle">{{ modelLabel }}</span>
      <button
        type="button"
        class="ai-panel-close"
        v-bind:title="trans('Close')"
        v-on:click="close"
      >
        <cds-icon shape="times"></cds-icon>
      </button>
    </div>

    <div class="ai-panel-body">
      <!-- In-flight spinner (shared across modes) -->
      <p v-if="aiStore.inFlight" class="ai-panel-status">
        {{ trans('Thinking…') }}
      </p>

      <!-- ==================================================================
           SUMMARIZE MODE: 7 clickable options + recover stack
           ================================================================== -->
      <template v-if="aiStore.panelMode === 'summarize'">
        <p v-if="!aiStore.inFlight && options.length === 0" class="ai-panel-empty">
          {{ trans('No summaries yet. Select some text and run Summarize.') }}
        </p>

        <ul v-if="options.length > 0" class="ai-summarize-options">
          <li
            v-for="(option, idx) in options"
            v-bind:key="idx"
            class="ai-summarize-option"
            v-bind:title="trans('Click to replace the selected text with this summary')"
            v-on:click="applyOption(option.text)"
          >
            <span class="option-bullet">•</span>
            <span class="option-text">{{ option.text }}</span>
            <button
              type="button"
              class="ai-copy-btn ai-copy-btn-inline"
              v-bind:title="trans('Copy this option')"
              v-on:click.stop="copyText(option.text, 'opt' + idx)"
            >{{ copiedId === 'opt' + idx ? trans('Copied') : trans('Copy') }}</button>
          </li>
        </ul>

        <!-- Saved originals from the recover stack, most-recent first -->
        <template v-if="recoverStack.length > 0">
          <hr>
          <p class="ai-panel-subheading">{{ trans('Recover replaced text') }}</p>
          <ul class="ai-recover-list">
            <li
              v-for="(entry, idx) in reversedRecoverStack"
              v-bind:key="entry.from + ':' + entry.to + ':' + idx"
              class="ai-recover-entry"
            >
              <span class="recover-text">{{ entry.original }}</span>
              <ButtonControl
                v-bind:label="trans('Recover')"
                v-bind:inline="true"
                v-on:click="recover(entry)"
              ></ButtonControl>
            </li>
          </ul>
        </template>
      </template>

      <!-- ==================================================================
           COMMAND MODE: command chooser, then streamed / final markdown output
           ================================================================== -->
      <template v-else-if="aiStore.panelMode === 'command'">
        <!-- What the chosen command will act (or acted) on -->
        <p v-if="selectionExcerpt !== ''" class="ai-command-selection">
          {{ trans('Selection') }}: <em>{{ selectionExcerpt }}</em>
        </p>

        <!-- COMMAND CHOOSER: no command has produced output yet, but we have a
             captured selection — offer the five presets plus a free-text
             instruction so the panel is always actionable. -->
        <template v-if="showCommandChooser">
          <p class="ai-panel-subheading">
            {{ trans('What should the AI do with the selection?') }}
          </p>
          <div class="ai-command-chooser">
            <button
              v-for="cmd in commandList"
              v-bind:key="cmd.id"
              type="button"
              class="ai-command-preset"
              v-bind:title="commandTitle(cmd)"
              v-bind:disabled="aiStore.inFlight"
              v-on:click="runPreset(cmd.id)"
            >
              {{ cmd.name }}
            </button>
          </div>
          <p class="ai-command-chooser-hint">
            {{ trans('Edit these commands, change their prompts, or add your own in Preferences → AI.') }}
          </p>
          <form class="ai-command-custom-form" v-on:submit.prevent="runCustom">
            <input
              v-model="customInstruction"
              type="text"
              class="ai-command-custom-input"
              v-bind:placeholder="trans('One-off custom command: type what to do with the selection…')"
              v-bind:disabled="aiStore.inFlight"
              autocomplete="off"
              spellcheck="true"
            >
            <button
              type="submit"
              class="ai-command-custom-run"
              v-bind:disabled="aiStore.inFlight || customInstruction.trim() === ''"
            >
              {{ trans('Run') }}
            </button>
          </form>
        </template>

        <p
          v-else-if="!aiStore.inFlight && commandText.length === 0"
          class="ai-panel-empty"
        >
          {{ trans('No output yet. Run an AI command to see its result here.') }}
        </p>
        <!--
          We render sanitized markdown as HTML for readability, but the raw
          markdown source stays the source of truth. sanitizeHTML runs the
          content through DOMPurify, so this is safe. If you would rather see
          the untouched markdown, toggle the raw view below.
          eslint-disable-next-line vue/no-v-html
        -->
        <div v-if="commandText.length > 0" class="ai-output-block">
          <button
            type="button"
            class="ai-copy-btn"
            v-bind:title="trans('Copy this text')"
            v-on:click="copyText(commandText, 'cmd')"
          >{{ copiedId === 'cmd' ? trans('Copied') : trans('Copy') }}</button>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="ai-command-output" v-html="renderedCommandHTML"></div>
        </div>
      </template>

      <!-- ==================================================================
           CONVERSATION MODE: message list + input box
           ================================================================== -->
      <template v-else-if="aiStore.panelMode === 'conversation'">
        <div class="ai-conversation">
          <div
            v-for="(message, idx) in messages"
            v-bind:key="idx"
            v-bind:class="['ai-message', 'ai-message-' + message.role]"
          >
            <span class="ai-message-role">
              {{ roleLabel(message.role) }}
              <button
                type="button"
                class="ai-copy-btn ai-copy-btn-inline"
                v-bind:title="trans('Copy this message')"
                v-on:click="copyText(message.content, 'msg' + idx)"
              >{{ copiedId === 'msg' + idx ? trans('Copied') : trans('Copy') }}</button>
            </span>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div class="ai-message-content" v-html="renderMarkdown(message.content)"></div>
          </div>
          <p
            v-if="messages.length === 0 && !aiStore.inFlight"
            class="ai-panel-empty"
          >
            {{ trans('Start a conversation by typing a message below.') }}
          </p>
        </div>

        <form class="ai-conversation-form" v-on:submit.prevent="sendMessage">
          <input
            ref="conversationInput"
            v-model="draft"
            type="text"
            class="ai-conversation-input"
            v-bind:placeholder="trans('Type a message…')"
            v-bind:disabled="aiStore.inFlight"
            autocomplete="off"
            spellcheck="true"
          >
          <button
            type="submit"
            class="ai-conversation-send"
            v-bind:disabled="aiStore.inFlight || draft.trim() === ''"
            v-bind:title="trans('Send')"
          >
            <cds-icon shape="arrow" direction="right"></cds-icon>
          </button>
        </form>
      </template>

      <!-- IDLE / fallback -->
      <template v-else>
        <p class="ai-panel-empty">
          {{ trans('The AI panel will show summaries, command output, and conversations here.') }}
        </p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        AIPanel
 * CVM-Role:        View
 * Maintainer:      Mint Stylus
 * License:         GNU GPL v3
 *
 * Description:     AI-CREATED FOR MINT STYLUS.
 *                  The left-pane AI panel. It renders whatever the current AI
 *                  action produced, driven entirely off the `useAIStore` Pinia
 *                  store (source/pinia/ai.ts). Three modes:
 *
 *                    - 'summarize'    → the 7 rewrite options as clickable
 *                                       bullets (clicking one replaces the
 *                                       editor selection), plus the saved
 *                                       originals from the recover stack, each
 *                                       with a Recover button.
 *                    - 'command'      → BEFORE any command has run: a command
 *                                       chooser (the five preset buttons plus a
 *                                       free-text instruction input) acting on
 *                                       the store's pendingSelection. AFTER a
 *                                       command ran: the streamed/final markdown
 *                                       output, rendered as DOMPurify-sanitized
 *                                       HTML (raw markdown is the source of
 *                                       truth).
 *                    - 'conversation' → a simple message list + input box.
 *
 *                  A small header shows the current model and a close button.
 *
 *                  This component performs NO HTTP work and never touches an API
 *                  key — every request goes through the store, which talks to
 *                  the Electron main-process AIProvider over the narrow
 *                  `window.ai` preload bridge. The one seam this component does
 *                  not own is the actual editor mutation: applying a summary or
 *                  recovering the original is a CodeMirror `view.dispatch`, so
 *                  this component EMITS the change for the editor host (App.vue /
 *                  MainEditor) to dispatch. See the emits below.
 *
 * END HEADER
 */

import { ref, computed, nextTick, watch } from 'vue'
import { trans } from 'source/common/i18n-renderer'
import { sanitizeHTML } from 'source/common/util/sanitize-html'
import ButtonControl from 'source/common/vue/form/elements/ButtonControl.vue'
import { useAIStore, type AIRecoverEntry, type AIChatMessage } from 'source/pinia/ai'
import { type AICommandConfig } from 'source/app/service-providers/ai/ai-commands'

const aiStore = useAIStore()

const emit = defineEmits<{
  /**
   * Emitted when the user clicks a Summarize option. The editor host is
   * responsible for actually replacing the pending selection via a CodeMirror
   * dispatch (`view.dispatch({ changes: { from, to, insert } })`) and for
   * stashing the original onto the store's recover stack
   * (`aiStore.pushSummarizeReplacement(...)`) BEFORE it dispatches. We only
   * carry the chosen replacement text; the host holds the authoritative
   * {from,to} of the pending selection.
   */
  (e: 'replace-selection', insert: string): void
  /**
   * Emitted when the user clicks Recover on a saved original. The editor host
   * dispatches the reverse change (re-inserting `entry.original` over the
   * current occupant of the range) and then removes the entry from the store's
   * recover stack (e.g. via `aiStore.recoverLast()` when it is the top entry).
   */
  (e: 'recover', entry: AIRecoverEntry): void
}>()

// ---------------------------------------------------------------------------
// Reactive views onto the store
// ---------------------------------------------------------------------------

const options = computed(() => aiStore.panelContent.options)
const commandText = computed(() => aiStore.panelContent.text)
const messages = computed(() => aiStore.panelContent.messages)
const recoverStack = computed(() => aiStore.recoverStack)

/**
 * The recover stack rendered most-recent-first, so the latest replacement is
 * offered at the top (matching the LIFO order the editor host recovers in).
 */
const reversedRecoverStack = computed<AIRecoverEntry[]>(() => aiStore.recoverStack.slice().reverse())

// ---------------------------------------------------------------------------
// Command chooser
// ---------------------------------------------------------------------------

/**
 * The command set the chooser offers, mirrored from the store (which reconciles
 * it from the `ai.commands` config on every command-mode entry). Renames,
 * prompt edits, flow changes, and user-added commands all flow through here.
 */
const commandList = computed<AICommandConfig[]>(() => aiStore.commands)

/**
 * A tooltip describing what a command does when hovered: its flow, so the user
 * knows whether it produces clickable replacement options or a streamed answer.
 *
 * @param   {AICommandConfig}  cmd  The command.
 *
 * @return  {string}                The tooltip text.
 */
function commandTitle (cmd: AICommandConfig): string {
  return cmd.flow === 'summarize'
    ? trans('%s — produces options you can click to replace the selection', cmd.name)
    : trans('%s — writes a full answer into the panel', cmd.name)
}

/**
 * Whether to render the command chooser: we are in command mode, nothing is in
 * flight, no command has produced output yet, and a selection has been
 * captured to act upon (the bubble's "Command" button always captures one).
 */
const showCommandChooser = computed<boolean>(() => {
  return aiStore.panelMode === 'command' &&
    !aiStore.inFlight &&
    aiStore.panelContent.text.length === 0 &&
    aiStore.pendingSelection !== null
})

/**
 * The first ~80 characters of the pending selection (whitespace collapsed), so
 * the user can see what the chosen command will act on. Empty when no
 * selection has been captured.
 */
const selectionExcerpt = computed<string>(() => {
  const pending = aiStore.pendingSelection
  if (pending === null) {
    return ''
  }
  const text = pending.text.replace(/\s+/g, ' ').trim()
  return text.length > 80 ? text.slice(0, 80) + '…' : text
})

/**
 * The free-text instruction the user may type instead of picking a preset.
 */
const customInstruction = ref<string>('')

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

const headerTitle = trans('AI')

/**
 * A short label for the current model shown in the header. Falls back to a
 * "no model" hint when none is selected yet.
 */
const modelLabel = computed<string>(() => {
  return aiStore.currentModel !== '' ? aiStore.currentModel : trans('No model selected')
})

/**
 * The header tooltip: the provider + model, when available.
 */
const modelTitle = computed<string>(() => {
  if (aiStore.currentModel === '') {
    return trans('Choose a model in the AI preferences')
  }
  if (aiStore.currentProvider !== '') {
    return `${aiStore.currentProvider} · ${aiStore.currentModel}`
  }
  return aiStore.currentModel
})

// ---------------------------------------------------------------------------
// Conversation input
// ---------------------------------------------------------------------------

const draft = ref<string>('')
const conversationInput = ref<HTMLInputElement|null>(null)

// When the panel switches into conversation mode, focus the input.
watch(() => aiStore.panelMode, (mode) => {
  if (mode === 'conversation') {
    nextTick()
      .then(() => { conversationInput.value?.focus() })
      .catch(err => console.error(err))
  }
})

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

/**
 * Renders the command output. We keep the raw markdown as the source of truth
 * but present a lightly-formatted, sanitized version for readability. Because a
 * full markdown pipeline is not trivially importable here, we do a minimal,
 * safe transform (escape → a few inline/line conversions) and then run the
 * result through DOMPurify. This can never inject unsanitized HTML.
 */
const renderedCommandHTML = computed<string>(() => renderMarkdown(commandText.value))

/**
 * A deliberately small, safe markdown-ish renderer: it HTML-escapes the input
 * first (so any raw HTML/markdown in the model output is shown literally, never
 * executed), then applies a handful of inline conversions, then hands the
 * result to DOMPurify. The goal is legibility without pulling in a heavyweight
 * markdown engine or risking XSS.
 *
 * @param   {string}  md  The raw markdown text.
 *
 * @return  {string}      Sanitized HTML safe for v-html.
 */
function renderMarkdown (md: string): string {
  if (md === '') {
    return ''
  }

  // 1. Escape everything first — nothing from the model is treated as HTML.
  const escaped = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // 2. Apply a minimal set of inline conversions on the escaped text.
  const withInline = escaped
    // Bold **text**
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italic *text* (avoid matching bold, which was already consumed above)
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
    // Inline `code`
    .replace(/`([^`]+)`/g, '<code>$1</code>')

  // 3. Convert line breaks to <br> so multi-line output stays readable. Raw
  // markdown is still the source of truth in the store; this is display-only.
  const withBreaks = withInline.replace(/\n/g, '<br>')

  // 4. Final safety net.
  return sanitizeHTML(withBreaks)
}

/**
 * A human-readable label for a chat role.
 *
 * @param   {AIChatMessage['role']}  role  The message role.
 *
 * @return  {string}                       The label.
 */
function roleLabel (role: AIChatMessage['role']): string {
  switch (role) {
    case 'user':
      return trans('You')
    case 'assistant':
      return trans('AI')
    default:
      return trans('System')
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * One-click copy of any panel text to the clipboard. Copies the RAW text (the
 * source of truth in the store), not the rendered HTML. `id` identifies which
 * button was clicked so it can briefly show "Copied".
 */
const copiedId = ref<string>('')
let copiedTimer: ReturnType<typeof setTimeout> | undefined
function copyText (text: string, id: string): void {
  const value = String(text ?? '')
  if (value === '') {
    return
  }
  navigator.clipboard.writeText(value)
    .then(() => {
      copiedId.value = id
      if (copiedTimer !== undefined) {
        clearTimeout(copiedTimer)
      }
      copiedTimer = setTimeout(() => { copiedId.value = '' }, 1200)
    })
    .catch(err => console.error('[AIPanel] copy failed', err))
}

/**
 * Closes the panel via the store so any other surface stays in sync.
 */
function close (): void {
  aiStore.closePanel()
}

/**
 * Handles a click on a Summarize option: emit the chosen replacement text for
 * the editor host to dispatch over the pending selection. The host owns the
 * {from,to} of the selection and the push onto the recover stack.
 *
 * @param  {string}  text  The chosen replacement text.
 */
function applyOption (text: string): void {
  emit('replace-selection', text)
}

/**
 * Handles a click on Recover: emit the saved entry so the editor host can
 * dispatch the reverse change and pop the recover stack.
 *
 * @param  {AIRecoverEntry}  entry  The stashed original to restore.
 */
function recover (entry: AIRecoverEntry): void {
  emit('recover', entry)
}

/**
 * Runs one of the five preset commands against the captured pending selection.
 * The store streams the result into panelContent.text, which replaces the
 * chooser with the command output.
 *
 * @param  {string}  key  The COMMANDS preset key (e.g. `SHORTEN`).
 */
function runPreset (key: string): void {
  const pending = aiStore.pendingSelection
  if (pending === null || aiStore.inFlight) {
    return
  }
  aiStore.runCommand(key, pending.text, pending.pageContext).catch(err => console.error(`AI command "${key}" failed`, err))
}

/**
 * Runs the free-text instruction from the chooser's input against the captured
 * pending selection (via the store's runCustomCommand) and clears the input.
 */
function runCustom (): void {
  const pending = aiStore.pendingSelection
  const instruction = customInstruction.value.trim()
  if (pending === null || instruction === '' || aiStore.inFlight) {
    return
  }
  customInstruction.value = ''
  aiStore.runCustomCommand(instruction, pending.text, pending.pageContext).catch(err => console.error('AI custom command failed', err))
}

/**
 * Sends the current draft as a conversation turn through the store (which
 * streams the reply back into the transcript) and clears the input.
 */
function sendMessage (): void {
  const text = draft.value.trim()
  if (text === '' || aiStore.inFlight) {
    return
  }

  draft.value = ''
  aiStore.askConversation(text).catch(err => console.error(err))
}
</script>

<style lang="less">
body div#ai-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  font-size: 13px;

  div.ai-panel-header {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 0 0 auto;
    padding: 8px 10px;
    border-bottom: 1px solid rgb(180, 180, 180);

    .ai-panel-title {
      font-weight: bold;
      flex: 0 0 auto;
    }

    .ai-panel-model {
      flex: 1 1 auto;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 11px;
      color: rgb(131, 131, 131);
    }

    button.ai-panel-close {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      padding: 0;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      color: inherit;
      background-color: transparent;
      transition: background-color 0.2s ease;

      &:hover {
        background-color: rgba(0, 0, 0, 0.1);
      }
    }
  }

  div.ai-panel-body {
    flex: 1 1 auto;
    overflow: auto;
    padding: 10px;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  hr {
    width: 100%;
    margin: 10px 0;
    border: none;
    border-bottom: 1px solid #ccc;
  }

  .ai-panel-status {
    font-style: italic;
    color: rgb(131, 131, 131);
    margin: 0 0 8px 0;
  }

  .ai-panel-empty {
    color: rgb(131, 131, 131);
    text-align: center;
    margin: auto 0;
  }

  // --- Copy affordance + selectable output ---------------------------------
  .ai-output-block {
    display: flex;
    flex-direction: column;
  }

  .ai-copy-btn {
    align-self: flex-end;
    padding: 2px 8px;
    margin-bottom: 4px;
    border: 1px solid rgba(128, 128, 128, 0.4);
    border-radius: 6px;
    background-color: transparent;
    color: inherit;
    font-size: 11px;
    cursor: pointer;
    transition: background-color 0.15s ease;

    &:hover { background-color: rgba(0, 0, 0, 0.08); }
  }

  .ai-copy-btn-inline {
    align-self: auto;
    margin: 0 0 0 6px;
    padding: 0 6px;
    border-radius: 4px;
    font-size: 10px;
    vertical-align: middle;
  }

  // All AI output text is manually selectable/copyable too (not just via button).
  .ai-command-output, .ai-message-content {
    user-select: text;
    -webkit-user-select: text;
    cursor: text;
  }
  .option-text, .recover-text {
    user-select: text;
    -webkit-user-select: text;
  }

  .ai-panel-subheading {
    font-weight: bold;
    margin: 0 0 6px 0;
  }

  // --- Summarize options ---------------------------------------------------
  ul.ai-summarize-options {
    list-style: none;
    margin: 0;
    padding: 0;

    li.ai-summarize-option {
      display: flex;
      gap: 6px;
      padding: 6px 8px;
      border-radius: 4px;
      cursor: pointer;
      transition: background-color 0.15s ease;

      .option-bullet {
        flex: 0 0 auto;
        color: var(--system-accent-color);
        font-weight: bold;
      }

      .option-text {
        flex: 1 1 auto;
        // Long-input summaries are multi-paragraph (and may be bullet
        // outlines) — preserve their line breaks instead of squashing them
        // onto one line.
        white-space: pre-wrap;
        word-break: break-word;
      }

      &:hover {
        background-color: rgba(0, 0, 0, 0.08);
      }
    }
  }

  // --- Recover list --------------------------------------------------------
  ul.ai-recover-list {
    list-style: none;
    margin: 0;
    padding: 0;

    li.ai-recover-entry {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 6px 0;

      .recover-text {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        color: rgb(131, 131, 131);
        font-style: italic;
      }

      .form-control {
        flex: 0 0 auto;
      }
    }
  }

  // --- Command chooser -----------------------------------------------------
  p.ai-command-selection {
    flex: 0 0 auto;
    margin: 0 0 10px 0;
    padding: 6px 8px;
    border-radius: 4px;
    background-color: rgba(0, 0, 0, 0.05);
    color: rgb(131, 131, 131);
    word-break: break-word;
  }

  div.ai-command-chooser {
    flex: 0 0 auto;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;

    button.ai-command-preset {
      padding: 5px 10px;
      border: 1px solid rgba(128, 128, 128, 0.4);
      border-radius: 6px;
      background-color: transparent;
      color: inherit;
      font-size: 12px;
      cursor: pointer;
      transition: background-color 0.15s ease;

      &:hover:not(:disabled) {
        background-color: rgba(0, 0, 0, 0.08);
      }

      &:disabled {
        opacity: 0.5;
        cursor: default;
      }
    }
  }

  p.ai-command-chooser-hint {
    flex: 0 0 auto;
    margin: 0 0 8px 0;
    font-size: 11px;
    color: rgb(131, 131, 131);
  }

  form.ai-command-custom-form {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 6px;
    border-radius: 8px;
    background-color: rgba(0, 0, 0, 0.06);

    input.ai-command-custom-input {
      flex: 1 1 auto;
      min-width: 0;
      height: 24px;
      border: none;
      outline: none;
      background-color: transparent;
      color: inherit;
      font-size: 13px;

      &::placeholder {
        opacity: 0.6;
      }

      &:disabled {
        opacity: 0.5;
      }
    }

    button.ai-command-custom-run {
      flex: 0 0 auto;
      padding: 3px 10px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      color: inherit;
      font-size: 12px;
      background-color: rgba(0, 0, 0, 0.08);
      transition: background-color 0.2s ease, opacity 0.2s ease;

      &:hover:not(:disabled) {
        background-color: rgba(0, 0, 0, 0.16);
      }

      &:disabled {
        opacity: 0.35;
        cursor: default;
      }
    }
  }

  // --- Command output ------------------------------------------------------
  div.ai-command-output {
    line-height: 1.5;
    word-break: break-word;

    code {
      font-family: var(--font-monospace, monospace);
      background-color: rgba(0, 0, 0, 0.08);
      border-radius: 3px;
      padding: 0 3px;
    }
  }

  // --- Conversation --------------------------------------------------------
  div.ai-conversation {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;

    div.ai-message {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 6px 8px;
      border-radius: 6px;

      .ai-message-role {
        font-size: 10px;
        font-weight: bold;
        text-transform: uppercase;
        color: rgb(131, 131, 131);
      }

      .ai-message-content {
        line-height: 1.5;
        word-break: break-word;
      }

      &.ai-message-user {
        background-color: rgba(0, 0, 0, 0.05);
      }

      &.ai-message-assistant {
        background-color: rgba(41, 117, 217, 0.08);
      }

      &.ai-message-system {
        background-color: rgba(0, 0, 0, 0.03);
        font-style: italic;
      }
    }
  }

  form.ai-conversation-form {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    padding: 4px 6px;
    border-radius: 8px;
    background-color: rgba(0, 0, 0, 0.06);

    input.ai-conversation-input {
      flex: 1 1 auto;
      min-width: 0;
      height: 24px;
      border: none;
      outline: none;
      background-color: transparent;
      color: inherit;
      font-size: 13px;

      &::placeholder {
        opacity: 0.6;
      }

      &:disabled {
        opacity: 0.5;
      }
    }

    button.ai-conversation-send {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      color: inherit;
      background-color: transparent;
      transition: background-color 0.2s ease, opacity 0.2s ease;

      &:hover:not(:disabled) {
        background-color: rgba(0, 0, 0, 0.12);
      }

      &:disabled {
        opacity: 0.35;
        cursor: default;
      }
    }
  }
}

// --- Dark theme overrides --------------------------------------------------
body.dark div#ai-panel {
  div.ai-panel-header button.ai-panel-close:hover {
    background-color: rgba(255, 255, 255, 0.12);
  }

  ul.ai-summarize-options li.ai-summarize-option:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }

  div.ai-command-output code {
    background-color: rgba(255, 255, 255, 0.12);
  }

  p.ai-command-selection {
    background-color: rgba(255, 255, 255, 0.06);
  }

  div.ai-command-chooser button.ai-command-preset:hover:not(:disabled) {
    background-color: rgba(255, 255, 255, 0.1);
  }

  form.ai-command-custom-form {
    background-color: rgba(255, 255, 255, 0.08);

    button.ai-command-custom-run {
      background-color: rgba(255, 255, 255, 0.1);

      &:hover:not(:disabled) {
        background-color: rgba(255, 255, 255, 0.18);
      }
    }
  }

  div.ai-conversation div.ai-message {
    &.ai-message-user {
      background-color: rgba(255, 255, 255, 0.06);
    }

    &.ai-message-assistant {
      background-color: rgba(41, 117, 217, 0.18);
    }

    &.ai-message-system {
      background-color: rgba(255, 255, 255, 0.04);
    }
  }

  form.ai-conversation-form {
    background-color: rgba(255, 255, 255, 0.08);

    button.ai-conversation-send:hover:not(:disabled) {
      background-color: rgba(255, 255, 255, 0.16);
    }
  }
}
</style>
