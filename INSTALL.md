# Mint Stylus — Install Guide

A free, open-source markdown editor with AI built in — a fork of **Zettlr**.
*Write faster and better without ever leaving your markdown editor.*

## Windows (fastest)
1. Download: **https://nibblet.net/downloads/mint-stylus/MintStylus-4.6.0-x64.exe** (~144 MB)
2. Run **MintStylus-4.6.0-x64.exe**.
3. SmartScreen may warn "unknown publisher" (it's self-signed) → **More info → Run anyway**.
4. Installs per-user, no admin. Coexists with Zettlr (separate app + data).

## Set up AI (Settings → AI)
- Pick a provider: **OpenRouter, WisGate, Ollama (cloud/local), Z.ai**, or **Custom** (any
  OpenAI-compatible endpoint).
- Paste its API key — **stored encrypted on your machine, never in config, never bundled or shared**.
  Optionally pick a model.
- **WisGate**: one key, many models (Claude / GPT / DeepSeek / Gemini / GLM).

## Using the AI
- **Inline:** type `/q your question q/` — the answer lands right in your document.
- **Commands:** highlight text → Command → shorten, rewrite, summarize, synonyms, or challenge your
  idea. Prompts are editable; add your own.
- **Context (top-right):** give the AI a local **Folder** of notes, an **MCP** server, or **Both**.
- **Thinking:** a global reasoning-effort dial.

## Mac / Linux (build from source)
Needs Node 20+, `corepack enable` (yarn 4), and a C++ toolchain.
`corepack yarn install` then `corepack yarn package:mac-arm` | `package:mac-x64` | `package:linux-x64`.

## Changelog
See [`CHANGELOG-MintStylus.md`](./CHANGELOG-MintStylus.md) — or
https://nibblet.net/downloads/mint-stylus/CHANGELOG.md

Based on Zettlr (GPL v3). Free forever. Source: https://github.com/CreedofChampions/Mint-Stylus
