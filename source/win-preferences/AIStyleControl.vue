<template>
  <div class="ai-style-control">
    <p class="ai-style-intro">{{ introText }}</p>
    <textarea
      v-model="style"
      class="ai-style-input"
      rows="8"
      spellcheck="true"
      v-bind:placeholder="placeholder"
      v-on:blur="save(false)"
    ></textarea>
    <div class="ai-style-row">
      <button
        type="button"
        class="ai-style-save"
        v-bind:disabled="saving"
        v-on:click="save(true)"
      >{{ saveLabel }}</button>
      <p v-if="statusText !== ''" class="ai-style-status" v-bind:class="statusClass">{{ statusText }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        AIStyleControl
 * CVM-Role:        View
 * Maintainer:      Mint Stylus
 * License:         GNU GPL v3
 *
 * Description:     The "Write in My Style" guide editor for the AI preferences
 *                  tab. Replaces the old "Edit Write-in-My-Style guide…" button,
 *                  which called window.prompt() — a function Electron does not
 *                  implement (it throws "prompt() is not supported."), so the
 *                  guide could never be edited. The current guide is read once via
 *                  window.ai.getStyle() into an inline textarea; edits are
 *                  persisted with window.ai.setStyle() on blur (when changed) and
 *                  via an explicit "Save guide" button. All file work stays in the
 *                  main-process AIProvider.
 *
 *                  ==== AI-created for Mint Stylus ====
 *
 * END HEADER
 */

import { ref, computed, onMounted } from 'vue'
import { trans } from '@common/i18n-renderer'

const style = ref<string>('')
// The last value known to be persisted — used to skip no-op saves on blur and to
// guard against clobbering the stored guide before the initial load resolves.
const savedValue = ref<string>('')
const loaded = ref<boolean>(false)
const saving = ref<boolean>(false)
const lastResult = ref<'none' | 'ok' | 'fail'>('none')

const introText = trans('This text is prepended to every style-aware AI request. Describe your tone, vocabulary, and formatting so generated text sounds like you.')
const placeholder = trans('e.g. Write in a warm, plain-spoken voice. Short paragraphs. Avoid jargon and exclamation marks.')

const saveLabel = computed<string>(() => saving.value ? trans('Saving…') : trans('Save guide'))
const statusText = computed<string>(() => {
  switch (lastResult.value) {
    case 'ok': return trans('✓ Your "Write in My Style" guide has been saved.')
    case 'fail': return trans('⚠ Your guide could not be saved.')
    default: return ''
  }
})
const statusClass = computed<string>(() => lastResult.value === 'ok' ? 'ai-status-ok' : (lastResult.value === 'fail' ? 'ai-status-warn' : ''))

/**
 * Persists the guide. On blur it only saves when the text actually changed; the
 * explicit Save button forces a save so the user always gets feedback. Never
 * saves before the initial getStyle() has resolved, so an empty textarea can't
 * clobber the stored guide.
 *
 * @param  {boolean}  force  Save even if unchanged (the Save button).
 */
async function save (force: boolean): Promise<void> {
  if (!loaded.value) {
    return
  }
  if (!force && style.value === savedValue.value) {
    return
  }
  saving.value = true
  try {
    const ok = await window.ai.setStyle(style.value)
    if (ok) {
      savedValue.value = style.value
    }
    lastResult.value = ok ? 'ok' : 'fail'
  } catch (err: any) {
    console.error('[AIStyleControl] setStyle failed', err)
    lastResult.value = 'fail'
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  window.ai.getStyle()
    .then(current => {
      style.value = current
      savedValue.value = current
    })
    .catch(err => console.error('[AIStyleControl] getStyle failed', err))
    .finally(() => { loaded.value = true })
})
</script>

<style lang="less">
.ai-style-control {
  margin-bottom: 16px;
  max-width: 520px;

  .ai-style-intro {
    font-size: 12px;
    color: rgb(120, 120, 120);
    margin: 0 0 10px 0;
  }

  .ai-style-input {
    width: 100%;
    padding: 8px;
    border-radius: 6px;
    font-family: inherit;
    resize: vertical;
    box-sizing: border-box;
  }

  .ai-style-row {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-top: 8px;

    .ai-style-save {
      padding: 6px 14px;
      border-radius: 6px;
      white-space: nowrap;
      cursor: pointer;

      &:disabled { opacity: 0.5; cursor: default; }
    }

    .ai-style-status {
      font-size: 12px;
      margin: 0;

      &.ai-status-ok { color: rgb(60, 160, 90); }
      &.ai-status-warn { color: rgb(200, 140, 40); }
    }
  }
}
</style>
