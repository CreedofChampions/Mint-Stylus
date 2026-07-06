/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        OpenAIStyle command
 * CVM-Role:        <none>
 * Maintainer:      Mint Stylus (AI-generated)
 * License:         GNU GPL v3
 *
 * Description:     Opens the user's "Write in My Style" precursor file
 *                  (mint-style.md, under userData) as a normal editor document
 *                  so it can be edited in place. Invoked from the AI menu
 *                  (menu.win32.ts / menu.darwin.ts) via
 *                  commands.run('open-ai-style').
 *
 *                  The AIProvider writes a default template to this file on
 *                  first boot, so it normally already exists; as a safety net
 *                  this command re-creates an empty file if it is missing before
 *                  handing it to the documents provider (which refuses to open a
 *                  non-existent path).
 *
 *                  NOTE: This file was created by AI for Mint Stylus. It has no
 *                  upstream Zettlr counterpart.
 *
 * END HEADER
 */

import path from 'path'
import { promises as fs } from 'fs'
import { app } from 'electron'
import ZettlrCommand from './zettlr-command'
import type { AppServiceContainer } from 'source/app/app-service-container'

/**
 * The filename (under userData) of the "Write in My Style" guide. MUST stay in
 * sync with STYLE_FILE in source/app/service-providers/ai/index.ts.
 */
const STYLE_FILE = 'mint-style.md'

export default class OpenAIStyle extends ZettlrCommand {
  constructor (app: AppServiceContainer) {
    super(app, 'open-ai-style')
  }

  /**
   * Opens the "Write in My Style" file for editing.
   *
   * @param   {string}  _evt  The event name (unused)
   * @param   {any}     _arg  No payload is required
   *
   * @return  {Promise<boolean>}  Resolves true if the file was opened
   */
  async run (_evt: string, _arg: any): Promise<boolean> {
    const stylePath = this._resolveStyleFile()

    // Make sure the file exists before asking the documents provider to open it
    // (it throws on a non-existent path). AIProvider normally creates this at
    // boot; this is a defensive fallback only.
    try {
      await fs.access(stylePath)
    } catch {
      try {
        await fs.writeFile(stylePath, '', { encoding: 'utf-8' })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        this._app.log.error(`[OpenAIStyle] Could not create the style file at ${stylePath}: ${message}`, err)
        return false
      }
    }

    // windowId/leafId are left undefined so the documents provider resolves the
    // last-focused main window and leaf itself (mirrors the recent-docs menu).
    return await this._app.documents.openFile(undefined, undefined, stylePath, true)
  }

  /**
   * Resolve the absolute path to the "Write in My Style" file. A configured
   * `ai.styleFilePath` wins; otherwise fall back to the userData default. MUST
   * mirror AIProvider._resolveStyleFile so both open/read the same file.
   */
  private _resolveStyleFile (): string {
    let configured: string | undefined
    try {
      configured = this._app.config.get('ai.styleFilePath') as string | undefined
    } catch {
      configured = undefined
    }

    if (typeof configured === 'string' && configured.trim().length > 0) {
      return configured.trim()
    }

    return path.join(app.getPath('userData'), STYLE_FILE)
  }
}
