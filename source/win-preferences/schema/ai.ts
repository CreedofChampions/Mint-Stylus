/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        AI Preferences Schema
 * CVM-Role:        Model
 * Maintainer:      Mint Stylus
 * License:         GNU GPL v3
 *
 * Description:     Exports the AI tab schema. The provider + API-key setup is a
 *                  dedicated, deliberately simple control (AIProviderControl.vue):
 *                  pick a provider, paste a key, done. The API endpoint and a
 *                  default model are derived automatically from the provider, so
 *                  the user never sees a URL. API keys are NEVER stored in the
 *                  config group — they travel inbound-only through
 *                  window.ai.saveKey (encrypted in the main-process AIProvider)
 *                  and are never read back into the renderer.
 *
 *                  ==== AI-created for Mint Stylus ====
 *
 * END HEADER
 */

import { trans } from '@common/i18n-renderer'
import { type PreferencesFieldset } from '../App.vue'
import { PreferencesGroups } from './_preferences-groups'
import AIProviderControl from '../AIProviderControl.vue'
import AICommandsControl from '../AICommandsControl.vue'
import AIContextControl from '../AIContextControl.vue'

/**
 * Prompts for an API key and stores it (encrypted, in main) for the given
 * provider — used for the optional web-search providers. The plaintext key only
 * ever travels inbound to saveKey; it is never read back out into the renderer.
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
      window.alert(saved
        ? trans('The API key for %s has been saved.', label)
        : trans('The API key for %s could not be saved.', label))
    })
    .catch(err => {
      console.error(err)
      window.alert(trans('The API key for %s could not be saved.', label))
    })
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
          window.alert(saved
            ? trans('Your "Write in My Style" guide has been saved.')
            : trans('Your "Write in My Style" guide could not be saved.'))
        })
    })
    .catch(err => console.error(err))
}

export function getAIFields (): PreferencesFieldset[] {
  return [
    {
      title: trans('AI Provider & Key'),
      group: PreferencesGroups.AI,
      infoString: trans('Everything lives in this one control: pick your provider, paste its API key, and choose a model (pick from the provider\'s list or type your own). For every built-in provider the API endpoint is chosen automatically, so there\'s no URL to configure — only the "Custom (OpenAI-compatible)" provider lets you type a Base URL. Your key is stored encrypted on your computer and is only ever sent to the provider you chose.'),
      help: undefined,
      fields: [
        {
          type: 'custom',
          component: AIProviderControl
        },
        {
          // Global reasoning-effort level; mirrors the top-right dropdown in
          // the main window (both read/write the same ai.thinkingLevel key).
          type: 'select',
          label: trans('Thinking level (reasoning effort for all AI requests)'),
          model: 'ai.thinkingLevel',
          options: {
            off: trans('Off'),
            low: trans('Low'),
            medium: trans('Medium'),
            high: trans('High')
          }
        }
      ]
    },
    {
      title: trans('Context source'),
      group: PreferencesGroups.AI,
      infoString: trans('Plug a local folder group or an MCP server in as extra context for every AI request. It turns on automatically once set, and you can switch it with the "Context:" dropdown at the top of the editor.'),
      help: undefined,
      fields: [
        {
          type: 'custom',
          component: AIContextControl
        }
      ]
    },
    {
      title: trans('AI Commands'),
      group: PreferencesGroups.AI,
      infoString: trans('The commands offered when you highlight text and choose "Command" (and in the AI menu). Edit their prompts, change how each one presents its output, add your own, or reset them to the defaults.'),
      help: undefined,
      fields: [
        {
          type: 'custom',
          component: AICommandsControl
        }
      ]
    },
    {
      title: trans('Web Search (optional)'),
      group: PreferencesGroups.AI,
      infoString: trans('Let the AI look things up on the web. Leave this off if you don\'t need it. When on, say "search" in an AI request to fetch live results.'),
      help: undefined,
      fields: [
        {
          type: 'select',
          label: trans('Search provider'),
          model: 'ai.searchProvider',
          options: {
            none: trans('Off'),
            tavily: 'Tavily (free tier, no card)',
            brave: 'Brave'
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
              window.alert(trans('Turn on a search provider first, then set its key.'))
            }
          }
        }
      ]
    },
    {
      title: trans('Write in My Style'),
      group: PreferencesGroups.AI,
      infoString: trans('Optional: describe your tone and formatting once, and Mint Stylus keeps generated text in your voice.'),
      help: undefined,
      fields: [
        {
          type: 'button',
          label: trans('Edit Write-in-My-Style guide…'),
          onClick: () => { editStyleFile() }
        }
      ]
    }
  ]
}
