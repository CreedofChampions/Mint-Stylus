/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        Inline /q…q/ Question Plugin
 * CVM-Role:        Extension
 * Maintainer:      Mint Stylus
 * License:         GNU GPL v3
 *
 * Description:     Mint Stylus AI extension. Watches the document for inline
 *                  `/q <question> q/` spans. When a closing `q/` completes such
 *                  a span, the span is replaced with a "Loading…" inline widget,
 *                  an injected async `askAI(question)` callback is invoked, and
 *                  when it resolves the widget is replaced in-place with the
 *                  Markdown answer. A unique sentinel marker is written into the
 *                  document while the request is in flight so that the answer can
 *                  be spliced back in at the correct location even after the user
 *                  has edited elsewhere during the async gap.
 *
 *                  --- created by AI for Mint Stylus ---
 *
 * END HEADER
 */

import { syntaxTree } from '@codemirror/language'
import {
  StateEffect,
  StateField,
  type EditorState,
  type Extension
} from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate
} from '@codemirror/view'
import { type SyntaxNode } from '@lezer/common'
import { trans } from '@common/i18n-renderer'

/**
 * Node types inside which a `/q … q/` span must NOT be treated as a question,
 * because the user is (e.g.) writing code or a comment. Mirrors the protected
 * node list used elsewhere in the editor (see commands/autocorrect.ts).
 */
const PROTECTED_NODES = [
  'InlineCode', // `code`
  'Comment', 'CommentBlock', // <!-- comment -->
  'FencedCode', 'CodeText', // Code block
  'YAMLFrontmatter'
]

/**
 * The wall-clock delay (ms) we wait after the closing `q/` lands before firing
 * the request. This debounces bursts of edits so we only fire once, and gives
 * the user a moment in case they keep typing.
 */
const QQ_TRIGGER_DELAY = 400

/**
 * A single detected `/q … q/` span within a piece of text.
 */
export interface InlineQuerySpan {
  /** Absolute start offset of the span (the `/` of the opening `/q`). */
  from: number
  /** Absolute end offset of the span (just after the `/` of the closing `q/`). */
  to: number
  /** The trimmed question text located between the two markers. */
  question: string
}

/**
 * PURE, side-effect-free helper (exported for unit testing). Scans `text` for
 * `/q <question> q/` spans and returns their absolute character ranges plus the
 * trimmed question.
 *
 * Rules:
 * - The opener is the literal two-character token `/q` and the closer is the
 *   literal two-character token `q/`. The `q` is matched case-insensitively, so
 *   `/Q … Q/` and `/q … Q/` also work, but the `/` must be a literal slash.
 * - Spans are matched non-greedily and non-overlapping, left to right, so
 *   `/q a q/ /q b q/` yields two spans, not one span from the first to the last.
 * - The question between the markers must contain at least one non-whitespace
 *   character (an empty `/q q/` is ignored) — but scanning continues after the
 *   closer so a later well-formed span is still found.
 * - The opener `/q` ends with `q` and the closer `q/` starts with `q`; the same
 *   character index may never serve as both, so the closer search always begins
 *   at `openerIndex + 2`. Hence `/q/` (three chars) yields no span and `/qq/`
 *   (opener `/q`, closer `q/` from index 2, empty question) also yields none.
 * - A span must be SINGLE-LINE: the opener and its closer must be on the same
 *   line (no newline between them). This is the whole point of the marker — an
 *   inline question is one line — and it stops a `/q` typed mid-document from
 *   pairing with some unrelated `q/` many lines away (e.g. a URL like `…/faq/`,
 *   a path, or an earlier query) and swallowing everything in between. A `/q`
 *   with no closer on its own line simply does nothing; a valid `/q … q/` on a
 *   later line is still detected.
 * - A lone opener with no same-line closer, or a closer with no preceding
 *   opener, yields nothing.
 *
 * @param   text  The text to scan (may be a whole document or a slice).
 *
 * @return  The list of detected spans, in document order.
 */
export function detectInlineQuerySpans (text: string, open: string = '/q', close: string = 'q/'): InlineQuerySpan[] {
  const spans: InlineQuerySpan[] = []
  // Empty markers would match everywhere / never — treat as "feature off". The
  // detector's callers already fall back to the `/q … q/` defaults, so this is a
  // pure safety net.
  if (open.length === 0 || close.length === 0) {
    return spans
  }

  // Case-INsensitive matching (preserves the original `/q` / `/Q` behaviour) over
  // a lowercased copy; every offset maps 1:1 back onto `text`. SINGLE LINEAR PASS
  // via indexOf — O(n) — so it never freezes the renderer on large documents.
  const hay = text.toLowerCase()
  const o = open.toLowerCase()
  const c = close.toLowerCase()

  let i = 0
  while (i < text.length) {
    const oi = hay.indexOf(o, i)
    if (oi === -1) {
      break
    }
    // The closer search starts AFTER the whole opener, so the two markers can
    // never overlap on a shared character (keeps `/q/` and `/qq/` yielding none).
    const afterOpen = oi + o.length
    // Spans are SINGLE-LINE: the closer must be on the opener's own line, so a
    // marker typed mid-document can't pair with an unrelated closer many lines
    // away (e.g. a `…/faq/` URL) and swallow everything in between.
    const nl = text.indexOf('\n', afterOpen)
    const lineEnd = nl === -1 ? text.length : nl
    const ci = hay.indexOf(c, afterOpen)
    if (ci === -1 || ci >= lineEnd) {
      // No closer on this opener's line — abandon it and hunt the next opener.
      i = afterOpen
      continue
    }
    const question = text.slice(afterOpen, ci).trim()
    if (question.length > 0) {
      spans.push({ from: oi, to: ci + c.length, question })
    }
    // Resume just past the closer (non-overlapping), emitted or not.
    i = ci + c.length
  }

  return spans
}

/**
 * Builds a unique sentinel marker string used to relocate the widget's position
 * across the async gap. We write this marker into the document in place of the
 * span while awaiting the model, then find it again on resolution. Using a
 * document marker (rather than a stored offset) means the answer lands correctly
 * even if the user edits elsewhere while the request is in flight.
 *
 * @param   id  The request id.
 *
 * @return  A marker string that is extremely unlikely to occur in real prose.
 */
function makeMarker (id: number): string {
  return `⁣MINT-QQ-${id}⁣` // wrapped in invisible separators (U+2063)
}

/**
 * The inline widget shown while the AI request is pending. It is display-only:
 * the actual text region it stands in for is the sentinel marker, which is what
 * we replace on resolution.
 */
class QQLoadingWidget extends WidgetType {
  constructor (readonly id: number) {
    super()
  }

  eq (other: QQLoadingWidget): boolean {
    return other.id === this.id
  }

  toDOM (): HTMLElement {
    const elem = document.createElement('span')
    elem.classList.add('cm-qq-loading')
    // `trans` returns the localized string; fall back gracefully if the key is
    // not present in the currently loaded translation.
    // `trans` returns the msgid itself when no translation is loaded, so this is
    // always a usable string.
    elem.textContent = trans('Loading…')
    elem.setAttribute('aria-live', 'polite')
    return elem
  }

  ignoreEvent (): boolean {
    return false
  }
}

/**
 * Effect fired to register a pending request: places a replacing decoration
 * (the loading widget) over the sentinel marker range currently in the document.
 */
const addLoadingEffect = StateEffect.define<{ id: number, from: number, to: number }>()

/**
 * Effect fired to clear the loading decoration for a given request id (once the
 * answer has been dispatched, or the request failed / was cancelled).
 */
const removeLoadingEffect = StateEffect.define<{ id: number }>()

/**
 * The set of currently-pending loading widgets, keyed by request id via the
 * decoration's `spec.qqId`. The decorations are `map`ped through every
 * transaction so they track their marker as the document changes.
 */
const loadingField = StateField.define<DecorationSet>({
  create (): DecorationSet {
    return Decoration.none
  },

  update (deco, transaction): DecorationSet {
    // First, follow the document through the change.
    deco = deco.map(transaction.changes)

    for (const effect of transaction.effects) {
      if (effect.is(addLoadingEffect)) {
        const { id, from, to } = effect.value
        const widget = Decoration.replace({
          widget: new QQLoadingWidget(id),
          inclusive: false,
          // Stash the id on the decoration spec so removeLoadingEffect can find
          // and drop just this one.
          qqId: id
        } as any)
        deco = deco.update({ add: [widget.range(from, to)], sort: true })
      } else if (effect.is(removeLoadingEffect)) {
        const { id } = effect.value
        deco = deco.update({
          filter: (_f, _t, value) => (value.spec as any).qqId !== id
        })
      }
    }

    return deco
  },

  provide: field => EditorView.decorations.from(field)
})

/**
 * Returns true if the position lies within a protected syntax node (code,
 * comment, YAML frontmatter, …) in which a `/q … q/` span must be ignored.
 */
function isProtected (state: EditorState, pos: number): boolean {
  // resolveInner with side -1 so we catch the node that *ends* at `pos` too.
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, -1)
  while (node !== null) {
    if (PROTECTED_NODES.includes(node.type.name)) {
      return true
    }
    node = node.parent
  }
  return false
}

/**
 * Factory: returns the CodeMirror extension implementing inline `/q … q/`
 * questions.
 *
 * @param   askAI  Async callback that receives the question text and resolves
 *                 with a Markdown answer string. Injected so the plugin has no
 *                 direct dependency on the IPC / AIProvider layer (and can be
 *                 unit-tested with a stub). All key handling / HTTP happens in
 *                 the Electron main process behind this callback; the renderer
 *                 never sees a key.
 *
 * @return  A CodeMirror {@link Extension}.
 */
export function qqInline (
  askAI: (question: string) => Promise<string>,
  getDelimiters: () => { open: string, close: string } = () => ({ open: '/q', close: 'q/' })
): Extension {
  // Resolve the current inline-query delimiters, sanitising each: an empty or
  // multi-line marker falls back to the default, so the feature can never be
  // turned off (or made to match a newline) by a bad configured value.
  const resolveDelimiters = (): { open: string, close: string } => {
    let { open, close } = getDelimiters()
    if (typeof open !== 'string' || open.length === 0 || open.includes('\n')) { open = '/q' }
    if (typeof close !== 'string' || close.length === 0 || close.includes('\n')) { close = 'q/' }
    return { open, close }
  }

  const plugin = ViewPlugin.fromClass(class {
    private timeout: number | null = null
    private nextId = 1
    // Ids for which a request has already been dispatched, so we never fire a
    // second request for the same still-visible span while awaiting the first.
    private readonly inFlight = new Set<number>()

    update (update: ViewUpdate): void {
      if (!update.docChanged) {
        return
      }

      // Only USER input (typing/pasting) may trigger a scan. This skips the
      // plugin's own dispatches — the sentinel replacement and the answer
      // insertion — so an AI answer that itself contains a literal `/q … q/`
      // (e.g. the model explaining this very syntax) can never auto-fire a
      // follow-up request in a loop. Undo/redo are likewise excluded.
      if (!update.transactions.some(tr => tr.isUserEvent('input'))) {
        return
      }

      // Only consider firing when a change actually inserted the final character
      // of the (current) closing marker — the char that completes a span. Cheap
      // gate before the debounce; reads the configured closer each time so a
      // changed delimiter takes effect immediately.
      const closeTrigger = resolveDelimiters().close.slice(-1)
      let mightHaveClosed = false
      update.changes.iterChanges((_fA, _tA, _fB, _tB, inserted) => {
        if (inserted.length > 0 && inserted.toString().includes(closeTrigger)) {
          mightHaveClosed = true
        }
      })

      if (!mightHaveClosed) {
        return
      }

      this.schedule(update.view)
    }

    private schedule (view: EditorView): void {
      if (this.timeout !== null) {
        window.clearTimeout(this.timeout)
      }

      this.timeout = window.setTimeout(() => {
        this.timeout = null
        this.maybeFire(view)
      }, QQ_TRIGGER_DELAY)
    }

    /**
     * Scans the current document for a completed, unprotected `/q … q/` span and,
     * if one is found, fires exactly one AI request for it.
     */
    private maybeFire (view: EditorView): void {
      const state = view.state
      const doc = state.sliceDoc()
      const { open, close } = resolveDelimiters()
      const spans = detectInlineQuerySpans(doc, open, close)

      if (spans.length === 0) {
        return
      }

      // Fire the *last* well-formed span (the one the user most likely just
      // completed). Skip protected regions and any span already covered by a
      // pending loading widget.
      for (let i = spans.length - 1; i >= 0; i--) {
        const span = spans[i]

        if (isProtected(state, span.from) || isProtected(state, span.to - 1)) {
          continue
        }

        // If a loading widget already sits inside this span's range, it is
        // already being handled; skip.
        if (this.spanHasPendingWidget(state, span.from, span.to)) {
          continue
        }

        this.fire(view, span)
        return
      }
    }

    /**
     * Checks whether the loadingField already has a widget overlapping the given
     * range (i.e. this span is already in flight).
     */
    private spanHasPendingWidget (state: EditorState, from: number, to: number): boolean {
      const deco = state.field(loadingField, false)
      if (deco === undefined) {
        return false
      }
      let found = false
      deco.between(from, to, () => { found = true; return false })
      return found
    }

    /**
     * Replaces the span with a sentinel marker + loading widget, calls askAI,
     * and on resolution relocates the marker and dispatches the answer in its
     * place.
     */
    private fire (view: EditorView, span: InlineQuerySpan): void {
      const id = this.nextId++
      const marker = makeMarker(id)

      // Step 1: replace the `/q … q/` span text with the sentinel marker. We
      // decorate over the marker with the loading widget in the same dispatch.
      view.dispatch({
        changes: { from: span.from, to: span.to, insert: marker },
        effects: addLoadingEffect.of({ id, from: span.from, to: span.from + marker.length })
      })

      this.inFlight.add(id)

      askAI(span.question)
        .then(answer => {
          this.resolve(view, id, marker, answer)
        })
        .catch(err => {
          const message = err instanceof Error ? err.message : String(err)
          // Surface the failure inline in place of the loading widget so the
          // user is never left with a silent stuck spinner.
          this.resolve(view, id, marker, `⚠️ ${message}`)
        })
        .finally(() => {
          this.inFlight.delete(id)
        })
    }

    /**
     * Locates the sentinel marker in the *current* document (position may have
     * moved if the user edited elsewhere) and replaces it with `answer`.
     */
    private resolve (view: EditorView, id: number, marker: string, answer: string): void {
      const doc = view.state.sliceDoc()
      const idx = doc.indexOf(marker)

      if (idx === -1) {
        // The marker was deleted by the user (e.g. undo, or manual deletion).
        // Nothing to replace; just clear any lingering decoration.
        view.dispatch({ effects: removeLoadingEffect.of({ id }) })
        return
      }

      const from = idx
      const to = idx + marker.length

      view.dispatch({
        changes: { from, to, insert: answer },
        effects: removeLoadingEffect.of({ id })
      })
    }

    destroy (): void {
      if (this.timeout !== null) {
        window.clearTimeout(this.timeout)
        this.timeout = null
      }
    }
  })

  return [
    loadingField,
    plugin,
    EditorView.baseTheme({
      '.cm-qq-loading': {
        display: 'inline-block',
        padding: '0 6px',
        borderRadius: '4px',
        fontStyle: 'italic',
        opacity: '0.8'
      },
      '&light .cm-qq-loading': {
        backgroundColor: '#e0f2e9',
        color: '#2f6f4f'
      },
      '&dark .cm-qq-loading': {
        backgroundColor: '#204034',
        color: '#9fe3c2'
      }
    })
  ]
}
