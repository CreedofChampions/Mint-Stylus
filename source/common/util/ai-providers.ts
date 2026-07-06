// created by AI
/**
 * BEGIN HEADER
 *
 * Contains:        AI provider catalogue (shared, renderer-safe)
 * CVM-Role:        Utility
 * Maintainer:      Mint Stylus
 * License:         GNU GPL v3
 *
 * Description:     The single source of truth for the AI providers Mint Stylus
 *                  supports. Each provider maps its slug to a fixed API base URL
 *                  plus display metadata. This module holds NO Electron / Node
 *                  imports so it can be imported from BOTH the main process
 *                  (AIProvider) and the renderer (preferences + onboarding). The
 *                  base URL is derived automatically from the chosen provider —
 *                  users pick a provider and enter a key; they never see or type
 *                  an endpoint URL.
 *
 *                  ==== AI-created for Mint Stylus ====
 *                  This file was authored by AI as part of the Mint Stylus fork
 *                  of Zettlr. It has no upstream Zettlr counterpart.
 *
 * END HEADER
 */

/**
 * A single AI provider's fixed configuration and display metadata.
 */
export interface AIProviderInfo {
  /**
   * The human-readable label shown in dropdowns.
   */
  label: string
  /**
   * The fixed OpenAI-compatible API base URL for this provider. Derived
   * automatically from the provider — never surfaced in the UI.
   */
  baseURL: string
  /**
   * Whether this provider requires an API key. Local backends (Ollama) do not.
   */
  needsKey: boolean
  /**
   * The default model to use for this provider when the user has not chosen one.
   */
  defaultModel: string
  /**
   * Where the user gets an API key for this provider (empty for key-less local
   * providers). Shown as a "Get a key" link in the settings so users know
   * exactly where to go.
   */
  keyUrl: string
}

/**
 * The canonical catalogue of supported AI providers, keyed by slug. This is the
 * ONE source of truth for provider slugs, endpoints, key requirements, and
 * default models. The main process resolves outbound base URLs / models from
 * here; the renderer builds its provider dropdown and per-provider key labels
 * from the same object so the two can never drift.
 */
export const PROVIDERS = {
  openrouter: {
    label: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    needsKey: true,
    defaultModel: 'z-ai/glm-5.2',
    keyUrl: 'https://openrouter.ai/keys'
  },
  'ollama-cloud': {
    label: 'Ollama Cloud',
    baseURL: 'https://ollama.com/v1',
    needsKey: true,
    defaultModel: 'glm-5.2',
    keyUrl: 'https://ollama.com/settings/keys'
  },
  zai: {
    label: 'Z.ai (GLM)',
    baseURL: 'https://api.z.ai/api/paas/v4',
    needsKey: true,
    defaultModel: 'glm-5.2',
    keyUrl: 'https://z.ai/manage-apikey/apikey-list'
  },
  'ollama-local': {
    label: 'Ollama (local)',
    baseURL: 'http://localhost:11434/v1',
    needsKey: false,
    defaultModel: 'llama3.1',
    keyUrl: ''
  }
} as const satisfies Record<string, AIProviderInfo>

/**
 * The union of all supported provider slugs.
 */
export type AIProviderSlug = keyof typeof PROVIDERS

/**
 * The default provider used when none is configured or requested.
 */
export const DEFAULT_PROVIDER: AIProviderSlug = 'openrouter'

/**
 * The ordered list of provider slugs (dropdown order).
 */
export const PROVIDER_SLUGS = Object.keys(PROVIDERS) as AIProviderSlug[]

/**
 * Type guard: whether an arbitrary string is a known provider slug.
 *
 * @param   {string}   slug  The candidate slug
 *
 * @return  {boolean}        True if the slug is a supported provider
 */
export function isProviderSlug (slug: string): slug is AIProviderSlug {
  return Object.prototype.hasOwnProperty.call(PROVIDERS, slug)
}

/**
 * Resolve the metadata for a provider slug, falling back to the default provider
 * when the slug is unknown.
 *
 * @param   {string}          slug  The provider slug
 *
 * @return  {AIProviderInfo}        The provider's fixed configuration
 */
export function getProviderInfo (slug: string): AIProviderInfo {
  return isProviderSlug(slug) ? PROVIDERS[slug] : PROVIDERS[DEFAULT_PROVIDER]
}
