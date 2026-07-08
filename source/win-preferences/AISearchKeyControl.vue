<template>
  <div class="ai-search-key-control">
    <!-- Step 1: pick a search provider (or turn it off). -->
    <label class="ai-field-label">{{ providerLabel }}</label>
    <select
      v-model="provider"
      class="ai-search-select"
      v-on:change="onProviderChange"
    >
      <option
        v-for="slug in slugs"
        v-bind:key="slug"
        v-bind:value="slug"
      >{{ providerLabels[slug] }}</option>
    </select>

    <!-- Step 2: paste the provider's key inline. This deliberately avoids
         window.prompt(), which throws "prompt() is not supported." in Electron;
         the key travels straight to window.ai.saveKey and is never read back. -->
    <template v-if="needsKey">
      <label class="ai-field-label">{{ keyLabel }}</label>
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

    <p v-else class="ai-key-hint">{{ offHint }}</p>
  </div>
</template>

<script setup lang="ts">
/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        AISearchKeyControl
 * CVM-Role:        View
 * Maintainer:      Mint Stylus
 * License:         GNU GPL v3
 *
 * Description:     The "Web Search" provider + key control for the AI preferences
 *                  tab. Replaces the old "Set search key…" button, which called
 *                  window.prompt() — a function Electron does not implement (it
 *                  throws "prompt() is not supported."), so the key could never be
 *                  set. The user now picks a provider (Off / Tavily / Brave) and,
 *                  when one is chosen, pastes its key into an inline password field
 *                  that mirrors AIProviderControl's key row. The provider is stored
 *                  in config (ai.searchProvider); the key is sent straight to
 *                  window.ai.saveKey and is never read back into the renderer.
 *
 *                  Search keys are stored under a "search:<provider>" id because
 *                  that is exactly the id the main-process search path decrypts
 *                  (AIProvider._decryptKey(`search:${provider}`)); storing them
 *                  under the bare slug — as the old button did — meant the search
 *                  path never found them even when the prompt had worked.
 *
 *                  ==== AI-created for Mint Stylus ====
 *
 * END HEADER
 */

import { ref, computed, onMounted } from 'vue'
import { trans } from '@common/i18n-renderer'

// The search-provider slugs shown in the dropdown, in order. These are exactly
// the values ai.searchProvider is validated against (tavily|brave|none).
const slugs = [ 'none', 'tavily', 'brave' ]
const providerLabels: Record<string, string> = {
  none: trans('Off'),
  tavily: 'Tavily (free tier, no card)',
  brave: 'Brave'
}
// Human-readable names used in status text.
const providerNames: Record<string, string> = {
  tavily: 'Tavily',
  brave: 'Brave'
}
// Where to get a key, per provider.
const providerKeyUrls: Record<string, string> = {
  tavily: 'https://app.tavily.com',
  brave: 'https://brave.com/search/api/'
}

const provider = ref<string>(String(window.config.get('ai.searchProvider') ?? 'none'))
const keyInput = ref<string>('')
const hasKey = ref<boolean>(false)
const saving = ref<boolean>(false)
const justSaved = ref<boolean>(false)

const providerLabel = trans('Search provider')
const keyLabel = trans('Paste the search provider\'s API key')
const getKeyHint = trans('Don\'t have a key? Get one here:')
const offHint = trans('Web search is off. Choose Tavily or Brave above to set its key.')

const needsKey = computed<boolean>(() => provider.value === 'tavily' || provider.value === 'brave')
// Search keys live under a "search:" namespace so they never collide with the
// main AI provider key — and this is the exact id the search path decrypts.
const storageId = computed<string>(() => `search:${provider.value}`)
const providerName = computed<string>(() => providerNames[provider.value] ?? provider.value)
const keyUrl = computed<string>(() => providerKeyUrls[provider.value] ?? '')

const saveLabel = computed<string>(() => saving.value ? trans('Saving…') : trans('Save key'))
const keyPlaceholder = computed<string>(() => hasKey.value
  ? trans('A key is already saved — paste a new one to replace it')
  : trans('Paste your API key here, then press Enter'))

const statusText = computed<string>(() => {
  if (justSaved.value) {
    return trans('✓ Key saved for %s. Web search is ready.', providerName.value)
  }
  return hasKey.value
    ? trans('✓ A key is saved for %s.', providerName.value)
    : trans('⚠ No key saved yet for %s.', providerName.value)
})

const statusClass = computed<string>(() => (hasKey.value || justSaved.value) ? 'ai-status-ok' : 'ai-status-warn')

/**
 * Refreshes whether a key is stored for the current provider. Fails quietly to
 * "no key" so the field is always usable.
 */
async function refreshHasKey (): Promise<void> {
  if (!needsKey.value) {
    hasKey.value = false
    return
  }
  try {
    hasKey.value = await window.ai.hasKey(storageId.value)
  } catch (err: any) {
    console.error('[AISearchKeyControl] hasKey failed', err)
    hasKey.value = false
  }
}

function onProviderChange (): void {
  window.config.set('ai.searchProvider', provider.value)
  justSaved.value = false
  keyInput.value = ''
  refreshHasKey().catch(err => console.error(err))
}

async function saveKey (): Promise<void> {
  const key = keyInput.value.trim()
  if (key === '' || !needsKey.value) {
    return
  }
  saving.value = true
  try {
    const ok = await window.ai.saveKey(storageId.value, key)
    if (ok) {
      justSaved.value = true
      keyInput.value = ''
      await refreshHasKey()
    }
  } catch (err: any) {
    console.error('[AISearchKeyControl] saveKey failed', err)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  refreshHasKey().catch(err => console.error(err))
})
</script>

<style lang="less">
.ai-search-key-control {
  margin-bottom: 16px;
  max-width: 520px;

  .ai-field-label {
    display: block;
    font-weight: bold;
    margin: 12px 0 6px 0;
  }

  .ai-search-select {
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
