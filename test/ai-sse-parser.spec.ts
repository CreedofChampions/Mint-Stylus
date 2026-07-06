/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        parseSSEStream / parseSSELine tester (Mint Stylus AI)
 * CVM-Role:        TESTING
 * Maintainer:      Mint Stylus
 * License:         GNU GPL v3
 *
 * Description:     Tests the OpenAI-compatible SSE stream parser used by the
 *                  main-process AIProvider client. Verifies that keep-alive
 *                  comment lines (e.g. ": OPENROUTER PROCESSING") are ignored,
 *                  that the terminal "data: [DONE]" sentinel stops parsing, and
 *                  that the per-chunk choices[0].delta.content fragments are
 *                  concatenated into the full assistant message. Also exercises
 *                  the Ollama-native NDJSON path.
 *
 *                  <!-- AI-created for Mint Stylus -->
 *
 * END HEADER
 */

import { parseSSELine, parseSSEStream } from 'source/app/service-providers/ai/openai-client'
import { strictEqual } from 'assert'

/**
 * Wraps a full SSE/NDJSON text payload in the minimal ReadableStream<Uint8Array>
 * shape that the real (async) parseSSEStream consumes, so we can drive the whole
 * line-buffering pipeline the way fetch's response.body would. `chunkSize` lets
 * us split the payload across reads to exercise mid-line buffering.
 */
function streamOf (text: string, chunkSize = Infinity): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text)
  let offset = 0
  return new ReadableStream<Uint8Array>({
    pull (controller) {
      if (offset >= bytes.length) {
        controller.close()
        return
      }
      const end = chunkSize === Infinity ? bytes.length : Math.min(offset + chunkSize, bytes.length)
      controller.enqueue(bytes.slice(offset, end))
      offset = end
    }
  })
}

/** Drains parseSSEStream into the fully-assembled assistant text. */
async function collect (text: string, ndjson = false, chunkSize = Infinity): Promise<string> {
  return await parseSSEStream(streamOf(text, chunkSize), ndjson)
}

// A realistic OpenRouter SSE payload: a keep-alive comment line, several data
// chunks each carrying a delta.content fragment, a final chunk that carries
// usage but no content, and the terminal [DONE] sentinel.
const sampleStream = [
  ': OPENROUTER PROCESSING',
  '',
  'data: {"id":"gen-1","choices":[{"delta":{"role":"assistant","content":"Hello"}}]}',
  '',
  ': OPENROUTER PROCESSING',
  '',
  'data: {"id":"gen-1","choices":[{"delta":{"content":", "}}]}',
  '',
  'data: {"id":"gen-1","choices":[{"delta":{"content":"world"}}]}',
  '',
  'data: {"id":"gen-1","choices":[{"delta":{"content":"!"}}]}',
  '',
  'data: {"id":"gen-1","choices":[{"delta":{}}],"usage":{"prompt_tokens":5,"completion_tokens":3,"total_tokens":8}}',
  '',
  'data: [DONE]',
  ''
].join('\n')

describe('AIProvider#parseSSELine()', function () {
  it('should extract choices[0].delta.content from a data line', function () {
    const result = parseSSELine('data: {"choices":[{"delta":{"content":"hi"}}]}')
    strictEqual(result.delta, 'hi')
    strictEqual(result.done, false)
  })

  it('should ignore ": OPENROUTER PROCESSING" keep-alive comment lines (no throw)', function () {
    const result = parseSSELine(': OPENROUTER PROCESSING')
    strictEqual(result.delta, '')
    strictEqual(result.done, false)
  })

  it('should flag done on "data: [DONE]"', function () {
    const result = parseSSELine('data: [DONE]')
    strictEqual(result.delta, '')
    strictEqual(result.done, true)
  })

  it('should treat a blank line as empty and not done', function () {
    const result = parseSSELine('')
    strictEqual(result.delta, '')
    strictEqual(result.done, false)
  })

  it('should treat a chunk with no delta.content as contributing nothing', function () {
    const result = parseSSELine('data: {"choices":[{"delta":{"role":"assistant"}}]}')
    strictEqual(result.delta, '')
    strictEqual(result.done, false)
  })

  it('should ignore a data line that carries only usage (no content)', function () {
    const result = parseSSELine('data: {"choices":[{"delta":{}}],"usage":{"total_tokens":8}}')
    strictEqual(result.delta, '')
    strictEqual(result.done, false)
  })

  it('should throw on a mid-stream SSE error event', function () {
    let threw = false
    try {
      parseSSELine('data: {"error":{"message":"rate limited"}}')
    } catch (err: any) {
      threw = true
      strictEqual(err.message, 'rate limited')
    }
    strictEqual(threw, true)
  })

  it('should extract message.content in NDJSON (Ollama-native) mode', function () {
    const result = parseSSELine('{"message":{"content":"chunk"},"done":false}', true)
    strictEqual(result.delta, 'chunk')
    strictEqual(result.done, false)
  })

  it('should flag done on an NDJSON object with done:true', function () {
    const result = parseSSELine('{"message":{"content":""},"done":true}', true)
    strictEqual(result.done, true)
  })
})

describe('AIProvider#parseSSEStream()', function () {
  it('should concatenate the delta.content fragments into the full message', async function () {
    strictEqual(await collect(sampleStream), 'Hello, world!')
  })

  it('should assemble correctly even when reads split lines mid-token', async function () {
    // Feed the payload 3 bytes at a time to exercise the line buffer.
    strictEqual(await collect(sampleStream, false, 3), 'Hello, world!')
  })

  it('should ignore ": OPENROUTER PROCESSING" keep-alive comment lines', async function () {
    // A stream that is *only* comments + [DONE] must yield the empty string
    // and must NOT throw (a naive JSON.parse of the comment line would).
    const onlyComments = [
      ': OPENROUTER PROCESSING',
      '',
      ': OPENROUTER PROCESSING',
      '',
      'data: [DONE]',
      ''
    ].join('\n')
    strictEqual(await collect(onlyComments), '')
  })

  it('should stop at "data: [DONE]" and ignore anything after it', async function () {
    const withTrailing = [
      'data: {"choices":[{"delta":{"content":"kept"}}]}',
      '',
      'data: [DONE]',
      '',
      'data: {"choices":[{"delta":{"content":"dropped"}}]}',
      ''
    ].join('\n')
    strictEqual(await collect(withTrailing), 'kept')
  })

  it('should handle an empty / whitespace-only stream without throwing', async function () {
    strictEqual(await collect(''), '')
    strictEqual(await collect('\n\n'), '')
  })

  it('should assemble an Ollama-native NDJSON stream', async function () {
    const ndjson = [
      '{"message":{"content":"foo"},"done":false}',
      '{"message":{"content":" bar"},"done":false}',
      '{"message":{"content":""},"done":true}',
      ''
    ].join('\n')
    strictEqual(await collect(ndjson, true), 'foo bar')
  })
})
