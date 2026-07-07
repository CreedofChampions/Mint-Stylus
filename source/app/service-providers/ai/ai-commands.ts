/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        AI Command definitions, defaults & helpers
 * CVM-Role:        Utility (pure, no I/O)
 * Maintainer:      Mint Stylus
 * License:         GNU GPL v3
 *
 * Description:     The single source of truth for the user-editable AI commands.
 *                  Every AI command (the built-in five and any the user adds) is
 *                  an {@link AICommandConfig}: a stable id, a display name, an
 *                  EDITABLE system prompt, and a `flow` describing how its output
 *                  is presented (a clickable "summarize" option list, or a
 *                  streamed markdown answer). These live in the config under
 *                  `ai.commands`, so the user can rename them, rewrite their
 *                  prompts, change their flow, add new ones, delete custom ones,
 *                  and reset the built-ins to these defaults.
 *
 *                  This module is intentionally pure: it holds only data and
 *                  pure functions (no I/O, no network, no key access) so it can
 *                  be imported by BOTH the main-process config template and the
 *                  renderer (the AI store / panel / preferences) alike.
 *
 *                  ==== AI-created for Mint Stylus ====
 *
 * END HEADER
 */

import {
  SHORTEN_SYSTEM,
  SUMMARIZE_SYSTEM,
  SYNONYMS_SYSTEM,
  ALTERNATIVES_SYSTEM,
  CHALLENGE_IDEA_SYSTEM
} from './prompts'

/**
 * How a command's output is presented to the user:
 *
 *  - `summarize` The model is asked for a list of interchangeable results; each
 *                is rendered as a clickable option that REPLACES the current
 *                selection (the Summarize-style flow). New commands default to
 *                this so "add a command" instantly produces usable rewrites.
 *  - `stream`    The model's answer is streamed verbatim into the panel as
 *                rendered markdown (good for long, structured output such as
 *                Challenge Idea).
 */
export type AICommandFlow = 'summarize' | 'stream'

/**
 * A single user-editable AI command. Persisted (as an array) under the
 * `ai.commands` config key.
 */
export interface AICommandConfig {
  /**
   * Stable, unique identifier. The five built-ins keep their historical
   * upper-case ids (`SHORTEN`, `SUMMARIZE`, `SYNONYMS`, `ALTERNATIVES`,
   * `CHALLENGE_IDEA`) so menu items and shortcuts keep resolving; commands the
   * user adds get generated ids like `custom-1`.
   */
  id: string
  /** The display name shown in the command chooser and menus. Editable. */
  name: string
  /**
   * The command's system prompt — the instruction the model follows. This is
   * the primary thing the user edits.
   */
  prompt: string
  /** How this command's output is presented. */
  flow: AICommandFlow
  /**
   * True for the five commands shipped with Mint Stylus. Built-ins can be edited
   * and reset to their defaults; the flag lets the UI offer "Reset" and prevents
   * their ids from being reused by generated custom ids.
   */
  builtin: boolean
}

/**
 * The five default commands shipped with Mint Stylus, in menu order. The prompt
 * text lives in `prompts.ts` (imported above) so there is exactly one home for
 * it; this array pairs each prompt with its default name, id, and flow.
 */
const BUILTIN_COMMANDS: readonly AICommandConfig[] = [
  { id: 'SHORTEN', name: 'Shorten Text', prompt: SHORTEN_SYSTEM, flow: 'stream', builtin: true },
  { id: 'SUMMARIZE', name: 'Summarize', prompt: SUMMARIZE_SYSTEM, flow: 'summarize', builtin: true },
  { id: 'SYNONYMS', name: 'Synonyms', prompt: SYNONYMS_SYSTEM, flow: 'summarize', builtin: true },
  { id: 'ALTERNATIVES', name: 'Alternatives', prompt: ALTERNATIVES_SYSTEM, flow: 'stream', builtin: true },
  { id: 'CHALLENGE_IDEA', name: 'Challenge Idea', prompt: CHALLENGE_IDEA_SYSTEM, flow: 'stream', builtin: true }
]

/**
 * The set of valid flow values, for validation.
 */
const VALID_FLOWS: readonly AICommandFlow[] = [ 'summarize', 'stream' ]

/**
 * The prompt a freshly-added command starts with. New commands default to the
 * SUMMARIZE flow, so this template asks for a clean, parseable option list the
 * user can click to replace their selection. The user then edits the middle
 * line to say what the command should actually do.
 */
export const NEW_COMMAND_PROMPT_TEMPLATE = [
  'You are a writing assistant inside a Markdown editor. Apply the following',
  'instruction to the user\'s selected text:',
  '',
  '  >> Describe here what this command should do to the selection <<',
  '',
  'Respond with exactly 7 distinct alternative results, one per line, each',
  'prefixed with "- ". Every result must work as a direct drop-in replacement',
  'for the selection. Do not add commentary, headings, numbering, or quotes.'
].join('\n')

/**
 * Returns a fresh, deeply-cloned copy of the five default commands. Used as the
 * config-template default for `ai.commands` and as the source for "reset".
 *
 * @return  {AICommandConfig[]}  A new array of new command objects.
 */
export function defaultAICommands (): AICommandConfig[] {
  return BUILTIN_COMMANDS.map(command => ({ ...command }))
}

/**
 * Looks up a built-in command's default definition by id.
 *
 * @param   {string}                     id  The command id.
 *
 * @return  {AICommandConfig|undefined}      The default, or undefined if `id`
 *                                           is not a built-in.
 */
export function defaultCommandById (id: string): AICommandConfig|undefined {
  const found = BUILTIN_COMMANDS.find(command => command.id === id)
  return found !== undefined ? { ...found } : undefined
}

/**
 * Type-guard / validator for a single stored command entry.
 *
 * @param   {unknown}  value  A candidate entry from the config array.
 *
 * @return  {boolean}         Whether it is a well-formed AICommandConfig.
 */
export function isValidCommand (value: unknown): value is AICommandConfig {
  if (value === null || typeof value !== 'object') {
    return false
  }
  const c = value as Record<string, unknown>
  return typeof c.id === 'string' && c.id.length > 0 &&
    typeof c.name === 'string' &&
    typeof c.prompt === 'string' &&
    typeof c.flow === 'string' && VALID_FLOWS.includes(c.flow as AICommandFlow) &&
    typeof c.builtin === 'boolean'
}

/**
 * Cleans and normalises whatever is stored under `ai.commands` into a usable
 * command list. Never throws:
 *
 *  - a non-array (missing / corrupt config) yields the built-in defaults;
 *  - each entry is validated; malformed entries are coerced where possible
 *    (flow → 'stream', builtin → false) or dropped if unusable (no id/name/prompt);
 *  - duplicate ids are de-duplicated (first wins);
 *  - an empty result falls back to the built-in defaults so the UI is never blank.
 *
 * @param   {unknown}            stored  The raw config value.
 *
 * @return  {AICommandConfig[]}          A clean, non-empty command list.
 */
export function reconcileCommands (stored: unknown): AICommandConfig[] {
  if (!Array.isArray(stored)) {
    return defaultAICommands()
  }

  const seen = new Set<string>()
  const cleaned: AICommandConfig[] = []

  for (const entry of stored) {
    if (entry === null || typeof entry !== 'object') {
      continue
    }
    const c = entry as Record<string, unknown>
    const id = typeof c.id === 'string' ? c.id.trim() : ''
    const name = typeof c.name === 'string' ? c.name : ''
    const prompt = typeof c.prompt === 'string' ? c.prompt : ''
    if (id === '' || name.trim() === '' || prompt.trim() === '' || seen.has(id)) {
      continue
    }
    const flow: AICommandFlow = (typeof c.flow === 'string' && VALID_FLOWS.includes(c.flow as AICommandFlow))
      ? c.flow as AICommandFlow
      : 'stream'
    const builtin = typeof c.builtin === 'boolean' ? c.builtin : false
    seen.add(id)
    cleaned.push({ id, name, prompt, flow, builtin })
  }

  return cleaned.length > 0 ? cleaned : defaultAICommands()
}

/**
 * Builds a brand-new custom command with a unique id not colliding with any in
 * `existing`. New commands default to the SUMMARIZE flow and the editable
 * template prompt.
 *
 * @param   {AICommandConfig[]}  existing  The current command list.
 *
 * @return  {AICommandConfig}              A new command ready to append + edit.
 */
export function makeNewCommand (existing: AICommandConfig[]): AICommandConfig {
  const usedIds = new Set(existing.map(command => command.id))
  let n = existing.length + 1
  let id = `custom-${n}`
  while (usedIds.has(id)) {
    n += 1
    id = `custom-${n}`
  }
  return {
    id,
    name: 'New command',
    prompt: NEW_COMMAND_PROMPT_TEMPLATE,
    flow: 'summarize',
    builtin: false
  }
}
