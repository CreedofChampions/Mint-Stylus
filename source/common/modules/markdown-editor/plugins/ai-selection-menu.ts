/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        AI Selection Menu
 * CVM-Role:        Extension
 * Maintainer:      Mint Stylus
 * License:         GNU GPL v3
 *
 * Description:     AI-CREATED FOR MINT STYLUS.
 *                  This CodeMirror 6 extension shows a small, non-blocking
 *                  floating bubble ("Summarize | Command") above a non-empty
 *                  selection. It is implemented as a tooltip (not a modal), so
 *                  it never covers the rest of the document — the user can keep
 *                  reading while it is visible. Clicking a button hands the
 *                  selected text and its range to the injected handlers, which
 *                  the renderer wires up to open the AI panel (via the Pinia AI
 *                  store). No AI/HTTP call happens here: this file only surfaces
 *                  the selection to the renderer; every model call and API key
 *                  lives exclusively in the Electron main process (AIProvider).
 *
 * END HEADER
 */

import { EditorView, ViewPlugin, showTooltip, type Tooltip } from '@codemirror/view'
import { StateField, type EditorState, type Extension, type SelectionRange } from '@codemirror/state'
import { trans } from '@common/i18n-renderer'

/**
 * Describes the selection that the user acted upon. This is the payload handed
 * to the handlers so the renderer can (a) show the AI panel and (b) later
 * replace the exact range (e.g. the Summarize flow's 7 rewrite options).
 */
export interface AISelection {
  /** Absolute document offset where the selection begins. */
  from: number
  /** Absolute document offset where the selection ends. */
  to: number
  /** The plain text contained within the selection. */
  text: string
}

/**
 * The set of callbacks the editor host must provide. The MarkdownEditor is
 * created centrally, so the integrator injects these there (wiring them to the
 * Pinia AI store actions that open the AI panel). Both receive the current
 * selection; the buttons do nothing observable on their own.
 */
export interface AISelectionMenuHandlers {
  /**
   * Invoked when the user clicks one of the quick command buttons (Shorten,
   * Summarize, Synonyms, Alternatives). Receives the command id + the selection.
   */
  onRunCommand: (commandId: string, selection: AISelection) => void
  /** Invoked when the user clicks "More…" (opens the full command chooser). */
  onCommand: (selection: AISelection) => void
}

/**
 * The quick commands shown directly in the selection bubble, so the four most
 * common actions are one click away without opening the chooser. The ids match
 * the built-in COMMANDS; Challenge Idea and any user-added custom commands live
 * behind the "More…" button. Labels are the built-ins' default names.
 */
const QUICK_COMMANDS: Array<{ id: string, label: string }> = [
  { id: 'SHORTEN', label: 'Shorten' },
  { id: 'SUMMARIZE', label: 'Summarize' },
  { id: 'SYNONYMS', label: 'Synonyms' },
  { id: 'ALTERNATIVES', label: 'Alternatives' }
]

/**
 * Reads the main selection out of the state and turns it into an AISelection.
 * Returns undefined when the selection is empty (nothing to act upon).
 *
 * @param   {EditorState}           state  The current editor state
 *
 * @return  {AISelection|undefined}        The selection payload, or undefined
 */
function getSelection (state: EditorState): AISelection|undefined {
  const mainSel = state.selection.main
  if (mainSel.empty) {
    return undefined
  }

  return {
    from: mainSel.from,
    to: mainSel.to,
    text: state.sliceDoc(mainSel.from, mainSel.to)
  }
}

/**
 * Computes the document position at which the bubble should be anchored.
 * Normally that is the selection head (so the bubble tracks the caret end).
 * But when the head sits outside of what is currently on screen — most
 * prominently after Ctrl+A/Cmd+A, where the head lands at the very END of the
 * document, potentially thousands of lines below the fold — anchoring there
 * would render the bubble at the bottom of the document (or not at all). In
 * that case the anchor is clamped into the currently visible line range, so
 * the bubble appears where the user is actually looking, while always staying
 * within the selection itself.
 *
 * NOTE: `view.viewport`/`view.visibleRanges` include CodeMirror's off-screen
 * rendering margin (~1000px beyond the screen), so the truly visible lines are
 * derived from the scroll geometry instead (Marijn's recommended recipe).
 *
 * @param   {SelectionRange}        sel   The main selection range
 * @param   {EditorView|undefined}  view  The editor view, if already available
 *
 * @return  {number}                      The anchor position for the tooltip
 */
function computeAnchorPos (sel: SelectionRange, view: EditorView|undefined): number {
  if (view === undefined) {
    // No view yet (initial state creation) -> best effort: the head.
    return sel.head
  }

  const scrollRect = view.scrollDOM.getBoundingClientRect()
  const firstVisible = view.lineBlockAtHeight(scrollRect.top - view.documentTop).from
  const lastVisible = view.lineBlockAtHeight(scrollRect.bottom - view.documentTop).to

  if (sel.head >= firstVisible && sel.head <= lastVisible) {
    // The head is on screen: anchor there, as usual.
    return sel.head
  }

  // The head is off screen: clamp the anchor into the intersection of the
  // visible range and the selection (the selection always intersects the
  // screen here, because a Select-All-like selection spans past it).
  return Math.min(Math.max(sel.from, firstVisible), Math.min(sel.to, lastVisible))
}

/**
 * Builds the (zero or one) tooltips describing the AI selection bubble. When
 * the selection is non-empty, a single tooltip is anchored at the selection
 * head (clamped into the visible viewport, see computeAnchorPos) and forced to
 * render above the text so it does not obscure the lines the user is reading
 * below.
 *
 * @param   {EditorState}              state     The current editor state
 * @param   {AISelectionMenuHandlers}  handlers  The injected callbacks
 * @param   {EditorView|undefined}     view      The editor view (for viewport
 *                                               clamping), if available
 *
 * @return  {Tooltip[]}                          Zero or one tooltip
 */
function getAiSelectionTooltips (state: EditorState, handlers: AISelectionMenuHandlers, view: EditorView|undefined): Tooltip[] {
  const selection = getSelection(state)
  if (selection === undefined) {
    return []
  }

  const mainSel = state.selection.main

  return [{
    // Anchor the bubble at the selection's head so it tracks the caret end;
    // if the head is off screen (e.g. Select All), clamp the anchor into the
    // visible viewport so the bubble shows where the user is looking.
    pos: computeAnchorPos(mainSel, view),
    // Render above the selection: this keeps the text below fully visible so
    // the bubble never blocks reading (a tooltip, not a modal).
    above: true,
    strictSide: false,
    arrow: true,
    create: (_view) => {
      const dom = document.createElement('div')
      dom.className = 'cm-ai-selection-menu'

      const buttonWrapper = document.createElement('div')
      buttonWrapper.className = 'button-wrapper'

      // NOTE: We use onmousedown (mirroring the formatting toolbar) rather than
      // onclick. A click only fires on mouseup, by which point moving the mouse
      // to the button may have altered the selection and re-rendered the
      // tooltip. Handling mousedown and preventing default keeps the selection
      // intact so the payload we hand off is the one the user actually saw. We
      // also re-read the selection at click time so the payload is current.

      // The four quick commands, one click away.
      for (const qc of QUICK_COMMANDS) {
        const btn = document.createElement('button')
        btn.classList.add('ai-selection-menu-button')
        btn.setAttribute('title', trans('Run "%s" on the selected text', qc.label))
        btn.textContent = trans(qc.label)
        btn.onmousedown = function (event) {
          // Left button only — mousedown (unlike click) fires for right/middle
          // buttons too, and those must not launch an AI request.
          if (event.button !== 0) {
            return
          }
          event.preventDefault()
          const current = getSelection(state)
          if (current !== undefined) {
            handlers.onRunCommand(qc.id, current)
          }
        }
        buttonWrapper.append(btn)
      }

      // "More…" opens the full command chooser (Challenge Idea, custom commands,
      // and the one-off "tell the AI what to do" input).
      const more = document.createElement('button')
      more.classList.add('ai-selection-menu-button')
      more.setAttribute('title', trans('More AI commands (custom, challenge idea, one-off…)'))
      more.textContent = trans('More…')
      more.onmousedown = function (event) {
        if (event.button !== 0) {
          return
        }
        event.preventDefault()
        const current = getSelection(state)
        if (current !== undefined) {
          handlers.onCommand(current)
        }
      }
      buttonWrapper.append(more)

      dom.append(buttonWrapper)

      return { dom }
    }
  }]
}

/**
 * A minimal base theme for the AI selection bubble. Kept intentionally sparse
 * and class-driven so themes can restyle it; only structural rules live here.
 */
const aiSelectionMenuTheme = EditorView.baseTheme({
  '.cm-tooltip.cm-ai-selection-menu': {
    borderRadius: '8px',
    maxWidth: 'initial',
    overflow: 'hidden'
  },
  '.cm-tooltip.cm-ai-selection-menu .button-wrapper': {
    display: 'flex',
    flexWrap: 'wrap'
  },
  '.cm-tooltip.cm-ai-selection-menu button.ai-selection-menu-button': {
    border: 'none',
    margin: '0',
    backgroundColor: 'transparent',
    borderRadius: '0',
    lineHeight: '30px',
    padding: '0 12px',
    fontSize: '13px',
    whiteSpace: 'nowrap',
    cursor: 'pointer'
  },
  '.cm-tooltip.cm-ai-selection-menu button.ai-selection-menu-button + button.ai-selection-menu-button': {
    borderLeft: '1px solid rgba(128, 128, 128, 0.35)'
  }
})

/**
 * Factory that returns the AI selection menu extension. The editor is created
 * centrally, so the integrator calls this once with handlers wired to the
 * renderer's Pinia AI store (open the AI panel with the selection). The
 * returned extension bundles a StateField (which derives the tooltip list from
 * the selection and provides it to showTooltip) plus the base theme.
 *
 * @param   {AISelectionMenuHandlers}  handlers  Callbacks for the two buttons
 *
 * @return  {Extension}                          The composed extension
 */
export function aiSelectionMenu (handlers: AISelectionMenuHandlers): Extension {
  // The tooltip list is derived in a StateField, but clamping the bubble into
  // the visible viewport requires the EditorView (scroll geometry lives on the
  // view, not the state). This factory is called once per editor instance (in
  // getMarkdownExtensions), so a per-closure reference is safe: this tiny
  // ViewPlugin only records the view so the field's compute functions can read
  // the viewport when (re)computing the tooltip anchor.
  let currentView: EditorView|undefined
  const viewCapture = ViewPlugin.define(view => {
    currentView = view
    return {
      destroy () {
        currentView = undefined
      }
    }
  })

  const aiSelectionMenuField = StateField.define<readonly Tooltip[]>({
    create (state) {
      return getAiSelectionTooltips(state, handlers, currentView)
    },

    update (tooltips, transaction) {
      return getAiSelectionTooltips(transaction.state, handlers, currentView)
    },

    provide: f => showTooltip.computeN([f], state => state.field(f))
  })

  return [
    viewCapture,
    aiSelectionMenuField,
    aiSelectionMenuTheme
  ]
}
