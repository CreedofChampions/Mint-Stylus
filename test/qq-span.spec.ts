/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        detectInlineQuerySpans tester (Mint Stylus AI)
 * CVM-Role:        TESTING
 * Maintainer:      Mint Stylus
 * License:         GNU GPL v3
 *
 * Description:     Tests the pure /q…q/ span detector used by the inline
 *                  "/q <question> q/" CodeMirror plugin. Given raw document
 *                  text, detectInlineQuerySpans returns one {from, to, question}
 *                  record per complete /q...q/ span, where `from`/`to` are the
 *                  absolute character offsets bounding the whole span (opening
 *                  `/q` through closing `q/`, both markers included) and
 *                  `question` is the trimmed inner text. A lone unmatched opener
 *                  or closer yields nothing.
 *
 *                  <!-- AI-created for Mint Stylus -->
 *
 * END HEADER
 */

import { detectInlineQuerySpans, type InlineQuerySpan } from 'source/common/modules/markdown-editor/plugins/qq-inline'
import { deepStrictEqual, strictEqual } from 'assert'

const tests: Array<{ desc: string, input: string, expected: InlineQuerySpan[] }> = [
  {
    desc: 'no /q…q/ span at all',
    input: 'Just some ordinary text with no markers.',
    expected: []
  },
  {
    desc: 'a lone opener /q with no closer is ignored',
    input: 'A dangling /q marker with no closing pair.',
    expected: []
  },
  {
    desc: 'a lone closer q/ with no opener is ignored',
    input: 'A dangling q/ marker with no opening pair.',
    expected: []
  },
  {
    desc: 'a single /q … q/ span mid-sentence',
    // Offsets: "Ask /q what is photosynthesis q/ now."
    //           0123456789...
    // "Ask " = 4 chars, opener `/q` starts at index 4, span ends just after the
    // closing `q/` at index 32.
    input: 'Ask /q what is photosynthesis q/ now.',
    expected: [
      { from: 4, to: 32, question: 'what is photosynthesis' }
    ]
  },
  {
    desc: 'two /q … q/ spans',
    // "/q a q/ /q b q/"
    //  0123456 78...  — first span [0,7), second span [8,15)
    input: '/q a q/ /q b q/',
    expected: [
      { from: 0, to: 7, question: 'a' },
      { from: 8, to: 15, question: 'b' }
    ]
  },
  {
    desc: 'an empty /q q/ span is ignored',
    input: 'An empty /q q/ query is ignored.',
    expected: []
  },
  {
    desc: '/q/ (three chars) yields no span',
    input: 'Edge /q/ case yields nothing.',
    expected: []
  },
  {
    desc: 'case-insensitive /Q … Q/ still matches',
    // "Ask /Q upper q/ now." — opener `/Q` at index 4, closer `q/` at index 13.
    input: 'Ask /Q upper q/ now.',
    expected: [
      { from: 4, to: 15, question: 'upper' }
    ]
  },
  {
    // SINGLE-LINE rule: an opener and a closer on different lines never pair, so
    // a `/q` typed mid-document cannot reach across lines to an unrelated `q/`.
    desc: 'opener and closer on DIFFERENT lines do not pair',
    input: 'Ask /q what is this\nand a stray q/ here',
    expected: []
  },
  {
    // The exact reported bug: a `/q` mid-document must not grab everything down
    // to a distant `q/` (here the "q/" inside "faq/" a couple lines below).
    desc: 'a /q never reaches across lines to a distant q/ (reported bug)',
    input: 'Note /q remind me\nline two\nsee the faq/ ref',
    expected: []
  }
]

describe('QQInline#detectInlineQuerySpans()', function () {
  for (const test of tests) {
    it(`should detect the right spans for: ${test.desc}`, function () {
      deepStrictEqual(detectInlineQuerySpans(test.input), test.expected)
    })
  }

  it('should return exact from/to slices that map back to the full span', function () {
    const input = 'Ask /q what is photosynthesis q/ now.'
    const spans = detectInlineQuerySpans(input)
    strictEqual(spans.length, 1)
    const { from, to, question } = spans[0]
    // The [from, to) slice must be the entire /q…q/ span, markers included.
    strictEqual(input.slice(from, to), '/q what is photosynthesis q/')
    // And the inner question must be the trimmed content between the markers.
    strictEqual(question, 'what is photosynthesis')
  })

  it('should not treat a trailing lone opener after a complete span as a new span', function () {
    const input = '/q answer me q/ then a stray /q'
    const spans = detectInlineQuerySpans(input)
    strictEqual(spans.length, 1)
    strictEqual(spans[0].question, 'answer me')
  })

  it('should keep correct offsets for two spans with surrounding text', function () {
    const input = 'text /q first q/ mid /q second q/ end'
    const spans = detectInlineQuerySpans(input)
    deepStrictEqual(spans, [
      { from: 5, to: 16, question: 'first' },
      { from: 21, to: 33, question: 'second' }
    ])
  })

  it('should skip a mid-doc /q with no same-line closer but still find a valid span on a later line', function () {
    const input = 'Draft /q todo later\n\nNow ask /q what is 2 plus 2? q/ ok'
    const spans = detectInlineQuerySpans(input)
    strictEqual(spans.length, 1)
    strictEqual(spans[0].question, 'what is 2 plus 2?')
    strictEqual(input.slice(spans[0].from, spans[0].to), '/q what is 2 plus 2? q/')
  })

  // --- Custom, user-configured delimiters (Mint Stylus: Preferences → AI) -----

  it('should detect a span with fully custom multi-char markers', function () {
    const input = 'Ask [[ai what is the capital of France? ]] please'
    const spans = detectInlineQuerySpans(input, '[[ai', ']]')
    strictEqual(spans.length, 1)
    strictEqual(spans[0].question, 'what is the capital of France?')
    strictEqual(input.slice(spans[0].from, spans[0].to), '[[ai what is the capital of France? ]]')
  })

  it('should NOT detect the default /q markers when custom markers are configured', function () {
    const input = 'Ask /q ignored q/ here'
    strictEqual(detectInlineQuerySpans(input, '[[ai', ']]').length, 0)
  })

  it('should keep the single-line rule with custom markers', function () {
    const input = '[[ai spans one\nline only ]] nope'
    strictEqual(detectInlineQuerySpans(input, '[[ai', ']]').length, 0)
  })

  it('should find two custom-marker spans and ignore an empty one', function () {
    const input = '@@a first @@ text @@ @@ then @@a second @@'
    const spans = detectInlineQuerySpans(input, '@@a', '@@')
    strictEqual(spans.length, 2)
    strictEqual(spans[0].question, 'first')
    strictEqual(spans[1].question, 'second')
  })

  it('should return no spans when a marker is empty (feature-off safety net)', function () {
    strictEqual(detectInlineQuerySpans('anything /q x q/', '', 'q/').length, 0)
    strictEqual(detectInlineQuerySpans('anything /q x q/', '/q', '').length, 0)
  })
})
