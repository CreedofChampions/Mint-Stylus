<template>
  <div class="ai-provider-control">
    <!-- Step 1: pick a provider -->
    <label class="ai-field-label">{{ step1Label }}</label>
    <select
      v-model="provider"
      class="ai-provider-select"
      v-on:change="onProviderChange"
    >
      <option
        v-for="slug in slugs"
        v-bind:key="slug"
        v-bind:value="slug"
      >{{ providers[slug].label }}</option>
    </select>

    <!-- Step 2: paste a key (only for providers that need one) -->
    <template v-if="needsKey">
      <label class="ai-field-label">{{ step2Label }}</label>
      <div class="ai-key-row">
        <input
          ref="keyInputEl"
          v-model="keyInput"
          type="password"
          class="ai-key-input"
          v-bind:placeholder="keyPlaceholder"
          autocomplete="off"
          spellcheck="false"
          v-on:keyup.enter="saveKey"
        >
        <button
          type="button"
          class="ai-key-save"
          v-bind:disabled="saving || keyInput.trim() === ''"
          v-on:click="saveKey"
        >{{ saveLabel }}</button>
      </div>

      <p class="ai-key-status" v-bind:class="statusClass">{{ statusText }}</p>

      <p class="ai-key-hint">
        {{ getKeyHint }}
        <a v-bind:href="keyUrl" target="_blank" rel="noreferrer">{{ keyUrl }}</a>
      </p>
    </template>

    <p v-else class="ai-key-status ai-status-ok">{{ localNoKeyText }}</p>
  </div>
</template>

<script setup lang="ts">
/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        AIProviderControl
 * CVM-Role:        View
 * Maintainer:      Mint Stylus
 * License:         GNU GPL v3
 *
 * Description:     A self-contained, deliberately simple "pick a provider + paste
 *                  your key" control for the AI preferences tab. The provider is
 *                  stored in config (ai.provider); the API key is sent straight to
 *                  window.ai.saveKey (encrypted in the main process) and NEVER
 *                  stored in config or read back into the renderer. A live status
 *                  line tells the user whether a key is already saved, and a
 *                  per-provider "Get a key" link points them to the right place.
 *
 *                  ==== AI-created for Mint Stylus ====
 *
 * END HEADER
 */

import { ref, computed, onMounted } from 'vue'
import { trans } from '@common/i18n-renderer'
import {
  PROVIDERS,
  PROVIDER_SLUGS,
  DEFAULT_PROVIDER,
  getProviderInfo
} from '@common/util/ai-providers'

const providers = PROVIDERS
const slugs = PROVIDER_SLUGS

const provider = ref<string>(String(window.config.get('ai.provider') ?? DEFAULT_PROVIDER))
const keyInput = ref<string>('')
const hasKey = ref<boolean>(false)
const saving = ref<boolean>(false)
const justSaved = ref<boolean>(false)

const info = computed(() => getProviderInfo(provider.value))
const needsKey = computed<boolean>(() => info.value.needsKey)
const keyUrl = computed<string>(() => info.value.keyUrl)

const step1Label = trans('1. Choose your AI provider')
const step2Label = trans('2. Paste your API key')
const getKeyHint = trans('Don\'t have a key? Get one here:')
const localNoKeyText = trans('✓ This provider runs locally on your computer — no API key needed.')

const saveLabel = computed<string>(() => saving.value ? trans('Saving…') : trans('Save key'))

const keyPlaceholder = computed<string>(() => hasKey.value
  ? trans('A key is already saved — paste a new one to replace it')
  : trans('Paste your API key here, then press Enter'))

const statusText = computed<string>(() => {
  if (justSaved.value) {
    return trans('✓ Key saved for %s. You\'re ready to go!', info.value.label)
  }
  return hasKey.value
    ? trans('✓ A key is saved for %s.', info.value.label)
    : trans('⚠ No key saved yet for %s.', info.value.label)
})

const statusClass = computed<string>(() => (hasKey.value || justSaved.value) ? 'ai-status-ok' : 'ai-status-warn')

async function refreshHasKey (): Promise<void> {
  try {
    hasKey.value = await window.ai.hasKey(provider.value)
  } catch (err: any) {
    console.error('[AIProviderControl] hasKey failed', err)
    hasKey.value = false
  }
}

function onProviderChange (): void {
  window.config.set('ai.provider', provider.value)
  justSaved.value = false
  keyInput.value = ''
  refreshHasKey().catch(err => console.error(err))
}

async function saveKey (): Promise<void> {
  const key = keyInput.value.trim()
  if (key === '') {
    return
  }
  saving.value = true
  try {
    const ok = await window.ai.saveKey(provider.value, key)
    if (ok) {
      justSaved.value = true
      keyInput.value = ''
      await refreshHasKey()
    }
  } catch (err: any) {
    console.error('[AIProviderControl] saveKey failed', err)
  } finally {
    saving.value = false
  }
}

onMounted(() => { refreshHasKey().catch(err => console.error(err)) })
</script>

<style lang="less">
.ai-provider-control {
  margin-bottom: 16px;
  max-width: 520px;

  .ai-field-label {
    display: block;
    font-weight: bold;
    margin: 12px 0 6px 0;
  }

  .ai-provider-select {
    width: 100%;
    padding: 6px 8px;
    border-radius: 6px;
  }

  .ai-key-row {
    display: flex;
    gap: 8px;
    align-items: center;

    .ai-key-input {
      flex: 1;
      padding: 6px 8px;
      border-radius: 6px;
      font-family: inherit;
    }

    .ai-key-save {
      padding: 6px 14px;
      border-radius: 6px;
      white-space: nowrap;
      cursor: pointer;

      &:disabled { opacity: 0.5; cursor: default; }
    }
  }

  .ai-key-status {
    font-size: 12px;
    margin: 8px 0 4px 0;

    &.ai-status-ok { color: rgb(60, 160, 90); }
    &.ai-status-warn { color: rgb(200, 140, 40); }
  }

  .ai-key-hint {
    font-size: 11px;
    color: rgb(150, 150, 150);
    margin: 0;

    a { color: inherit; text-decoration: underline; }
  }
}
</style>
