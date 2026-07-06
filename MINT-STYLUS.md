# Mint Stylus

**Mint Stylus** is a desktop Markdown writing app with AI baked in — highlight text
to summarize or run commands inline, ask questions with `QQ … QQ`, and keep a
"Write in My Style" guide the AI follows. It is a friendly, AI-native fork of the
excellent [Zettlr](https://github.com/Zettlr/Zettlr) editor.

> Mint Stylus is **based on Zettlr** (Copyright © Hendrik Erz), used and
> redistributed under the **GNU GPL v3**. It is not affiliated with or endorsed by
> the Zettlr project. The Zettlr name, "ζ" logo, and brand are Zettlr's; Mint
> Stylus ships its own name and mint-leaf-stylus icon.

## What Mint Stylus adds on top of Zettlr

- **AI provider baked in** — bring your own key for OpenRouter, Ollama Cloud,
  Z.ai (GLM), local Ollama, or any custom OpenAI-compatible endpoint. Keys are
  encrypted with Electron `safeStorage` and never leave the main process.
- **Highlight → Summarize / Command** — a floating bubble on any selection.
  Summarize adapts to length (short = 7 tighter rewrites, a whole page = TL;DR +
  comprehensive + outline). Command offers presets (Shorten, Synonyms,
  Alternatives, Challenge Idea) or a free-text instruction.
- **Inline `QQ … QQ` questions**, a top question-bar for new conversations, a
  global **Thinking-level** dropdown, and web search (Tavily / Brave / DuckDuckGo).
- **AI menu** and a one-field **Preferences → AI** (pick a provider, paste a key).

## Build

```bash
corepack enable            # yarn 4 (or use `corepack yarn …`)
corepack yarn install
corepack yarn start        # dev
corepack yarn lint:types   # vue-tsc typecheck
corepack yarn test         # mocha
ZETTLR_DISABLE_UPDATE_CHECK=1 corepack yarn package:win-x64
corepack yarn release:win-x64   # NSIS installer under release/
```

## Repository layout

This repo is the **single source of truth** for Mint Stylus. `develop` tracks
upstream Zettlr for periodic merges; **`main` is the Mint Stylus line** and holds
all Mint-specific work. Build artifacts (`out/`, `release/`, `node_modules/`,
`.webpack/`) are git-ignored. AI code lives under
`source/app/service-providers/ai/`, the renderer store in `source/pinia/ai.ts`,
and the AI UI under `source/win-main/ai-panel/`.

## License

GNU GPL v3 — see `LICENSE`. As a GPL fork, the full modified source is published
here, upstream authorship is preserved in git history, and the Zettlr name/logo
are not used.
