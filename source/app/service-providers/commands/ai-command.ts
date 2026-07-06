/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        AICommand command
 * CVM-Role:        <none>
 * Maintainer:      Mint Stylus (AI-generated)
 * License:         GNU GPL v3
 *
 * Description:     Forwards a named AI preset (SHORTEN, SUMMARIZE, SYNONYMS,
 *                  ALTERNATIVES, CHALLENGE_IDEA) from the AI menu
 *                  (menu.win32.ts / menu.darwin.ts) to the focused main window's
 *                  renderer. The renderer (App.vue, owned by a sibling agent)
 *                  listens on the 'ai-command' IPC channel and runs the preset
 *                  on the current selection / page via the AI Pinia store.
 *
 *                  A dedicated 'ai-command' channel is used rather than the
 *                  existing string-only 'shortcut' channel because this message
 *                  must carry a structured payload ({ command }).
 *
 *                  NOTE: This file was created by AI for Mint Stylus. It has no
 *                  upstream Zettlr counterpart.
 *
 * END HEADER
 */

import ZettlrCommand from './zettlr-command'
import type { AppServiceContainer } from 'source/app/app-service-container'

/**
 * The AI preset commands the menu can dispatch. Kept in sync with the ids the AI
 * menu emits (menu.win32.ts / menu.darwin.ts) and with the presets the renderer
 * store knows how to run.
 */
const AI_COMMANDS = [
  'SHORTEN',
  'SUMMARIZE',
  'SYNONYMS',
  'ALTERNATIVES',
  'CHALLENGE_IDEA'
] as const

type AICommandName = typeof AI_COMMANDS[number]

/**
 * The payload shape delivered over the 'ai-command' IPC channel to the renderer.
 */
export interface AICommandIPCPayload {
  command: AICommandName
}

export default class AICommand extends ZettlrCommand {
  constructor (app: AppServiceContainer) {
    super(app, 'ai-command')
  }

  /**
   * Forwards the requested AI preset to the focused main window's renderer.
   *
   * @param   {string}                    _evt  The event name (unused)
   * @param   {{ command?: string }|any}  arg   Payload naming the preset
   *
   * @return  {Promise<boolean>}  True if the message was dispatched to a window
   */
  async run (_evt: string, arg: { command?: string } | undefined): Promise<boolean> {
    const command = arg?.command
    if (typeof command !== 'string' || !AI_COMMANDS.includes(command as AICommandName)) {
      this._app.log.error(`[AICommand] Refusing to dispatch unknown AI command: ${String(command)}`)
      return false
    }

    const targetWindow = this._app.windows.getFirstMainWindow()
    if (targetWindow === undefined) {
      this._app.log.warning('[AICommand] Cannot run AI command: no main window is open.')
      return false
    }

    const payload: AICommandIPCPayload = { command: command as AICommandName }
    targetWindow.webContents.send('ai-command', payload)
    return true
  }
}
