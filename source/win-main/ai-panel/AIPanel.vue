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
           COMMAND MODE: streamed / final markdown output
           ================================================================== -->
      <template v-else-if="aiStore.panelMode === 'command'">
        <p v-if="!aiStore.inFlight && commandText.length === 0" class="ai-panel-empty">
          {{ trans('No output yet. Run an AI command to see its result here.') }}
        </p>
        <!--
          We render sanitized markdown as HTML for readability, but the raw
          markdown source stays the source of truth. sanitizeHTML runs the
          content through DOMPurify, so this is safe. If you would rather see
          the untouched markdown, toggle the raw view below.
          eslint-disable-next-line vue/no-v-html
        -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div
          v-if="commandText.length > 0"
          class="ai-command-output"
          v-html="renderedCommandHTML"
        ></div>
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
            <span class="ai-message-role">{{ roleLabel(message.role) }}</span>
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
 *                    - 'command'      → the streamed/final markdown output,
 *                                       rendered as DOMPurify-sanitized HTML
 *                                       (raw markdown is the source of truth).
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
