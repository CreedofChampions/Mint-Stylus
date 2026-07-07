/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        Folder-group context builder
 * CVM-Role:        Utility
 * Maintainer:      Mint Stylus
 * License:         GNU GPL v3
 *
 * Description:     Turns a local folder ("folder group") into a RAG context
 *                  block for an AI query. It walks the folder for Markdown/text
 *                  files, ranks them by keyword overlap with the query, and
 *                  assembles a bounded, labelled snippet block that the
 *                  AIProvider injects as a system message. Pure filesystem work,
 *                  no network, no keys. Never throws.
 *
 *                  ==== AI-created for Mint Stylus ====
 *
 * END HEADER
 */

import { promises as fs } from 'fs'
import path from 'path'

export interface FolderContextResult {
  /** Ready-to-inject RAG block (empty when nothing usable was found). */
  block: string
  /** Short human status for the Preferences "Test" button. */
  info: string
}

interface FolderContextOptions {
  /** Overall character budget for the assembled block. Default 6000. */
  maxChars?: number
  /** Max files to actually include as snippets. Default 6. */
  maxFiles?: number
  /** Max files to scan before ranking (protects huge trees). Default 400. */
  scanLimit?: number
}

/** File extensions treated as readable text/markdown. */
const TEXT_EXTENSIONS = new Set([ '.md', '.markdown', '.txt', '.mdx', '.text', '.org' ])

/** Directory names never descended into. */
const IGNORED_DIRS = new Set([ '.git', 'node_modules', '.obsidian', '.trash', '.zettlr' ])

/** Per-file snippet budget (characters). */
const PER_FILE_CHARS = 1400

/**
 * Recursively collect readable text files under `dir`, bounded by `limit`.
 *
 * @param   {string}    dir    The directory to walk.
 * @param   {number}    limit  Maximum number of files to collect.
 *
 * @return  {Promise<string[]>}  Absolute file paths (at most `limit`).
 */
async function collectTextFiles (dir: string, limit: number): Promise<string[]> {
  const found: string[] = []
  const stack: string[] = [ dir ]

  while (stack.length > 0 && found.length < limit) {
    const current = stack.pop() as string
    let entries: any[]
    try {
      entries = await fs.readdir(current, { withFileTypes: true })
    } catch {
      continue // Unreadable directory: skip.
    }

    for (const entry of entries) {
      if (found.length >= limit) {
        break
      }
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          stack.push(full)
        }
      } else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        found.push(full)
      }
    }
  }

  return found
}

/**
 * Extract the query's significant lowercase tokens (length >= 3).
 */
function tokenize (query: string): string[] {
  return Array.from(new Set(
    query.toLowerCase().split(/[^a-z0-9]+/i).filter(word => word.length >= 3)
  ))
}

/**
 * Pick the most relevant ~PER_FILE_CHARS window of `content` for `tokens`. If a
 * token is found, centre a window on its first occurrence; otherwise return the
 * head of the file. Also returns the number of token hits (for ranking).
 */
function bestSnippet (content: string, tokens: string[]): { snippet: string, hits: number } {
  const lower = content.toLowerCase()
  let hits = 0
  let firstIdx = -1
  for (const token of tokens) {
    let from = 0
    while (true) {
      const idx = lower.indexOf(token, from)
      if (idx === -1) {
        break
      }
      hits++
      if (firstIdx === -1 || idx < firstIdx) {
        firstIdx = idx
      }
      from = idx + token.length
    }
  }

  let start = 0
  if (firstIdx > 0) {
    start = Math.max(0, firstIdx - Math.floor(PER_FILE_CHARS / 3))
  }
  let snippet = content.slice(start, start + PER_FILE_CHARS).trim()
  if (start > 0) {
    snippet = '…' + snippet
  }
  if (start + PER_FILE_CHARS < content.length) {
    snippet = snippet + '…'
  }
  return { snippet, hits }
}

/**
 * Build a RAG context block from a local folder group for a query.
 *
 * @param   {string}                 folderPath  Absolute path to the folder.
 * @param   {string}                 query       The user's latest query.
 * @param   {FolderContextOptions}   opts        Budgets.
 *
 * @return  {Promise<FolderContextResult>}       The block + a status string.
 */
export async function buildFolderContext (
  folderPath: string,
  query: string,
  opts: FolderContextOptions = {}
): Promise<FolderContextResult> {
  const maxChars = opts.maxChars ?? 6000
  const maxFiles = opts.maxFiles ?? 6
  const scanLimit = opts.scanLimit ?? 400

  const trimmed = folderPath.trim()
  if (trimmed === '') {
    return { block: '', info: 'No folder selected.' }
  }

  try {
    const stat = await fs.stat(trimmed)
    if (!stat.isDirectory()) {
      return { block: '', info: 'Context folder is not a directory.' }
    }
  } catch {
    return { block: '', info: 'Context folder not found.' }
  }

  const files = await collectTextFiles(trimmed, scanLimit)
  if (files.length === 0) {
    return { block: '', info: 'Folder has no Markdown/text files.' }
  }

  const tokens = tokenize(query)

  // Score every file by keyword overlap; keep its best snippet.
  const scored: Array<{ rel: string, snippet: string, hits: number }> = []
  for (const file of files) {
    let content: string
    try {
      content = await fs.readFile(file, 'utf8')
    } catch {
      continue
    }
    if (content.trim() === '') {
      continue
    }
    const { snippet, hits } = bestSnippet(content, tokens)
    scored.push({ rel: path.relative(trimmed, file), snippet, hits })
  }

  if (scored.length === 0) {
    return { block: '', info: 'Folder files could not be read.' }
  }

  // Rank: token hits desc, then shorter path first (proxy for top-level notes).
  scored.sort((a, b) => (b.hits - a.hits) || (a.rel.length - b.rel.length))

  // If the query matched nothing, still include a few files as general context.
  const chosen = scored.slice(0, maxFiles)

  const header = `Additional context retrieved from your folder group (${path.basename(trimmed)}) for this query. Use it when relevant and cite file names:`
  const parts: string[] = [ header ]
  let used = 0
  let budget = maxChars - header.length
  for (const item of chosen) {
    const piece = `\n\n### ${item.rel}\n${item.snippet}`
    if (piece.length > budget && used > 0) {
      break
    }
    parts.push(piece.length > budget ? piece.slice(0, Math.max(0, budget)) + '…' : piece)
    budget -= piece.length
    used++
    if (budget <= 0) {
      break
    }
  }

  const matched = scored.filter(s => s.hits > 0).length
  return {
    block: parts.join(''),
    info: `Folder: ${files.length} file(s) scanned, ${matched} matched, ${used} included.`
  }
}
