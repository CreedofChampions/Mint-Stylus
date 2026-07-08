# Mint Stylus — Changelog

**Mint Stylus** is a fork of [Zettlr](https://github.com/Zettlr/Zettlr) (GPL v3) with a real AI
assistant built into the editor. Bring your own key — nothing is bundled or shared.
*(The inherited upstream Zettlr history lives in `CHANGELOG.md`.)*

---

## v4.6.0 — 2026-07-08

First public release: the Zettlr markdown editor, rebranded and free, with AI baked right into the
editor — no browser tabs, no context-switching.

### Added — AI assistant
- **Inline questions** — type `/q your question q/` and the answer lands right in your document
  (single-line marker; it won't grab across lines).
- **Selection commands** — highlight text and a bubble offers quick commands: shorten, rewrite,
  summarize, synonyms, and *challenge your idea*. Commands are scoped to the selection.
- **Editable command presets** — edit each command's prompt and flow, add your own, or reset,
  all in **Preferences → AI**. Includes a fully custom command.
- **Bring-your-own-key providers** — OpenRouter, **WisGate** (one key, many models: Claude / GPT /
  DeepSeek / Gemini / GLM), Ollama (cloud or local), Z.ai, or any OpenAI-compatible **Custom**
  endpoint. Model is selectable per provider.
- **Context source** — point the AI at a local **Folder** of notes, an **MCP** server, or **Both**
  together (top-right selector).
- **Thinking level** — a global reasoning-effort dial.
- **Search in chat** — using the whole word "search" in a turn pulls **live, cited** results
  (Tavily / Brave / DuckDuckGo instant-answer) into the model call. No page scraping.
- **"Write in My Style"** — a `mint-style.md` file is read before every AI output so responses
  match your voice; it's created on first boot and editable from the AI menu.
- **AI panel** on the left that opens without covering the editor; the file manager is now closed
  by default.

### Security
- **Keys never reach the renderer** and are stored **encrypted** on your machine via the OS
  keychain (Electron `safeStorage`) — never in plaintext config, never bundled, never shared.
  **BYOK only.**
- Fixed AI key decryption on Electron 42 (async `safeStorage`).

### Changed — rebrand from Zettlr
- Full rebrand: name, app icon (mint-leaf stylus), menubar and tutorial logos, window titles,
  tray icons, drag-and-drop MIME types, exported-HTML meta tags, and onboarding.
- Zettlr's built-in update checker is disabled.
- Built on Zettlr (GPL v3). The source of all modifications is public in this repository, and the
  Zettlr name and logo are fully removed per Zettlr's reserved-brand policy.

### Install
- **Windows** — download `MintStylus-4.6.0-x64.exe` (self-contained installer; per-user, no admin;
  coexists with Zettlr as a separate app and data store).
- **macOS / Linux** — build from source: `corepack enable` then `corepack yarn install` →
  `corepack yarn package:mac-arm` | `package:mac-x64` | `package:linux-x64`.
