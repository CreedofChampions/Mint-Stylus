<!-- created by AI -->
# NOTICE — Mint Stylus is a modified version of Zettlr

This file exists to satisfy the notice requirements of the GNU General Public
License, Version 3 (see [`LICENSE`](LICENSE) for the full text).

## 1. This is a modified work

**Mint Stylus is a modified version of [Zettlr](https://github.com/Zettlr/Zettlr).**
It is *not* Zettlr, it is not produced by the Zettlr project, and it is not
affiliated with, sponsored by, or endorsed by the Zettlr project or its authors.

Modifications to the original Zettlr source began on **2026-07-01** and are
ongoing. The most recent modification date is recorded in the git history of
this repository and summarised in
[`CHANGELOG-MintStylus.md`](CHANGELOG-MintStylus.md).

*(GPL v3 §5(a) — prominent notice of modification, with a relevant date.)*

## 2. Original work and copyright

| | |
|---|---|
| Original program | Zettlr — "Your One-Stop Publication Workbench" |
| Original author | Hendrik Erz (and the Zettlr contributors) |
| Copyright | Copyright © 2017–2026 Hendrik Erz / Zettlr GmbH |
| Upstream source | https://github.com/Zettlr/Zettlr |
| Upstream licence | GNU GPL v3 |

All original copyright, licence and authorship notices in the source files have
been left intact. Upstream file headers still name their original maintainers.
No copyright notice has been removed, altered, or replaced anywhere in this
repository. *(GPL v3 §5(c).)*

## 3. Licence of this modified work

Mint Stylus as a whole is licensed under the **GNU General Public License,
Version 3 or (at your option) any later version** — the same licence as Zettlr.
There are no additional restrictions. The complete licence text ships with this
repository in [`LICENSE`](LICENSE) and is also displayed inside the application
under **Help → About Mint Stylus → License**. *(GPL v3 §5(b), §5(d), §7.)*

    Mint Stylus — an AI-native fork of Zettlr.
    Copyright (C) 2017–2026 Hendrik Erz / Zettlr GmbH (original work)
    Copyright (C) 2026 the Mint Stylus contributors (modifications)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.

## 4. Where to get the complete corresponding source

Every binary of Mint Stylus that is distributed (Windows installer, macOS
`arm64`/`x64` builds, and any archive published at
<https://nibblet.net/downloads/mint-stylus/>) is built from the source in this
repository:

> **https://github.com/CreedofChampions/Mint-Stylus**

The repository is public, requires no account, and contains the complete
corresponding source for every released binary, including the build scripts and
packaging configuration needed to reproduce it (`forge.config.js`,
`electron-builder.yml`, `scripts/`, `package.json`). Build instructions are in
[`README.md`](README.md). This offer is valid for anyone who receives a Mint
Stylus binary, from any source. *(GPL v3 §6.)*

## 5. Summary of the modifications

The substantive changes made to Zettlr in this fork are:

- **A built-in AI assistant** — bring-your-own-key support for OpenRouter,
  Ollama Cloud, Z.ai (GLM), local Ollama, and any OpenAI-compatible endpoint.
  New code under `source/app/service-providers/ai/`, `source/pinia/ai.ts`, and
  `source/win-main/ai-panel/`.
- **Selection tools** — a floating bubble on any text selection offering
  Summarize and Command (Shorten, Synonyms, Alternatives, Challenge Idea, or a
  free-text instruction), plus one-click Copy.
- **Inline questions** — `QQ … QQ` in the document, a question bar for new
  conversations, a global thinking-level control, and optional web search
  (Tavily / Brave / DuckDuckGo).
- **A "Write in My Style" guide** the assistant follows.
- **Preferences → AI** and a top-level **AI** menu.
- **Rebranding** — the application is named Mint Stylus and ships its own icon
  set and bundle identity (`app.mintstylus`). See §6.
- **Packaging changes** — macOS builds cross-packaged from a non-macOS host, and
  the upstream in-app update check compiled out.

Nothing has been removed from Zettlr's own feature set.

## 6. Trademarks and branding

The GPL grants rights to the *code*; it does not grant rights to names or logos.
Accordingly:

- The names **"Zettlr"**, the Zettlr "ζ" mark, and the Zettlr logo and website
  branding are the property of the Zettlr project and are used here only to
  identify the upstream work, as permitted for nominative reference.
- **Mint Stylus** ships under its own name and its own mint-leaf-stylus icon.
  Upstream's unmodified branding assets are not used to identify this build.
- Nothing in this fork should be read as a claim of endorsement by, or
  affiliation with, the Zettlr project. *(GPL v3 §7(e).)*
- Bug reports, feature requests and support questions about Mint Stylus must go
  to this repository — **never** to the Zettlr project, its forum, its Discord,
  or its issue tracker.

## 7. Other third-party components

Mint Stylus inherits Zettlr's dependencies, each under its own licence,
including Electron, Node.js, CodeMirror, Pandoc, Hunspell, the Citation Style
Language (CSL) styles and locales, and the bundled fonts. Their licences are
listed inside the application under **Help → About Mint Stylus** (the
*Projects*, *Fonts* and *License* tabs) and in the dependency metadata in
`node_modules` after an install.
