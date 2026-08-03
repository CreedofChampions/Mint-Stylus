<!-- created by AI -->
<h1 align="center">Mint Stylus</h1>

<p align="center"><strong>A desktop Markdown writing app with AI baked in.</strong></p>

<p align="center">
  <a href="https://www.gnu.org/licenses/gpl-3.0">
    <img src="https://img.shields.io/badge/License-GPLv3-blue.svg" alt="License: GNU GPL v3">
  </a>
  <a href="https://nibblet.net/downloads/mint-stylus/">
    <img src="https://img.shields.io/badge/download-Windows%20%7C%20macOS-mediumseagreen.svg" alt="Download">
  </a>
  <a href="https://github.com/Zettlr/Zettlr">
    <img src="https://img.shields.io/badge/fork%20of-Zettlr-lightgrey.svg" alt="Fork of Zettlr">
  </a>
</p>

---

> ### ⚖️ This is a modified version of Zettlr
>
> **Mint Stylus is a fork of [Zettlr](https://github.com/Zettlr/Zettlr)**, copyright
> © 2017–2026 Hendrik Erz / Zettlr GmbH, used and redistributed under the **GNU
> General Public License v3**. The Zettlr source has been **modified since
> 2026-07-01** to add the AI features described below and to rebrand the
> application.
>
> Mint Stylus is **not** Zettlr and is **not affiliated with, sponsored by, or
> endorsed by** the Zettlr project. Please send Mint Stylus bug reports and
> questions **here**, never to the Zettlr project.
>
> Full legal notice: **[`NOTICE.md`](NOTICE.md)** · Licence: **[`LICENSE`](LICENSE)** ·
> Upstream's own README is preserved verbatim as
> [`README-Zettlr-upstream.md`](README-Zettlr-upstream.md).

---

## What Mint Stylus adds on top of Zettlr

- **AI provider baked in** — bring your own key for OpenRouter, Ollama Cloud,
  Z.ai (GLM), local Ollama, or any custom OpenAI-compatible endpoint. Keys are
  encrypted with Electron `safeStorage`, stay in the main process, and are never
  bundled, shared, or sent anywhere but to the provider you chose.
- **Highlight → Summarize / Command** — a floating bubble on any selection.
  Summarize adapts to length (a short passage gets tighter rewrites; a whole page
  gets TL;DR + comprehensive + outline). Command offers presets — Shorten,
  Synonyms, Alternatives, Challenge Idea — or a free-text instruction. One-click
  Copy on every answer.
- **Inline `QQ … QQ` questions** — ask inside the document and keep writing; a
  question bar starts new conversations, and a global thinking-level dropdown
  trades speed for depth.
- **Web search** — optional Tavily, Brave, or DuckDuckGo lookups feeding answers.
- **"Write in My Style"** — a personal style guide the assistant follows.
- **AI menu** and a one-field **Preferences → AI** (pick a provider, paste a key).

Everything Zettlr already did — the editor, projects, citations, exports via
Pandoc, spellcheck — still works exactly as before.

## Download

Prebuilt Windows and macOS (Apple Silicon + Intel) builds:
**<https://nibblet.net/downloads/mint-stylus/>**

macOS installs best via the one-paste Terminal installer on that page; a
browser-downloaded `.zip` is quarantined by Gatekeeper because the app is
ad-hoc signed rather than notarized. See [`INSTALL.md`](INSTALL.md).

## Build from source

```bash
corepack enable                 # yarn 4 (or prefix commands with `corepack`)
corepack yarn install
corepack yarn start             # run in development
corepack yarn lint:types        # vue-tsc typecheck
corepack yarn test              # mocha
corepack yarn package:win-x64   # unpacked Windows build -> out/
corepack yarn release:win-x64   # NSIS installer -> release/
```

macOS builds can be cross-packaged from Linux/WSL — set
`MINT_STYLUS_SKIP_REBUILD=1` and use `package:mac-arm` / `package:mac-x64`.

## Repository layout

This repository is the single source of truth for Mint Stylus.

- **`main`** — the Mint Stylus line; all fork-specific work lands here.
- **`develop`** — tracks upstream Zettlr for periodic merges.
- AI code lives in `source/app/service-providers/ai/`, the renderer store in
  `source/pinia/ai.ts`, and the AI interface in `source/win-main/ai-panel/`.
- Build output (`out/`, `release/`, `node_modules/`, `.webpack/`) is git-ignored.

Fork changes are logged in [`CHANGELOG-MintStylus.md`](CHANGELOG-MintStylus.md);
`CHANGELOG.md` is Zettlr's inherited upstream changelog.

## Licence

**GNU General Public License v3** — the same licence as Zettlr, with no added
restrictions. The complete corresponding source for every published binary is in
this repository, and the full licence text is in [`LICENSE`](LICENSE) and inside
the app under **Help → About Mint Stylus → License**.

Upstream Zettlr authorship is preserved in the file headers throughout `source/`
and in the full commit history of this repository.
