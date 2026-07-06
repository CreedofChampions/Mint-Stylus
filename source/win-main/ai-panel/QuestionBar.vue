<template>
  <div
    v-bind:class="{
      'ai-question-bar': true,
      'is-expanded': isExpanded
    }"
    v-on:mouseenter="handleMouseEnter"
    v-on:mouseleave="handleMouseLeave"
  >
    <!--
      Collapsed state: a slim pill that hints at the interaction. Clicking or
      hovering it reveals the input. This stays out of the way until invoked.
    -->
    <button
      v-if="!isExpanded"
      type="button"
      class="ai-question-bar-hint"
      v-bind:title="trans('Ask a question to start a new AI conversation')"
      v-on:click="expand"
    >
      <cds-icon shape="help-info"></cds-icon>
      <span class="hint-label">{{ trans('Ask AI…') }}</span>
    </button>

    <!--
      Expanded state: the actual input plus a submit affordance. Submitting
      emits the `ask` event with the trimmed question; the integrator wires
      that to the document-create / auto-save flow.
    -->
    <form
      v-else
      class="ai-question-bar-form"
      v-on:submit.prevent="submit"
    >
      <cds-icon class="ai-question-bar-icon" shape="help-info"></cds-icon>
      <input
        ref="inputElement"
        v-model="question"
        type="text"
        class="ai-question-bar-input"
        v-bind:placeholder="trans('Ask a question — a new conversation will be created…')"
        autocomplete="off"
        spellcheck="true"
        v-on:keydown.esc.prevent="collapse"
        v-on:blur="handleBlur"
      >
      <button
        type="submit"
        class="ai-question-bar-submit"
        v-bind:disabled="question.trim() === ''"
        v-bind:title="trans('Ask')"
      >
        <cds-icon shape="arrow" direction="right"></cds-icon>
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        QuestionBar
 * CVM-Role:        View
 * Maintainer:      Mint Stylus
 * License:         GNU GPL v3
 *
 * Description:     AI-CREATED FOR MINT STYLUS.
 *                  A slim hover-to-click question bar that sits above the
 *                  document tabs (top-middle). On hover or click it reveals a
 *                  text input; submitting emits an `ask` event carrying the
 *                  question string. This component is purely presentational —
 *                  it performs no document creation or saving itself. The
 *                  parent (App.vue) is expected to wire the `ask` event to the
 *                  real flow: create a NEW conversation document seeded with
 *                  the question (via commands.run('file-new', …)), request a
 *                  ≤5-word filename slug from the AIProvider, and auto-save the
 *                  document beside the most-recently-written file through the
 *                  documents provider. Keeping the heavy lifting in the emit
 *                  handler preserves the Mint Stylus rule that all AI/HTTP work
 *                  and every API key live only in the Electron main process.
 *
 * END HEADER
 */

import { ref, nextTick } from 'vue'
import { trans } from 'source/common/i18n-renderer'

const emit = defineEmits<{
  /**
   * Emitted when the user submits a non-empty question. The payload is the
   * trimmed question string. The integrator connects this to the
   * new-conversation-document + auto-save-beside-last-file flow.
   */
  (e: 'ask', question: string): void
}>()

const isExpanded = ref<boolean>(false)
const question = ref<string>('')
const inputElement = ref<HTMLInputElement|null>(null)

/**
 * Reveals the input and focuses it on the next tick (once it is in the DOM).
 */
function expand (): void {
  if (isExpanded.value) {
    return
  }

  isExpanded.value = true
  nextTick()
    .then(() => {
      inputElement.value?.focus()
    })
    .catch(err => console.error(err))
}

/**
 * Collapses the bar back to its slim hint state and clears any partial input.
 */
function collapse (): void {
  isExpanded.value = false
  question.value = ''
}

/**
 * Hover reveals the input (progressive disclosure). We only auto-expand on
 * hover; we never auto-collapse on hover-out while the user is mid-typing —
 * that is handled by the blur guard instead.
 */
function handleMouseEnter (): void {
  expand()
}

/**
 * When the pointer leaves the bar, collapse it again ONLY if the user has not
 * started typing. This keeps the bar unobtrusive while never discarding work.
 */
function handleMouseLeave (): void {
  if (question.value.trim() === '' && document.activeElement !== inputElement.value) {
    collapse()
  }
}

/**
 * When the input loses focus, collapse it again unless the user has typed
 * something (so an accidental blur doesn't throw away a half-written question).
 */
function handleBlur (): void {
  if (question.value.trim() === '') {
    collapse()
  }
}

/**
 * Emits the question and resets the bar. Guards against empty submissions.
 */
function submit (): void {
  const trimmed = question.value.trim()
  if (trimmed === '') {
    return
  }

  emit('ask', trimmed)
  collapse()
}
</script>

<style lang="less">
body div.ai-question-bar {
  // Sits top-middle, above the document tabs. The parent positions the bar;
  // here we only handle the pill/input presentation and the reveal animation.
  display: flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  margin: 2px auto;
  max-width: 480px;
  width: 100%;
  transition: all 0.2s ease;

  button.ai-question-bar-hint {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 22px;
    padding: 0 12px;
    border: none;
    border-radius: 11px;
    cursor: pointer;
    font-size: 12px;
    line-height: 22px;
    color: inherit;
    background-color: rgba(0, 0, 0, 0.06);
    transition: background-color 0.2s ease;

    &:hover {
      background-color: rgba(0, 0, 0, 0.12);
    }

    .hint-label {
      white-space: nowrap;
    }
  }

  form.ai-question-bar-form {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    height: 24px;
    padding: 0 8px;
    border-radius: 12px;
    background-color: rgba(0, 0, 0, 0.06);

    .ai-question-bar-icon {
      flex: 0 0 auto;
      opacity: 0.7;
    }

    input.ai-question-bar-input {
      flex: 1 1 auto;
      min-width: 0;
      height: 20px;
      border: none;
      outline: none;
      background-color: transparent;
      color: inherit;
      font-size: 12px;
      line-height: 20px;

      &::placeholder {
        opacity: 0.6;
      }
    }

    button.ai-question-bar-submit {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      padding: 0;
      border: none;
      border-radius: 10px;
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

body.dark div.ai-question-bar {
  button.ai-question-bar-hint {
    background-color: rgba(255, 255, 255, 0.08);

    &:hover {
      background-color: rgba(255, 255, 255, 0.16);
    }
  }

  form.ai-question-bar-form {
    background-color: rgba(255, 255, 255, 0.08);

    button.ai-question-bar-submit:hover:not(:disabled) {
      background-color: rgba(255, 255, 255, 0.16);
    }
  }
}
</style>
