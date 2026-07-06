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

    <!-- Step 1b: custom base URL — ONLY for the 'custom' provider. Every other
         provider derives its endpoint automatically and never shows a URL. -->
    <template v-if="isCustom">
      <label class="ai-field-label">{{ baseUrlLabel }}</label>
      <input
        v-model="baseURL"
        type="text"
        class="ai-baseurl-input"
        v-bind:placeholder="baseUrlPlaceholder"
        autocomplete="off"
        spellcheck="false"
        v-on:change="onBaseUrlChange"
        v-on:blur="onBaseUrlChange"
      >
      <p class="ai-key-hint">{{ baseUrlHint }}</p>
    </template>

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

      <p v-if="keyUrl !== ''" class="ai-key-hint">
        {{ getKeyHint }}
        <a v-bind:href="keyUrl" target="_blank" rel="noreferrer">{{ keyUrl }}</a>
      </p>
    </template>

    <p v-else class="ai-key-status ai-status-ok">{{ localNoKeyText }}</p>

    <!-- Step 3: choose a model (combobox — real model list + free text) -->
    <label class="ai-field-label">{{ modelLabel }}</label>
    <div class="ai-model-row">
      <input
        v-model="model"
        type="text"
        class="ai-model-input"
        list="ai-model-list"
        v-bind:placeholder="modelPlaceholder"
        autocomplete="off"
        spellcheck="false"
        v-on:change="onModelChange"
        v-on:blur="onModelChange"
      >
      <datalist id="ai-model-list">
        <option
          v-for="id in modelIds"
          v-bind:key="id"
          v-bind:value="id"
        ></option>
      </datalist>
      <button
        type="button"
        class="ai-model-refresh"
        v-bind:disabled="loadingModels"
        v-on:click="loadModels"
      >{{ refreshModelsLabel }}</button>
    </div>

    <p class="ai-key-hint">{{ modelHelper }}</p>
    <p v-if="loadingModels" class="ai-key-status">{{ loadingModelsText }}</p>
    <p v-else-if="modelIds.length === 0" class="ai-key-status ai-status-warn">{{ noModelsHint }}</p>
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
 * Description:     A self-contained "pick a provider + paste your key + choose a
 *                  model" control for the AI preferences tab. The provider is
 *                  stored in config (ai.provider); the API key is sent straight to
 *                  window.ai.saveKey (encrypted in the main process) and NEVER
 *                  stored in config or read back into the renderer. A live status
 *                  line tells the user whether a key is already saved, and a
 *                  per-provider "Get a key" link points them to the right place.
 *
 *                  The model field is a combobox (an <input list> + <datalist>):
 *                  it is populated with the provider's REAL model list via
 *                  window.ai.listModels(provider) but still accepts any free-typed
 *                  model id. Models are (re)loaded on mount, on provider change and
 *                  after a key is saved; a "Refresh models" button re-fetches. When
 *                  no key is set yet listModels fails quietly and the user simply
 *                  keeps typing.
 *
 *                  The Base URL field is shown ONLY for the 'custom'
 *                  (OpenAI-compatible) provider — the one provider whose endpoint
 *                  the user types (stored in ai.baseURL). All named providers keep
 *                  their auto-derived, hidden endpoint.
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
const baseURL = ref<string>(String(window.config.get('ai.baseURL') ?? ''))
const model = ref<string>(String(window.config.get('ai.model') ?? ''))
const keyInput = ref<string>('')
const hasKey = ref<boolean>(false)
const saving = ref<boolean>(false)
const justSaved = ref<boolean>(false)

const modelIds = ref<string[]>([])
const loadingModels = ref<boolean>(false)

const info = computed(() => getProviderInfo(provider.value))
const needsKey = computed<boolean>(() => info.value.needsKey)
const keyUrl = computed<string>(() => info.value.keyUrl)
const isCustom = computed<boolean>(() => provider.value === 'custom')

const step1Label = trans('1. Choose your AI provider')
const step2Label = trans('2. Paste your API key')
const getKeyHint = trans('Don\'t have a key? Get one here:')
const localNoKeyText = trans('✓ This provider runs locally on your computer — no API key needed.')

const baseUrlLabel = trans('API base URL')
const baseUrlPlaceholder = 'https://your-endpoint/v1'
const baseUrlHint = trans('Enter your OpenAI-compatible endpoint.')

const modelLabel = trans('Model')
const modelPlaceholder = trans('e.g. gpt-4o-mini — or leave blank for the default')
const modelHelper = trans('Pick from the list or type any model id. Leave blank to use the provider default.')
const loadingModelsText = trans('Loading models…')
const noModelsHint = trans('Set your key above, then models will load.')
const refreshModelsLabel = computed<string>(() => loadingModels.value ? trans('Loading…') : trans('Refresh models'))

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

/**
 * Fetch the provider's real model list and populate the combobox. Fails quietly:
 * when there is no key yet (or the endpoint errors) it simply clears the list and
 * lets the user keep typing a model id by hand.
 */
async function loadModels (): Promise<void> {
  loadingModels.value = true
  try {
    const raw = await window.ai.listModels(provider.value)
    const ids = (Array.isArray(raw) ? raw : [])
      .map((m: any) => String(m?.id ?? m?.name ?? m ?? '').trim())
      .filter((id: string) => id !== '')
    modelIds.value = Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b)).slice(0, 200)
  } catch (err: any) {
    console.error('[AIProviderControl] listModels failed', err)
    modelIds.value = []
  } finally {
    loadingModels.value = false
  }
}

function onProviderChange (): void {
  window.config.set('ai.provider', provider.value)
  justSaved.value = false
  keyInput.value = ''
  baseURL.value = String(window.config.get('ai.baseURL') ?? '')
  modelIds.value = []
  refreshHasKey().catch(err => console.error(err))
  loadModels().catch(err => console.error(err))
}

function onBaseUrlChange (): void {
  window.config.set('ai.baseURL', baseURL.value.trim())
  // A custom endpoint change can mean a different model list.
  loadModels().catch(err => console.error(err))
}

function onModelChange (): void {
  window.config.set('ai.model', model.value.trim())
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
      // A freshly-saved key usually unlocks the model list.
      await loadModels()
    }
  } catch (err: any) {
    console.error('[AIProviderControl] saveKey failed', err)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  refreshHasKey().catch(err => console.error(err))
  loadModels().catch(err => console.error(err))
})
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

  .ai-baseurl-input {
    width: 100%;
    padding: 6px 8px;
    border-radius: 6px;
    font-family: inherit;
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

  .ai-model-row {
    display: flex;
    gap: 8px;
    align-items: center;

    .ai-model-input {
      flex: 1;
      padding: 6px 8px;
      border-radius: 6px;
      font-family: inherit;
    }

    .ai-model-refresh {
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
