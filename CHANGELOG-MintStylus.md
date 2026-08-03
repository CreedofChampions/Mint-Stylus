# Mint Stylus — Changelog

**Mint Stylus** is a fork of [Zettlr](https://github.com/Zettlr/Zettlr) (GPL v3) with a real AI
assistant built into the editor. Bring your own key — nothing is bundled or shared.
*(The inherited upstream Zettlr history lives in `CHANGELOG.md`.)*

---

<!-- edited by AI from here -->
## v4.8.8 — 2026-08-03

### Licence and attribution
- The app now states, in **Help → About Mint Stylus**, that it is a modified version of Zettlr,
  when it was modified, that it is not affiliated with or endorsed by the Zettlr project, and
  where to get the complete source code — as the GNU GPL v3 requires of a modified work.
- The project's source is public at
  [github.com/CreedofChampions/Mint-Stylus](https://github.com/CreedofChampions/Mint-Stylus),
  with a full `NOTICE.md`, upstream's original README preserved alongside our own, and Zettlr's
  authorship intact in the commit history.

### Copy button
- One-click **Copy** on AI answers, and AI output text is selectable.

*No change to how the editor or the AI assistant behave — this is a licence-and-attribution
release, rebuilt from the same code.*

## v4.8.7 — 2026-07-16

### Added — macOS support
- **Native macOS builds** for Apple Silicon (`arm64`) and Intel (`x64`), with all features
  included: the AI assistant, spellcheck (bundled darwin Hunspell binding), file watching
  (fsevents), and a bundled darwin Pandoc 3.10 for exports.
- **One-paste Terminal installer** (`install-mac.sh`) — installs to `/Applications` and opens
  the app immediately. Terminal installs skip macOS quarantine, so there are no Gatekeeper
  hoops. Manual `.zip` / `.tar.gz` downloads are also available.
- Apps are **ad-hoc signed** (required on Apple Silicon). They are not notarized (no Apple
  Developer account), so a browser-downloaded copy needs the usual right-click → Open /
  "Open Anyway" dance — use the installer command instead.

### Build infrastructure
- macOS apps can now be **cross-packaged from a non-mac host**: mac icon resources follow the
  *target* platform, darwin-only optional deps (fsevents) install on Linux via Yarn
  `supportedArchitectures`, and native-module rebuilds can be skipped with
  `MINT_STYLUS_SKIP_REBUILD=1` (prebuilt darwin binaries are injected instead).

*(Changes between v4.6.1 and v4.8.6 — AI provider picker, inline `/q` context, working-state
badge, and related fixes — are tracked in the git history.)*

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
