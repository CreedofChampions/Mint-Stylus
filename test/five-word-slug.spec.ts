/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        slugify (<=5-word slug) tester (Mint Stylus AI)
 * CVM-Role:        TESTING
 * Maintainer:      Mint Stylus
 * License:         GNU GPL v3
 *
 * Description:     Tests the pure `slugify` helper that turns a question into a
 *                  filename-safe, kebab-case slug of AT MOST 5 words. This is the
 *                  deterministic fallback / normaliser paired with the
 *                  model-driven fiveWordSlugPrompt in prompts.ts: it lowercases,
 *                  strips punctuation, collapses whitespace, and keeps only the
 *                  first five words joined by single hyphens. Used when
 *                  auto-saving a new conversation document beside the last file.
 *
 *                  <!-- AI-created for Mint Stylus -->
 *
 * END HEADER
 */

import { slugify } from 'source/app/service-providers/ai/prompts'
import { strictEqual } from 'assert'

const tests: Array<{ input: string, expected: string }> = [
  // A short question stays intact, lowercased, hyphenated.
  { input: 'How does photosynthesis work', expected: 'how-does-photosynthesis-work' },
  // Trailing punctuation and a question mark are stripped.
  { input: 'What is the capital of France?', expected: 'what-is-the-capital-of' },
  // More than five words is truncated to the first five.
  { input: 'Explain the theory of relativity in simple terms please', expected: 'explain-the-theory-of-relativity' },
  // Mixed case + extra internal whitespace collapses to single hyphens.
  { input: '  Why   is  the SKY   Blue  ', expected: 'why-is-the-sky-blue' },
  // Punctuation-only / symbols are dropped, leaving clean words.
  { input: 'Cost/benefit: analysis!', expected: 'cost-benefit-analysis' },
  // An empty (or whitespace / punctuation-only) input yields an empty slug.
  { input: '', expected: '' },
  { input: '   ???   ', expected: '' }
]

describe('AIProvider#slugify()', function () {
  for (const test of tests) {
    it(`should slugify "${test.input}" to "${test.expected}"`, function () {
      strictEqual(slugify(test.input), test.expected)
    })
  }

  it('should never produce more than 5 hyphen-separated words', function () {
    const slug = slugify('one two three four five six seven eight nine ten')
    strictEqual(slug.split('-').filter(s => s.length > 0).length <= 5, true)
  })

  it('should never contain characters unsafe for a filename', function () {
    const slug = slugify('Path\\to/file: "weird" <name>?')
    // Only lowercase letters, digits and single hyphens should survive.
    strictEqual(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug === '', true)
  })
})
