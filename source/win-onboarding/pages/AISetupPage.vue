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
    >
      <option
        v-for="option in providerOptions"
        v-bind:key="option.slug"
        v-bind:value="option.slug"
      >
        {{ option.label }}
      </option>
    </select>
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
import { trans } from 'source/common/i18n-renderer'
import { ref, computed, watch } from 'vue'

// ==== AI-created for Mint Stylus ====
// Deliberately simple AI onboarding: the user picks a provider and (optionally)
// pastes a key. Nothing about base URLs or endpoints is ever shown — the base
// URL is derived automatically from the provider in the main process. The key,
// if entered, travels inbound ONCE via window.ai.saveKey (encrypted in main)
// and is never read back out. Skipping this page is fine; keys can be added
// later in Preferences → AI.
//
// The provider list mirrors the AIProvider main service and the Preferences AI
// tab (source/win-preferences/schema/ai.ts). No shared util
// (source/common/util/ai-providers.ts) exists yet, so the 4 options are inlined
// here; slugs MUST stay in lock-step with the main service and config
// validation.
interface AIProviderDescriptor {
  slug: string
  label: string
  needsKey: boolean
}

const providerOptions: AIProviderDescriptor[] = [
  { slug: 'openrouter', label: 'OpenRouter', needsKey: true },
  { slug: 'ollama-cloud', label: 'Ollama Cloud', needsKey: true },
  { slug: 'zai', label: 'Z.ai (GLM)', needsKey: true },
  { slug: 'ollama-local', label: 'Ollama (local)', needsKey: false }
]

const pageHeading = trans('AI setup')
const intro = trans('Choose an AI provider to enable the writing assistant. Just pick a provider and paste your API key — everything else is configured automatically.')
const providerLabel = trans('AI provider')
const keyLabel = trans('API key')
const keyPlaceholder = trans('Paste your API key')
const keyHelper = trans('Optional — you can add or change this later in Preferences → AI.')
const noKeyHelper = trans('This provider runs locally and does not require an API key. You can change your provider later in Preferences → AI.')

const provider = ref(String(window.config.get('ai.provider') ?? 'openrouter'))
const apiKey = ref('')

const selectedNeedsKey = computed(() => {
  const descriptor = providerOptions.find(p => p.slug === provider.value)
  return descriptor?.needsKey ?? true
})

// Persist the provider choice immediately (base URL is derived from it in main).
watch(provider, () => {
  window.config.set('ai.provider', provider.value)
})

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
