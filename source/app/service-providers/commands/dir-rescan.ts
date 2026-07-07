/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        DirRescan command
 * CVM-Role:        <none>
 * Maintainer:      Hendrik Erz
 * License:         GNU GPL v3
 *
 * Description:     This command rescans a not-found directory.
 *
 * END HEADER
 */

import type { AppServiceContainer } from 'source/app/app-service-container'
import AppCommand from './app-command'

export default class DirRescan extends AppCommand {
  constructor (app: AppServiceContainer) {
    super(app, 'rescan-dir')
  }

  /**
    * Rescans a directory
    * @param {String} evt The event name
    * @param  {Object} arg The path of the descriptor
    */
  async run (event: string, _arg: any): Promise<void> {
    // DEBUG: DEPRECATED
    throw new Error('rescanForDirectory not re-implemented')
  }
}
