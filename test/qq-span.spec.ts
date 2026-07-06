/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        detectQQSpans tester (Mint Stylus AI)
 * CVM-Role:        TESTING
 * Maintainer:      Mint Stylus
 * License:         GNU GPL v3
 *
 * Description:     Tests the pure QQ-span detector used by the inline
 *                  "QQ <question> QQ" CodeMirror plugin. Given raw document
 *                  text, detectQQSpans returns one {from, to, question} record
 *                  per complete QQ...QQ span, where `from`/`to` are the absolute
 *                  character offsets bounding the whole span (opening QQ through
 *                  closing QQ, both markers included) and `question` is the
 *                  trimmed inner text. A lone unmatched "QQ" yields nothing.
 *
 *                  <!-- AI-created for Mint Stylus -->
 *
 * END HEADER
 */

import { detectQQSpans, type QQSpan } from 'source/common/modules/markdown-editor/plugins/qq-inline'
import { deepStrictEqual, strictEqual } from 'assert'

const tests: Array<{ desc: string, input: string, expected: QQSpan[] }> = [
  {
    desc: 'no QQ span at all',
    input: 'Just some ordinary text with no markers.',
    expected: []
  },
  {
    desc: 'a lone unmatched QQ is ignored',
    input: 'A dangling QQ marker with no closing pair.',
    expected: []
  },
  {
    desc: 'a single QQ ... QQ span',
    // Offsets: "Ask QQ what is photosynthesis QQ now."
    //           0123456789...
    // "Ask " = 4 chars, span starts at index 4, ends just after the closing QQ.
    input: 'Ask QQ what is photosynthesis QQ now.',
    expected: [
      { from: 4, to: 32, question: 'what is photosynthesis' }
    ]
  },
  {
    desc: 'two QQ ... QQ spans',
    input: 'QQ first question QQ and then QQ second one QQ.',
    expected: [
      { from: 0, to: 20, question: 'first question' },
      { from: 30, to: 46, question: 'second one' }
    ]
  }
]

describe('QQInline#detectQQSpans()', function () {
  for (const test of tests) {
    it(`should detect the right spans for: ${test.desc}`, function () {
      deepStrictEqual(detectQQSpans(test.input), test.expected)
    })
  }

  it('should return exact from/to slices that map back to the full span', function () {
    const input = 'Ask QQ what is photosynthesis QQ now.'
    const spans = detectQQSpans(input)
    strictEqual(spans.length, 1)
    const { from, to, question } = spans[0]
    // The [from, to) slice must be the entire QQ...QQ span, markers included.
    strictEqual(input.slice(from, to), 'QQ what is photosynthesis QQ')
    // And the inner question must be the trimmed content between the markers.
    strictEqual(question, 'what is photosynthesis')
  })

  it('should not treat a third lone QQ after a complete span as a new span', function () {
    const input = 'QQ answer me QQ then a stray QQ'
    const spans = detectQQSpans(input)
    strictEqual(spans.length, 1)
    strictEqual(spans[0].question, 'answer me')
  })
})
