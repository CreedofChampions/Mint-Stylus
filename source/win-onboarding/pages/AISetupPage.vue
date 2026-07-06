<!-- created by AI -->
<template>
  <h1>{{ pageHeading }}</h1>

  <p>
    {{ intro }}
  </p>

  <p class="box">
    <label for="ai-provider">{{ providerLabel }}</label>
    <select
      id="ai-provider"
      v-model="provider"
      v-on:change="onProviderChange"
    >
      <option
        v-for="slug in slugs"
        v-bind:key="slug"
        v-bind:value="slug"
      >
        {{ providers[slug].label }}
      </option>
    </select>
  </p>

  <!-- Base URL: shown ONLY for the Custom (OpenAI-compatible) provider. Every
       other provider derives its endpoint automatically in the main process. -->
  <p v-if="isCustom" class="box">
    <label for="ai-base-url">{{ baseUrlLabel }}</label>
    <input
      id="ai-base-url"
      v-model="baseURL"
      type="text"
      autocomplete="off"
      spellcheck="false"
      v-bind:placeholder="baseUrlPlaceholder"
      v-on:blur="saveBaseURL"
    />
    <span class="small helper">{{ baseUrlHelper }}</span>
  </p>

  <p v-if="selectedNeedsKey" class="box">
    <label for="ai-key">{{ keyLabel }}</label>
    <input
      id="ai-key"
      v-model="apiKey"
      type="password"
      autocomplete="off"
      v-bind:placeholder="keyPlaceholder"
      v-on:blur="saveKeyIfPresent"
    />
    <span class="small helper">{{ keyHelper }}</span>
  </p>

  <p v-else class="small helper">
    {{ noKeyHelper }}
  </p>
</template>

<script setup lang="ts">
/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        AISetupPage
 * CVM-Role:        View
 * Maintainer:      Mint Stylus
 * License:         GNU GPL v3
 *
 * Description:     The first-run AI onboarding step. Deliberately simple: the
 *                  user picks a provider from the shared PROVIDERS catalogue and
 *                  (optionally) pastes an API key. For the "Custom
 *                  (OpenAI-compatible)" provider — and ONLY that one — a Base URL
 *                  input appears; every other provider derives its endpoint
 *                  automatically in the main process, so no URL is ever shown.
 *                  The key, if entered, travels inbound ONCE via
 *                  window.ai.saveKey (encrypted in main) and is never read back.
 *                  Skipping this page is fine; provider, key and URL can all be
 *                  changed later in Preferences → AI. window.ai and window.config
 *                  are provided by the shared preload.
 *
 *                  ==== AI-created for Mint Stylus ====
 *
 * END HEADER
 */

import { trans } from 'source/common/i18n-renderer'
import { ref, computed } from 'vue'
import {
  PROVIDERS,
  PROVIDER_SLUGS,
  DEFAULT_PROVIDER,
  getProviderInfo
} from '@common/util/ai-providers'

const providers = PROVIDERS
const slugs = PROVIDER_SLUGS

const pageHeading = trans('AI setup')
const intro = trans('Choose an AI provider to enable the writing assistant. Just pick a provider and paste your API key — everything else is configured automatically.')
const providerLabel = trans('AI provider')
const baseUrlLabel = trans('Base URL')
const baseUrlPlaceholder = trans('https://your-endpoint.example.com/v1')
const baseUrlHelper = trans('The OpenAI-compatible endpoint for your custom provider.')
const keyLabel = trans('API key')
const keyPlaceholder = trans('Paste your API key')
const keyHelper = trans('Optional — you can add or change this later in Preferences → AI.')
const noKeyHelper = trans('This provider runs locally and does not require an API key. You can change your provider later in Preferences → AI.')

const provider = ref(String(window.config.get('ai.provider') ?? DEFAULT_PROVIDER))
const baseURL = ref(String(window.config.get('ai.baseURL') ?? ''))
const apiKey = ref('')

const info = computed(() => getProviderInfo(provider.value))
const selectedNeedsKey = computed<boolean>(() => info.value.needsKey)
const isCustom = computed<boolean>(() => provider.value === 'custom')

/**
 * Persists the provider choice immediately (base URL is derived from it in main
 * for every provider except 'custom'). The pasted key box is reset so a key
 * typed for one provider is never accidentally saved against another.
 */
function onProviderChange (): void {
  window.config.set('ai.provider', provider.value)
  apiKey.value = ''
}

/**
 * Persists the custom Base URL. Only meaningful for the 'custom' provider — for
 * all others the field is hidden and the stored value is ignored in favour of
 * the provider's fixed endpoint.
 */
function saveBaseURL (): void {
  window.config.set('ai.baseURL', baseURL.value.trim())
}

/**
 * Saves the entered API key for the currently-selected provider, but only if a
 * key was actually typed and the provider requires one. Blank input is a no-op,
 * so the page stays skippable. The plaintext key travels inbound to saveKey
 * once and is never read back out.
 */
function saveKeyIfPresent (): void {
  const trimmed = apiKey.value.trim()
  if (trimmed === '' || !selectedNeedsKey.value) {
    return
  }

  window.ai.saveKey(provider.value, trimmed)
    .catch(err => {
      console.error('[AISetupPage] Could not save the API key:', err)
    })
}
</script>

<style lang="less" scoped>
label {
  display: block;
  font-weight: bold;
  margin-bottom: 8px;
}

select, input {
  width: 100%;
  box-sizing: border-box;
}

input {
  color: inherit;
  background-color: transparent;
  border: 1px solid #999;
  border-radius: 8px;
  padding: 10px 20px;
}

span.helper, p.helper {
  display: block;
  margin-top: 8px;
  opacity: 0.8;
}
</style>
