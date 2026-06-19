# AGENTS.md — ChatPulse Development Guide

## Project Overview

ChatPulse is a **Manifest V3 Chrome Extension** for live stream chat analysis and audience intelligence. It connects to Twitch chat in real time, collects messages, and sends aggregated data to OpenRouter API using **free-tier LLM models only** ($0 cost).

**Stack:** TypeScript + React 18 + Tailwind CSS + Vite + crxjs + Zod + OpenRouter API

**MVP Scope:** Twitch only. Kick, YouTube, W.TV are architecturally planned but out of scope.

---

## Architecture

```
src/
├── popup/          # React UI (420×680px Chrome popup)
│   ├── App.tsx           # Root component, state management, message routing
│   ├── components/       # UI components (Consent, StreamInput, ReportViewer, etc.)
│   ├── index.html        # Popup entry HTML
│   ├── main.tsx          # React mount point
│   └── index.css         # Tailwind base styles
├── background/     # Service Worker (MV3, non-persistent)
│   └── service-worker.ts # Message routing, OpenRouter calls, IndexedDB buffer mgmt
├── content/        # Content Scripts (two-world injection)
│   ├── twitch-main.ts    # MAIN world: WebSocket.prototype override
│   └── twitch-isolated.ts# ISOLATED world: CustomEvent listener → SW relay
├── engine/         # LLM analysis pipeline
│   ├── promptBuilder.ts  # System/user prompt assembly
│   ├── reportParser.ts   # Zod validation + JSON extraction
│   └── openrouter.ts     # OpenRouter API client with retry/fallback
└── shared/         # Types, constants, utilities
    ├── types.ts          # UnifiedChatMessage, ChatPulseReport, UserSettings
    ├── constants.ts      # Model IDs, context windows, limits
    ├── messages.ts       # Twitch IRC parser → UnifiedChatMessage
    ├── dedup.ts          # Deduplication (IRC id primary, username+time hash fallback)
    ├── filter.ts         # Noise filtering (emotes, bots, URLs)
    └── storage.ts        # IndexedDB buffer + chrome.storage.local settings
```

---

## Key Technical Decisions

### 1. Two-World Content Script (CRITICAL)
Twitch's chat runs in the page's real `window` context. The default ISOLATED-world content script has its own `window` object. To intercept the page's WebSocket:

- **MAIN-world script** (`world: "MAIN"` in manifest): overrides `WebSocket.prototype` on the real page window, emits `CustomEvent("chatpulse:msg")` for each IRC frame
- **ISOLATED-world script**: listens for `chatpulse:msg` events, normalizes messages, forwards to Service Worker via `chrome.runtime.connect`

Both scripts are declared separately in `manifest.json` with the same URL match pattern. This is the standard MV3 pattern for intercepting page-created WebSockets.

### 2. Durable Message Buffer (IndexedDB)
MV3 service workers are non-persistent and unload after ~30s idle. Plain in-memory arrays lose data. The message buffer uses **IndexedDB** via the `idb` library, which survives SW restarts. Cap: 50,000 messages (~10MB).

### 3. Fixed Free-Only Model Chain
- **Default:** `openai/gpt-oss-120b:free` (131K context)
- **Fallback:** `google/gemma-4-31b-it:free` (262K context)
- **NO paid fallback. Ever.** If both fail, show raw data export option.
- Models are NOT user-editable in MVP.

### 4. Adaptive Few-Shot Examples
First API call uses base system prompt (lean). Only if Zod validation fails on the response, retry once with `temperature=0` and few-shot examples appended. This saves tokens on free-tier where prompt caching isn't guaranteed.

### 5. Deduplication (Single Strategy)
- **Primary:** Twitch IRC message `id` tag (exact, no false positives)
- **Fallback:** `hash(username:message:10s_window)` scoped per-user only (avoids collapsing copy-pasta raids from different users)

### 6. API Key Storage
- Stored in `chrome.storage.local` (NOT `sync`) — prevents propagation through Google account sync
- No `chrome.identity` encryption (that API is for OAuth, not storage encryption)
- UI recommends users set a spend limit on their OpenRouter key

---

## Development Commands

```bash
# Install dependencies
npm install

# Start dev server (hot-reload with crxjs)
npm run dev

# Build for production
npm run build

# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint
npm run lint

# Format
npm run format
```

---

## File Conventions

### Naming
- Components: `PascalCase.tsx` (e.g., `ReportViewer.tsx`)
- Utilities/modules: `camelCase.ts` (e.g., `promptBuilder.ts`)
- Tests: `*.test.ts` colocated in `src/__tests__/`
- Shared types: single `types.ts` barrel

### Code Style
- TypeScript strict mode — no `any`
- All interfaces explicit
- React functional components only (no class components)
- Tailwind utility classes (no custom CSS except scrollbar and animations)
- Named exports only (no default exports except `App.tsx` and `main.tsx`)

### API Response Types
All OpenRouter responses are typed via `OpenRouterResponse` interface in `openrouter.ts`. All parsed reports use `ChatPulseReport` from `types.ts`, validated by Zod schema in `reportParser.ts`.

---

## Testing Strategy

- **Unit tests** (Vitest): prompt builder, report parser, message normalizer, dedup, filter
- **E2E tests** (Playwright): mock WebSocket server in IRC format, verify content script injection
- **No integration tests** for OpenRouter API — use mock responses

---

## Common Pitfalls

1. **MAIN-world injection fails silently** — If Twitch changes its chat player internals, the WebSocket override won't fire. Check `console.log("[ChatPulse] MAIN-world WebSocket interceptor loaded")` in the page console.

2. **Service worker unloaded** — The content script handles `port.onDisconnect` and auto-reconnects. Messages buffer locally until reconnection. Don't assume the SW is always alive.

3. **Free-tier rate limits** — OpenRouter free models have shared rate limits (~20 req/min, ~50-1000/day depending on account). The UI must handle 429s gracefully with backoff and user-friendly messages.

4. **Context window overflow** — 50k messages × ~20 tokens ≈ 1M tokens. The prompt builder must truncate oldest messages while preserving temporal distribution. Both models' context windows (131K/262K) are checked.

5. **Zod validation** — The LLM may return snake_case keys. The `reportParser.ts` handles camelCase conversion. Don't assume the raw response matches TypeScript interfaces directly.

---

## Security Rules

- **Never log the API key** — redact in all error messages
- **Never commit `.env` files** — `.env.example` is committed, `.env` is not
- **HTTPS-only** — all API calls over TLS
- **No remote code** — all JS bundled at build time (MV3 requirement)
- **CSP:** `script-src 'self'`; no inline scripts
- **User consent required** — "Start Monitoring" button, never auto-collect

---

## Adding a New Platform (Post-MVP)

1. Create `src/content/{platform}-main.ts` (MAIN world WebSocket/fetch override)
2. Create `src/content/{platform}-isolated.ts` (ISOLATED world relay)
3. Add `content_scripts` entries to `manifest.json`
4. Add platform-specific IRC parser in `src/shared/messages.ts`
5. Extend `UnifiedChatMessage.platform` union type
6. Add host_permissions for the new domain

---

## Git Conventions

- Commit messages: `<type>(<scope>): <description>`
  - Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
  - Scopes: `popup`, `background`, `content`, `engine`, `shared`, `config`
- Example: `feat(engine): add adaptive few-shot retry on validation failure`

---

## Release Process

1. Update version in `package.json` and `manifest.json`
2. `npm run build`
3. Zip the `dist/` output
4. Create GitHub Release with semver tag (`v0.1.0`)
5. Attach zip artifact
6. Update README with install instructions

**No Chrome Web Store for MVP.** Distribution is GitHub Releases only. Users load as unpacked extension.
