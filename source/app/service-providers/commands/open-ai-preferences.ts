/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        OpenAIPreferences command
 * CVM-Role:        <none>
 * Maintainer:      Mint Stylus (AI-generated)
 * License:         GNU GPL v3
 *
 * Description:     Opens the Preferences window so the user can enter their AI
 *                  API keys and pick a model. Invoked from the AI menu
 *                  (menu.win32.ts / menu.darwin.ts) via
 *                  commands.run('open-ai-preferences').
 *
 *                  NOTE: This file was created by AI for Mint Stylus. It has no
 *                  upstream Zettlr counterpart.
 *
 *                  The Preferences window currently has no dedicated "AI" tab
 *                  (that group is added by a sibling agent's phase). Until a
 *                  PreferencesGroups.AI value exists, this command simply opens
 *                  the Preferences window; once the AI group lands, the window
 *                  provider can be taught to preselect it (see the risks note in
 *                  the build report).
 *
 * END HEADER
 */

import ZettlrCommand from './zettlr-command'
import type { AppServiceContainer } from 'source/app/app-service-container'

export default class OpenAIPreferences extends ZettlrCommand {
  constructor (app: AppServiceContainer) {
    super(app, 'open-ai-preferences')
  }

  /**
   * Opens the Preferences window.
   *
   * @param   {string}  _evt  The event name (unused)
   * @param   {any}     _arg  No payload is required
   *
   * @return  {Promise<boolean>}  Resolves true once the window has been requested
   */
  async run (_evt: string, _arg: any): Promise<boolean> {
    this._app.windows.showPreferences()
    return true
  }
}
