/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        AI Preferences Schema
 * CVM-Role:        Model
 * Maintainer:      Mint Stylus
 * License:         GNU GPL v3
 *
 * Description:     Exports the AI tab schema. This tab binds the ai.* config
 *                  group (provider, model, search provider, and the optional
 *                  "Write in My Style" file path) and exposes secure actions to
 *                  set per-provider API keys. API keys are NEVER stored in the
 *                  config group: they travel inbound-only through
 *                  window.ai.saveKey (encrypted in the main-process AIProvider)
 *                  and are never read back into the renderer.
 *
 * END HEADER
 */

import { trans } from '@common/i18n-renderer'
import { type PreferencesFieldset } from '../App.vue'
import { PreferencesGroups } from './_preferences-groups'

/**
 * The list of AI providers, their friendly labels, and whether they require an
 * API key. This is inlined here because the shared renderer-safe list
 * (source/common/util/ai-providers.ts) does not exist yet. If/when that module
 * lands, replace this with an import from there to keep a single source of
 * truth. The slugs MUST match the AIProvider main service
 * (source/app/service-providers/ai/index.ts) and the config validation.
 */
interface AIProviderDescriptor {
  slug: string
  label: string
  needsKey: boolean
}

const PROVIDERS: AIProviderDescriptor[] = [
  { slug: 'openrouter', label: 'OpenRouter', needsKey: true },
  { slug: 'ollama-cloud', label: 'Ollama Cloud', needsKey: true },
  { slug: 'zai', label: 'Z.ai (GLM)', needsKey: true },
  { slug: 'ollama-local', label: 'Ollama (local)', needsKey: false }
]

/** Provider slug → friendly label, for the select field options. */
const PROVIDER_OPTIONS: Record<string, string> = Object.fromEntries(
  PROVIDERS.map(p => [p.slug, p.label])
)

/**
 * Prompts for an API key and stores it (encrypted, in main) for the given
 * provider. The plaintext key only ever travels inbound to saveKey; it is never
 * read back out into the renderer, preserving contextIsolation guarantees.
 *
 * @param   {string}  provider  The provider slug to store the key for.
 * @param   {string}  label     Human-readable provider name for the prompt.
 */
function promptForKey (provider: string, label: string): void {
  const key = window.prompt(trans('Enter the API key for %s. It will be stored encrypted and never displayed again.', label))
  if (key === null) {
    return // User cancelled
  }

  const trimmed = key.trim()
  if (trimmed === '') {
    return // Nothing to save
  }

  window.ai.saveKey(provider, trimmed)
    .then(saved => {
      if (saved) {
        window.alert(trans('The API key for %s has been saved.', label))
      } else {
        window.alert(trans('The API key for %s could not be saved.', label))
      }
    })
    .catch(err => {
      console.error(err)
      window.alert(trans('The API key for %s could not be saved.', label))
    })
}

/**
 * Sets the API key for the CURRENTLY-SELECTED AI provider. Reads the live
 * ai.provider value from config, resolves its descriptor, and either informs
 * the user that no key is required (ollama-local) or prompts for and stores the
 * key. The base URL is derived automatically from the provider in the main
 * process; the user never sees or types it.
 */
function setKeyForSelectedProvider (): void {
  const slug = String(window.config.get('ai.provider') ?? 'openrouter')
  const provider = PROVIDERS.find(p => p.slug === slug)
  const label = provider?.label ?? slug

  if (provider !== undefined && !provider.needsKey) {
    window.alert(trans('%s runs locally and does not require an API key.', label))
    return
  }

  promptForKey(slug, label)
}

/**
 * Opens the "Write in My Style" precursor text for editing. Reads the current
 * value via window.ai.getStyle(), lets the user edit it inline, and persists it
 * with window.ai.setStyle(). All key/HTTP/file work stays in the main process.
 */
function editStyleFile (): void {
  window.ai.getStyle()
    .then(current => {
      const edited = window.prompt(trans('Edit your "Write in My Style" guide. This text is prepended to style-aware requests.'), current)
      if (edited === null) {
        return // User cancelled
      }

      return window.ai.setStyle(edited)
        .then(saved => {
          if (saved) {
            window.alert(trans('Your "Write in My Style" guide has been saved.'))
          } else {
            window.alert(trans('Your "Write in My Style" guide could not be saved.'))
          }
        })
    })
    .catch(err => console.error(err))
}

export function getAIFields (): PreferencesFieldset[] {
  return [
    {
      title: trans('Provider'),
      group: PreferencesGroups.AI,
      infoString: trans('Pick your AI provider and enter its API key. Everything else is configured automatically. API keys are stored securely and never leave the main process.'),
      help: undefined,
      fields: [
        {
          type: 'select',
          label: trans('AI provider'),
          model: 'ai.provider',
          options: PROVIDER_OPTIONS
        },
        {
          type: 'button',
          label: trans('Set API key…'),
          onClick: () => { setKeyForSelectedProvider() }
        },
        {
          type: 'text',
          label: trans('Model'),
          model: 'ai.model',
          placeholder: trans('leave blank to use the provider default'),
          info: trans('Optional. Leave blank to use the provider default, or enter a specific model identifier.')
        }
      ]
    },
    {
      title: trans('Web Search'),
      group: PreferencesGroups.AI,
      infoString: trans('Optionally augment AI responses with live web search results.'),
      help: undefined,
      fields: [
        {
          type: 'select',
          label: trans('Search provider'),
          model: 'ai.searchProvider',
          options: {
            tavily: 'Tavily',
            brave: 'Brave',
            none: trans('None')
          }
        },
        {
          type: 'button',
          label: trans('Set search key…'),
          onClick: () => {
            const provider = String(window.config.get('ai.searchProvider') ?? 'none')
            if (provider === 'tavily') {
              promptForKey('tavily', 'Tavily')
            } else if (provider === 'brave') {
              promptForKey('brave', 'Brave')
            } else {
              window.alert(trans('Select a search provider first to set its key.'))
            }
          }
        }
      ]
    },
    {
      title: trans('Write in My Style'),
      group: PreferencesGroups.AI,
      infoString: trans('Provide a style guide that Mint Stylus prepends to style-aware requests so generated text matches your voice.'),
      help: undefined,
      fields: [
        {
          type: 'button',
          label: trans('Edit Write-in-My-Style file…'),
          onClick: () => { editStyleFile() }
        },
        {
          type: 'file',
          reset: true,
          model: 'ai.styleFilePath'
        },
        {
          type: 'form-text',
          display: 'info',
          contents: trans('Optionally point to a file on disk containing your style guide, or use the button above to edit the guide inline.')
        }
      ]
    }
  ]
}
