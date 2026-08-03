# Mint Stylus — Install Guide

A free, open-source markdown editor with AI built in — a fork of **Zettlr**.
*Write faster and better without ever leaving your markdown editor.*

<!-- edited by AI from here -->
## Windows (fastest)
1. Download: **https://nibblet.net/downloads/mint-stylus/MintStylus-4.8.7-x64.exe** (~144 MB)
2. Run **MintStylus-4.8.7-x64.exe**.
3. SmartScreen may warn "unknown publisher" (it's self-signed) → **More info → Run anyway**.
4. Installs per-user, no admin. Coexists with Zettlr (separate app + data).

## macOS (works out of the box)
Paste this in **Terminal** (⌘-Space, type "Terminal"):

```sh
curl -fsSL https://nibblet.net/downloads/mint-stylus/install-mac.sh | sh
```

That's it — it detects Apple Silicon vs Intel, installs to **/Applications**, and opens the app.
Terminal installs skip macOS quarantine, so there are **no Gatekeeper warnings**.

**Manual download** (if you prefer): grab
[MintStylus-4.8.7-mac-arm64.zip](https://nibblet.net/downloads/mint-stylus/MintStylus-4.8.7-mac-arm64.zip)
(Apple Silicon) or
[MintStylus-4.8.7-mac-x64.zip](https://nibblet.net/downloads/mint-stylus/MintStylus-4.8.7-mac-x64.zip)
(Intel), unzip, drag **Mint Stylus.app** to Applications. Because browser downloads are
quarantined and the app is ad-hoc signed (not notarized), macOS will warn on first open:
**System Settings → Privacy & Security → "Open Anyway"** (one time only). Or clear the flag in
Terminal: `xattr -dr com.apple.quarantine "/Applications/Mint Stylus.app"`.

Checksums: [SHA256SUMS-mac.txt](https://nibblet.net/downloads/mint-stylus/SHA256SUMS-mac.txt)
(the installer verifies these automatically).

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

## Linux (build from source)
Needs Node 20+, `corepack enable` (yarn 4), and a C++ toolchain.
`corepack yarn install` then `corepack yarn package:linux-x64`.

## Changelog
See [`CHANGELOG-MintStylus.md`](./CHANGELOG-MintStylus.md) — or
https://nibblet.net/downloads/mint-stylus/CHANGELOG.md

## Licence and source
Mint Stylus is a **modified version of [Zettlr](https://github.com/Zettlr/Zettlr)**
(Copyright © 2017–2026 Hendrik Erz / Zettlr GmbH), redistributed under the **GNU GPL v3**.
It is not affiliated with or endorsed by the Zettlr project.

Free forever. The complete corresponding source for every published build is at
**https://github.com/CreedofChampions/Mint-Stylus** — see `NOTICE.md` there for the
full legal notice.
