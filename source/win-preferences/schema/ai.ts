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
      infoString: trans('Choose which AI provider Mint Stylus should use. API keys are stored securely and never leave the main process.'),
      help: undefined,
      fields: [
        {
          type: 'select',
          label: trans('AI provider'),
          model: 'ai.provider',
          options: {
            openrouter: 'OpenRouter',
            zai: 'Z.ai',
            'ollama-cloud': 'Ollama Cloud',
            'ollama-local': 'Ollama (local)'
          }
        },
        {
          type: 'text',
          label: trans('Base URL'),
          model: 'ai.baseURL',
          reset: 'https://openrouter.ai/api/v1',
          info: trans('The OpenAI-compatible API endpoint for the selected provider.')
        },
        {
          type: 'text',
          label: trans('Model'),
          model: 'ai.model',
          reset: 'z-ai/glm-5.2',
          info: trans('The model identifier to use (e.g. z-ai/glm-5.2). Available models can be discovered from your provider.')
        }
      ]
    },
    {
      title: trans('API Keys'),
      group: PreferencesGroups.AI,
      infoString: trans('API keys are encrypted by the main process and are never stored in your configuration file or shown again.'),
      help: undefined,
      fields: [
        {
          type: 'button',
          label: trans('Set OpenRouter key…'),
          onClick: () => { promptForKey('openrouter', 'OpenRouter') }
        },
        {
          type: 'button',
          label: trans('Set Tavily key…'),
          onClick: () => { promptForKey('tavily', 'Tavily') }
        },
        {
          type: 'button',
          label: trans('Set Brave key…'),
          onClick: () => { promptForKey('brave', 'Brave') }
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
