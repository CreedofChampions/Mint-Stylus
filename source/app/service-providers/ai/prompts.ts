/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        AI Prompt Templates & Message Builder
 * CVM-Role:        Utility (pure, no I/O)
 * Maintainer:      Mint Stylus
 * License:         GNU GPL v3
 *
 * Description:     Prompt templates and the chat-message builder for every
 *                  default AI command. This module is intentionally pure: it
 *                  contains only strings and pure functions and performs no
 *                  I/O, no network access, and touches no API keys. It is
 *                  consumed by the main-process AIProvider, which is the only
 *                  place that ever holds a key or makes an HTTP call.
 *
 *                  ==== AI-created for Mint Stylus ====
 *                  This file was authored by AI as part of the Mint Stylus
 *                  fork of Zettlr. It has no upstream Zettlr counterpart.
 *
 * END HEADER
 */

/**
 * A single message in an OpenAI-compatible chat-completions request. Kept local
 * and minimal on purpose: at time of writing no shared chat-message type exists
 * anywhere under `source/types` (`@dts`) or `source/common` (`@common`). If one
 * is ever introduced, prefer importing it here and re-exporting for callers.
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * A global instruction appended to (almost) every system prompt: the model must
 * always answer in Markdown. Kept as a constant so the wording stays consistent
 * across commands.
 */
export const MARKDOWN_INSTRUCTION = 'Always format your entire answer as clean, valid Markdown.'

/**
 * The input a command's `build` function receives. All fields are optional so a
 * single shape can serve every command; each command reads only what it needs:
 *
 * - `selection`   The text the user highlighted (Shorten/Summarize/Alternatives).
 * - `word`        A single word (Synonyms).
 * - `pageContext` The whole document, used by Challenge Idea.
 */
export interface CommandInput {
  selection?: string
  word?: string
  pageContext?: string
}

/**
 * A default AI command preset. `systemPrompt` is a stable instruction describing
 * the command's behaviour; `build` turns a concrete `CommandInput` into the
 * full ordered list of chat messages for that single command (system prompt +
 * user content). The AIProvider prepends the user's style file and any global
 * system message on top of these via {@link buildMessages}.
 */
export interface AICommand {
  /** Stable identifier / display name of the command. */
  name: string
  /** The command-specific system instruction. */
  systemPrompt: string
  /** Build the (systemPrompt + user) message list for one invocation. */
  build: (input: CommandInput) => ChatMessage[]
}

/**
 * Options for {@link buildMessages}.
 *
 * - `style`       Contents of the user's "Write in My Style" file. Prepended as
 *                 the very first system message so it colours every response.
 * - `system`      An optional command system prompt (usually `command.systemPrompt`).
 * - `user`        The user-facing content for this turn.
 * - `pageContext` Optional whole-page context, injected as a system message so
 *                 the model can reason over the full document (Challenge Idea).
 */
export interface BuildMessagesOptions {
  style?: string
  system?: string
  user: string
  pageContext?: string
}

/**
 * Assemble the final, ordered message list sent to the model.
 *
 * Order:
 *   1. The style file (as a system message) — if non-empty.
 *   2. The page context (as a system message) — if provided.
 *   3. The command's system prompt — if provided.
 *   4. The user content.
 *
 * Empty / whitespace-only optional parts are skipped so we never send blank
 * system messages.
 *
 * @param   opts  The pieces to assemble.
 * @returns       The ordered ChatMessage[] ready to hand to the provider.
 */
export function buildMessages (opts: BuildMessagesOptions): ChatMessage[] {
  const messages: ChatMessage[] = []

  const style = opts.style?.trim()
  if (style !== undefined && style.length > 0) {
    messages.push({
      role: 'system',
      content: `The user has provided the following personal writing-style guide. Match this voice, tone, and formatting conventions in every response:\n\n${style}`
    })
  }

  const pageContext = opts.pageContext?.trim()
  if (pageContext !== undefined && pageContext.length > 0) {
    messages.push({
      role: 'system',
      content: `The following is the full document the user is currently working on. Use it as context for your answer:\n\n---\n${pageContext}\n---`
    })
  }

  const system = opts.system?.trim()
  if (system !== undefined && system.length > 0) {
    messages.push({ role: 'system', content: system })
  }

  messages.push({ role: 'user', content: opts.user })

  return messages
}

// ---------------------------------------------------------------------------
// Default command system prompts
// ---------------------------------------------------------------------------

const SHORTEN_SYSTEM = [
  'You are an expert editor who shortens prose while preserving its full meaning.',
  '',
  'Follow this exact procedure and show each stage as a Markdown section:',
  '1. "Synopsis": distil the passage into one bullet point per distinct concept it contains.',
  '2. "Shortened": rewrite the passage as concisely as you can WITHOUT losing any meaning. When forced to choose, always preserve meaning over brevity.',
  '3. "Alternatives": provide exactly 30 alternative versions of the shortened text as a single numbered list (1. through 30.), each a complete standalone rewrite.',
  '',
  'Constraints:',
  '- Write at a college-senior reading level.',
  '- Do NOT use bold text anywhere.',
  '- Do NOT wrap any output in extra quotation marks.',
  MARKDOWN_INSTRUCTION
].join('\n')

const SUMMARIZE_SYSTEM = [
  'You rewrite the user\'s selected text into shorter, clearer alternatives.',
  '',
  'Produce EXACTLY 7 alternative rewrites of the provided text, and nothing else.',
  'Present them as a Markdown bullet list of exactly 7 items (one rewrite per bullet).',
  'Each rewrite must preserve the original meaning. Do not add commentary, headings, or numbering.',
  MARKDOWN_INSTRUCTION
].join('\n')

const SYNONYMS_SYSTEM = [
  'You are a thesaurus assistant.',
  '',
  'Given a single word, produce 15 variations (synonyms or near-synonyms) of that word.',
  'Present them as a Markdown numbered list (1. through 15.), one variation per line, with no definitions or commentary.',
  MARKDOWN_INSTRUCTION
].join('\n')

const ALTERNATIVES_SYSTEM = [
  'You are an expert editor who produces alternative phrasings of a passage.',
  '',
  'Follow this exact procedure and show each stage as a Markdown section:',
  '1. "Synopsis": distil the passage into one bullet point per distinct concept it contains.',
  '2. "Shortened": rewrite the passage as concisely as you can WITHOUT losing any meaning. When forced to choose, always preserve meaning over brevity.',
  '3. "Segments": break the shortened text into consecutive clumps and, for each clump, offer alternative segments. Label the clumps "Part 1", "Part 2", and "Part 3", and under each label list several interchangeable alternative wordings for that segment as a bullet list.',
  '',
  'Constraints:',
  '- Write at a college-senior reading level.',
  '- Do NOT use bold text anywhere.',
  '- Do NOT wrap any output in extra quotation marks.',
  MARKDOWN_INSTRUCTION
].join('\n')

const CHALLENGE_IDEA_SYSTEM = [
  'You are a rigorous, adversarial critical-thinking partner. You are given the WHOLE document as context and must stress-test the idea it presents.',
  '',
  'The idea may contain several distinct claims. Identify each numbered point in the idea and work through EVERY one of them in turn. For each numbered point, carry out the following steps and present them as clearly labelled Markdown sections:',
  '',
  '1. Destroy the idea: expose every logical problem, hidden assumption, fallacy, and weakness you can find in this point.',
  '2. Challenge your own criticism: research the point (using web search where available) and argue against your own objections, testing whether they actually hold up.',
  '3. If, after thorough research, the point survives with no real problems, write exactly: "After thorough research, I see no problems with this idea." and move to the next point.',
  '4. If genuine problems remain: find at least 25 existing real-world solutions, approaches, or precedents that address this problem, and for each give concise pros and cons.',
  '5. Offer your own recommended solutions as a bullet list, then a final "Conclusion" covering the positives, the negatives, and any caveats.',
  '6. Reveal the internal debate you had while reasoning. Wrap that revealed debate between the exact markers "AA DEBATE: " at the start and " AA" at the end (for example: AA DEBATE: ...your candid back-and-forth... AA).',
  '',
  'Be honest and specific; do not flatter the idea. Cite URLs for any web results you rely on.',
  MARKDOWN_INSTRUCTION
].join('\n')

// ---------------------------------------------------------------------------
// Default commands
// ---------------------------------------------------------------------------

/**
 * The five default AI commands shipped with Mint Stylus. Each entry carries a
 * stable `name`, its `systemPrompt`, and a pure `build(input)` that returns the
 * (system + user) message pair for a single invocation. The AIProvider wraps
 * these with the style file / page context via {@link buildMessages}.
 */
export const COMMANDS: Record<
'SHORTEN' | 'SUMMARIZE' | 'SYNONYMS' | 'ALTERNATIVES' | 'CHALLENGE_IDEA',
AICommand
> = {
  SHORTEN: {
    name: 'Shorten Text',
    systemPrompt: SHORTEN_SYSTEM,
    build (input: CommandInput): ChatMessage[] {
      const selection = input.selection ?? ''
      return [
        { role: 'system', content: SHORTEN_SYSTEM },
        {
          role: 'user',
          content: `Shorten the following text using the full procedure (synopsis, shortened version, then 30 numbered alternatives):\n\n${selection}`
        }
      ]
    }
  },

  SUMMARIZE: {
    name: 'Summarize',
    systemPrompt: SUMMARIZE_SYSTEM,
    build (input: CommandInput): ChatMessage[] {
      const selection = input.selection ?? ''
      return [
        { role: 'system', content: SUMMARIZE_SYSTEM },
        {
          role: 'user',
          content: `Provide exactly 7 alternative rewrites of the following text as a bullet list:\n\n${selection}`
        }
      ]
    }
  },

  SYNONYMS: {
    name: 'Synonyms',
    systemPrompt: SYNONYMS_SYSTEM,
    build (input: CommandInput): ChatMessage[] {
      const word = (input.word ?? input.selection ?? '').trim()
      return [
        { role: 'system', content: SYNONYMS_SYSTEM },
        {
          role: 'user',
          content: `Give 15 variations of the following word:\n\n${word}`
        }
      ]
    }
  },

  ALTERNATIVES: {
    name: 'Alternatives',
    systemPrompt: ALTERNATIVES_SYSTEM,
    build (input: CommandInput): ChatMessage[] {
      const selection = input.selection ?? ''
      return [
        { role: 'system', content: ALTERNATIVES_SYSTEM },
        {
          role: 'user',
          content: `Shorten the following text, then break the shortened version into alternative segments labelled Part 1 / Part 2 / Part 3:\n\n${selection}`
        }
      ]
    }
  },

  CHALLENGE_IDEA: {
    name: 'Challenge Idea',
    systemPrompt: CHALLENGE_IDEA_SYSTEM,
    build (input: CommandInput): ChatMessage[] {
      const pageContext = (input.pageContext ?? input.selection ?? '').trim()
      const messages: ChatMessage[] = [
        { role: 'system', content: CHALLENGE_IDEA_SYSTEM }
      ]

      // Challenge Idea reasons over the WHOLE page. Provide it as a dedicated
      // system message so it is clearly framed as context rather than the ask.
      if (pageContext.length > 0) {
        messages.push({
          role: 'system',
          content: `The following is the full document containing the idea to challenge. Work through every numbered point it contains:\n\n---\n${pageContext}\n---`
        })
      }

      messages.push({
        role: 'user',
        content: 'Challenge the idea in the document above. Work through every numbered point using the full procedure: destroy the idea, challenge your own arguments via research, and either declare it sound or find 25+ existing solutions with pros/cons, then give your own solutions, a conclusion, and reveal the internal debate between the AA DEBATE: ... AA markers.'
      })

      return messages
    }
  }
}

// ---------------------------------------------------------------------------
// Five-word filename slug
// ---------------------------------------------------------------------------

const FIVE_WORD_SLUG_SYSTEM = [
  'You generate short filenames.',
  '',
  'Given a question, respond with a filename slug of AT MOST 5 words that summarises it.',
  'Rules:',
  '- Lowercase words separated by single hyphens (kebab-case), e.g. "how-photosynthesis-works".',
  '- No punctuation other than the separating hyphens; no quotes, no file extension.',
  '- Output ONLY the slug on a single line, with no explanation, no Markdown, and no surrounding text.'
].join('\n')

/**
 * Build the messages that ask the model for a <=5-word, kebab-case filename slug
 * summarising a question. Used when auto-saving a new conversation document.
 *
 * NOTE: This is the single deliberate exception to the "answer in Markdown"
 * rule — a slug must be a bare single-line string, so the system prompt here
 * explicitly forbids Markdown.
 *
 * @param   question  The user's question to summarise into a slug.
 * @returns           The ordered ChatMessage[] for the slug request.
 */
export function fiveWordSlugPrompt (question: string): ChatMessage[] {
  return [
    { role: 'system', content: FIVE_WORD_SLUG_SYSTEM },
    {
      role: 'user',
      content: `Summarise the following question as a slug of at most 5 words:\n\n${question.trim()}`
    }
  ]
}

/**
 * A deterministic, pure fallback/normaliser paired with fiveWordSlugPrompt.
 * Turns arbitrary text into a filename-safe, kebab-case slug of AT MOST five
 * words: lowercases, replaces every run of non-alphanumeric characters with a
 * word boundary, drops empty tokens, keeps the first five, and joins them with
 * single hyphens. Used when auto-saving a new conversation document beside the
 * most-recently-written file (and as a safety net if the model returns an unsafe
 * slug). Guarantees the result matches /^[a-z0-9]+(?:-[a-z0-9]+)*$/ or is ''.
 *
 * @param   question  The text to slugify.
 * @returns           A slug of at most five hyphen-joined words (possibly '').
 */
export function slugify (question: string): string {
  return String(question ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ') // any non-alphanumeric run becomes a boundary
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0)
    .slice(0, 5)
    .join('-')
}
