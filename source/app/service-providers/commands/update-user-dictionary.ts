/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        UpdateUserDictionary command
 * CVM-Role:        <none>
 * Maintainer:      Hendrik Erz
 * License:         GNU GPL v3
 *
 * Description:     This command updates one or more project properties.
 *
 * END HEADER
 */

import type { AppServiceContainer } from 'source/app/app-service-container'
import AppCommand from './app-command'

export default class UpdateUserDictionary extends AppCommand {
  constructor (app: AppServiceContainer) {
    super(app, 'update-user-dictionary')
  }

  /**
    * Updates the user dictionary
    * @param {String} evt The event name
    * @param  {Object} arg An array containing a new user dictionary.
    * @return {Boolean} Whether or not the call succeeded
    */
  async run (evt: string, arg: string[]): Promise<boolean> {
    return this._app.dictionary.setUserDictionary(arg)
  }
}
