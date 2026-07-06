/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        Active editor registry
 * CVM-Role:        Utility
 * Maintainer:      Mint Stylus
 * License:         GNU GPL v3
 *
 * Description:     AI-CREATED FOR MINT STYLUS.
 *                  A tiny module-level registry that maps a leaf id to the live
 *                  MarkdownEditor instance currently mounted in that leaf. The
 *                  AI surfaces (the Summarize bubble, the AI panel's replace /
 *                  recover actions, and the AI-command menu entries) all live in
 *                  App.vue, but the actual CodeMirror EditorView is owned deep
 *                  down the component tree by MainEditor. Rather than thread a
 *                  Vue ref through EditorPane -> EditorBranch -> MainEditor (and
 *                  fight Vue's reactivity for a plain, imperative handle), each
 *                  MainEditor registers its MarkdownEditor here on mount and
 *                  removes it on unmount. App.vue then resolves the active editor
 *                  via the document tree store's `lastLeafId`. This keeps the
 *                  existing prop-as-event editor bus untouched; the registry is a
 *                  read-only, imperative escape hatch used ONLY for the AI
 *                  view.dispatch seam.
 *
 * END HEADER
 */

import type MarkdownEditor from '@common/modules/markdown-editor'

/**
 * The live MarkdownEditor instances, keyed by their leaf id. At most one editor
 * is mounted per leaf at a time.
 */
const registry = new Map<string, MarkdownEditor>()

/**
 * Registers (or replaces) the MarkdownEditor mounted in the given leaf.
 *
 * @param  {string}          leafId  The id of the leaf the editor lives in.
 * @param  {MarkdownEditor}  editor  The live MarkdownEditor instance.
 */
export function registerEditor (leafId: string, editor: MarkdownEditor): void {
  registry.set(leafId, editor)
}

/**
 * Removes the editor registered for the given leaf, but only if it is still the
 * same instance (guards against a late unmount clobbering a freshly-mounted
 * editor after a document swap).
 *
 * @param  {string}          leafId  The id of the leaf being torn down.
 * @param  {MarkdownEditor}  editor  The instance that is unmounting.
 */
export function unregisterEditor (leafId: string, editor: MarkdownEditor): void {
  if (registry.get(leafId) === editor) {
    registry.delete(leafId)
  }
}

/**
 * Resolves the MarkdownEditor for the given leaf id, or undefined when none is
 * registered (e.g. the active leaf shows an image / PDF viewer, or nothing).
 *
 * @param   {string|undefined}       leafId  The leaf id to look up.
 *
 * @return  {MarkdownEditor|undefined}        The editor, or undefined.
 */
export function getEditorForLeaf (leafId: string|undefined): MarkdownEditor|undefined {
  if (leafId === undefined) {
    return undefined
  }
  return registry.get(leafId)
}
