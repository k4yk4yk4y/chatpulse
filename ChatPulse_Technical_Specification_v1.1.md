# ChatPulse — Technical Specification & Development Plan

> **Chrome Extension for Live Stream Chat Analysis & Audience Intelligence**
> **Format:** Manifest V3 | **Stack:** TypeScript + React 18 + Tailwind CSS + Vite + crxjs + Zod + OpenRouter API (free-tier models only)
> **MVP Platform:** Twitch (Kick, YouTube, W.TV planned post-MVP)
> **Target:** Influence Marketing Managers, Community Managers, Streamer Agents & Brand Strategists
> **Distribution:** GitHub repo (no Chrome Web Store for MVP)

---

## 0. Changelog (v1.0 → v1.1)

Эта версия — результат архитектурного ревью v1.0. Главное:

| # | Изменение | Причина |
|---|-----------|---------|
| 1 | Дефолтная модель — `openai/gpt-oss-120b:free`, fallback — `google/gemma-4-31b-it:free`. Никаких платных моделей и автопереключения на них | Эксплуатация должна быть бесплатной для всех — и для нас, и для конечного пользователя |
| 2 | Убрана публикация в Chrome Web Store на этапе MVP — дистрибуция через GitHub Releases | Экономия $5 + времени на ревью стора |
| 3 | MVP сокращён до **только Twitch** | Самый стабильный и официально поддерживаемый источник чата (анонимный IRC/WS) — снижает риски сразу по нескольким пунктам ниже |
| 4 | Исправлена схема перехвата WebSocket (изоляция main/isolated world) | Без этого перехват чата технически не работал бы |
| 5 | Буфер сообщений перенесён из памяти service worker в IndexedDB / `chrome.storage.session` | MV3 service worker не персистентен и "засыпает", теряя данные |
| 6 | Унифицирована стратегия дедупликации | В v1.0 были описаны два конфликтующих метода |
| 7 | Исправлено заявление "all processing client-side" | Чат-данные физически уходят в OpenRouter / провайдера модели — это нужно честно отражать |
| 8 | Исправлено неверное заявление про шифрование ключа через `chrome.identity` | У этого API нет функции шифрования хранилища |
| 9 | Few-shot примеры в промпте сделаны адаптивными (не на каждый запрос) | Экономия токенов на моделях без prompt caching |
| 10 | KPI скорректированы под реальные ограничения free-tier | Старые цифры были недостижимы при бесплатных моделях |
| — | Бюджет бандла "<400KB" пока оставлен как несостыковка (экспорт в PDF его превышает) | Сознательно отложено по решению автора — вернуться после MVP |

---

## 0.1 Changelog (v1.1 → v1.1-current)

Обновление спецификации согласно текущей реализации (2026-06-19):

| # | Изменение | Причина |
|---|-----------|---------|
| 1 | Все настройки хранятся в `chrome.storage.local` (включая `reportLanguage`, `maxTopics`), а не в `chrome.storage.sync` | Sync-хранилище пропагирует данные через Google-аккаунт — API-ключ и настройки не должны покидать устройство |
| 2 | Добавлен параметр **Analysis Topic** (`topic`) — пользователь задаёт контекст анализа (дефолт: "онлайн казино"). Промпт инжектит тему в system prompt и user prompt | Позволяет фокусировать LLM на конкретной теме вместо общего анализа |
| 3 | Zod-схема использует **`coerceNum`** transform для всех числовых полей — принимает `number | string`, конвертирует строки через `parseFloat` | LLM (особенно gpt-oss-120b) возвращает числовые поля как строки (`"influence_score": "78"`) — `z.number()` отвергает такие ответы |
| 4 | Токен-эстимация через простую эвристику `text.length / 4` вместо `gpt-tokenizer` | `gpt-tokenizer` в devDependencies но не используется — эвристика достаточна для guard'а контекстного окна |
| 5 | Экспорт — только JSON и CSV (copy-to-clipboard), без PDF | `jspdf` в зависимостях но не интегрирован в UI — отложено до пост-MVP |
| 6 | History хранится в IndexedDB (store `"history"`), cap = 50 записей | Единое хранилище с буфером сообщений, персистентно через SW rest |
| 7 | Добавлен **auto-analyze** при истечении таймера сбора — автоматический запуск анализа по окончании выбранного диапазона | UX: пользователь не должен вручную нажимать "Analyze" после таймаута |
| 8 | Добавлен **raw CSV export** как fallback при ошибке анализа — экспортирует необработанные сообщения | Graceful degradation: если обе модели недоступны, пользователь не теряет собранные данные |
| 9 | Content script батчит сообщения по **20 штук** каждые **1000ms** через Port | Оптимизация: снижает количество `postMessage` вызовов при высокой нагрузке |
| 10 | SW state persistence через `chrome.storage.local` ключи `sw_collecting` / `sw_metadata` | Восстановление состояния сбора после rest SW |

---

## 1. Executive Summary / Concept

### 1.1 Problem Statement
Influence marketing in live streaming generates $15B+ annually, yet brands and streamer agents operate with near-zero visibility into real audience sentiment:
- **Time gap:** Manual review of 2-hour stream chat (5,000–50,000 messages) takes 3–6 hours per stream.
- **Signal-to-noise gap:** 90%+ of chat messages are emotes, spam, reactions ("Pog", "LUL"). Valuable feedback, complaints, and product mentions are buried.
- **Attribution gap:** No tool connects specific viewer pain points to actionable influencer feedback or product improvement loops.
- **Scale gap:** Agencies managing 20–100 streamers cannot manually monitor every broadcast.

### 1.2 Solution
**ChatPulse** is a browser extension that connects to **Twitch** live chat in real time (MVP scope), collects message history for a user-defined period, and sends aggregated data to **OpenRouter API** using **free-tier LLM models only** — no API costs for the user, no hosting costs for us. In **≈10–20 seconds** (best-effort, depends on free-tier queue — see §7) it produces a structured report:
- **Top-N audience problems / cases / questions** (пользователь выбирает 1–20)
- **Key usernames** driving each topic
- **Overall sentiment & engagement quality score**
- **Actionable recommendations** for brand / streamer / product team
- **Topic-focused analysis** — optional параметр `topic` позволяет фокусировать LLM на конкретной теме

Kick, YouTube, and W.TV support is architecturally planned (the platform-adapter interface is designed to be pluggable — see §2.2.C) but **out of scope for MVP**, because their chat APIs are reverse-engineered / undocumented and would multiply maintenance risk before the core product (one platform, working well) is validated.

### 1.3 Value Proposition
| Before | After |
|--------|-------|
| 3–6 hours manual chat review | ~15–20 sec AI-powered analysis, $0 per analysis |
| Subjective gut-feeling sentiment | Data-driven structured report |
| Feedback lost in noise | Top-N ranked issues with evidence |
| No link between chat and product team | Exportable JSON/CSV for stakeholders |
| Per-streamer manual work | Scalable to many streamers (Twitch first, more platforms later) |

### 1.4 Target Users
- **Influence Marketing Managers** — evaluate streamer audience quality before partnership
- **Community Managers** — monitor brand mentions and audience pain points
- **Streamer Agents / Managers** — provide data-backed feedback to talent
- **Product Teams** — collect unfiltered user feedback from live audiences
- **Brand Strategists** — measure campaign reception during sponsored streams

---

## 2. Product Architecture

### 2.1 High-Level Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  User Browser (Chrome / Edge / Brave)                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Popup UI (React 18 + Tailwind CSS)                  │   │
│  │  • Stream URL input with Twitch validation           │   │
│  │  • Time-range selector (5 / 15 / 30 min, 1 hr)      │   │
│  │  • Live message counter with countdown timer         │   │
│  │  • Auto-analyze on timer expiry                      │   │
│  │  • Analysis report viewer (accordion sections)       │   │
│  │  • Topic cards with expandable sample messages       │   │
│  │  • History (last 50 analyses, IndexedDB)             │   │
│  │  • Export: JSON / CSV (copy-to-clipboard)            │   │
│  │  • Raw CSV fallback on analysis failure              │   │
│  │  • Settings (API key, topic, language, max topics)   │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                       │                                     │
│  ┌──────────────────────▼──────────────────────────────┐   │
│  │  Service Worker (MV3, non-persistent)                │   │
│  │  • Receives BATCH_MESSAGES from content script       │   │
│  │    via reconnecting long-lived Port                  │   │
│  │  • Durable buffer in IndexedDB (survives SW restarts)│   │
│  │  • Token/context-window guard (length/4 heuristic)   │   │
│  │  • OpenRouter API client: gpt-oss-120b:free →        │   │
│  │    gemma-4-31b-it:free fallback. No paid fallback.   │   │
│  │  • Adaptive few-shot retry on Zod validation failure │   │
│  │  • History management (IndexedDB, cap=50)            │   │
│  │  • State persistence: sw_collecting, sw_metadata     │   │
│  │    via chrome.storage.local                          │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                       │                                     │
│  ┌──────────────────────▼──────────────────────────────┐   │
│  │  Content Script — TWO injection contexts (Twitch)    │   │
│  │  • MAIN world: WebSocket.prototype override          │   │
│  │    (constructor + addEventListener hook)              │   │
│  │  • ISOLATED world: CustomEvent listener → SW relay   │   │
│  │  • IRC parser, dedup, filter, batching (20 msg/batch)│   │
│  └───────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  OpenRouter API Layer (user-provided key, free models only) │
│  • openai/gpt-oss-120b:free (default, 131K context, $0)    │
│  • google/gemma-4-31b-it:free (fallback, 262K context, $0) │
│  • Structured JSON output (no response_format param)        │
│  • No automatic routing to paid models, ever                │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Component Breakdown

#### A. Popup UI (`src/popup/`)
- **Framework:** React 18 + Vite
- **Styling:** Tailwind CSS + `lucide-react` icons
- **Dimensions:** 420×680px
- **Components:**

| Компонент | Файл | Ответственность |
|-----------|------|-----------------|
| `App` | `App.tsx` | Root — state management, view routing (`main` / `settings` / `history`), message routing to SW |
| `ConsentScreen` | `ConsentScreen.tsx` | Privacy notice + first-run consent. Блокирует доступ до `consentGiven = true` |
| `StreamInput` | `StreamInput.tsx` | URL input с валидацией Twitch regex. Автодетект URL активной вкладки |
| `TimeRangeSelector` | `TimeRangeSelector.tsx` | Выбор диапазона: 5 / 15 / 30 мин, 1 час |
| `MessageCounter` | `MessageCounter.tsx` | Live-счётчик сообщений + countdown до авто-анализа |
| `ReportViewer` | `ReportViewer.tsx` | Sentiment gauge, engagement stats, top-3 topics (expandable to all), recommendations |
| `TopicCard` | `TopicCard.tsx` | Карточка топика: category icon, sentiment badge, severity, frequency, key users, actionable insight, expandable sample messages |
| `ExportPanel` | `ExportPanel.tsx` | JSON / CSV copy-to-clipboard кнопки |
| `History` | `History.tsx` | Список последних 50 анализов из IndexedDB |
| `Settings` | `Settings.tsx` | API key, Analysis Topic, Report Language, Max Topics slider |

- **Settings page:**
  - OpenRouter API key input (password toggle, link to openrouter.ai/keys)
  - **Analysis Topic** text input (дефолт: `онлайн казино`) — контекстная тема для фокуса LLM
  - **Report language selector** (`auto-detect` | `en` | `ru` | `es` | `de` | `fr` | `pt` | `ja` | `ko` | `zh`)
  - **Max topics slider** (1–20, default: 10)
  - Все настройки хранятся в `chrome.storage.local`

- **UX features:**
  - Progressive disclosure: default view = sentiment + top-3 topics; expand for full report
  - Topic detail: chevron toggle "Show sample messages (N)" — expands inline
  - Color semantics: 🟢 Positive | 🟡 Neutral | 🔴 Negative | ⚫ Critical
  - Skeleton screens while waiting for OpenRouter response
  - Error state with "Retry Analysis" button
  - Auto-trigger анализа по истечении таймера сбора
  - Raw CSV export fallback при ошибке анализа

#### B. Service Worker (`src/background/`)
- **Type:** Manifest V3 `service_worker` (event-driven, non-persistent — can be unloaded after ~30s idle)
- **Files:** `service-worker.ts` + `sw-state.ts`
- **Responsibilities:**
  - Receive `START_COLLECTION` / `STOP_COLLECTION` / `ANALYZE` / `GET_MESSAGE_COUNT` / `EXPORT_RAW` / `GET_METADATA` messages from popup
  - Read all settings from `chrome.storage.local` (API key, report_language, max_topics, topic, consent)
  - Maintain long-lived `chrome.runtime.connect` Port to content script
  - **State persistence:** `sw_collecting` + `sw_metadata` in `chrome.storage.local`, restored on SW init via `restoreState()`
  - **Keep-alive:** `chrome.alarms` каждые 0.4 мин пока `collecting = true`
  - **Durable message buffer in IndexedDB** (not plain in-memory array). Cap: 50,000 messages (~10MB). Auto-prune oldest when cap exceeded.
  - **History in IndexedDB** (store `"history"`), cap = 50 entries, sorted by timestamp desc
  - Deduplicate using single consistent strategy (see §2.4)
  - Token/context-window guard: `estimateTokens(text) = Math.ceil(text.length / 4)` — compare against model's context window (131K or 262K)
  - Call OpenRouter API with structured prompt, using only two allow-listed free models, in fixed priority order
  - **Adaptive few-shot retry:** if Zod validation fails on first response, retry once with few-shot examples appended and `temperature=0`
  - Coerce numeric fields from LLM responses (strings → numbers via `parseFloat`) —见 §2.5
  - Graceful degradation: if both models fail, return error message + offer raw CSV export
  - History entry lifecycle: `pending` → `completed` / `failed`

#### C. Content Script (`src/content/`)
- **Injection — two separate execution contexts, both needed:**
  1. **MAIN world** script (`world: "MAIN"`, `run_at: "document_start"`): runs in actual page context. Overrides `WebSocket` constructor via subclass (`ChatPulseWebSocket extends OrigWebSocket`) + hooks `addEventListener("message")`. Filters for `irc-ws.chat.twitch.tv` URL. Emits `CustomEvent("chatpulse:msg")` with `{frame, timestamp}`.
  2. **ISOLATED world** script (`run_at: "document_idle"`): has `chrome.*` API access. Listens for `chatpulse:msg` events, normalizes messages, deduplicates, filters, batches to SW.

- **MAIN-world interceptor details:**
  - Saves reference to `OrigWebSocket = window.WebSocket`
  - Creates `ChatPulseWebSocket extends OrigWebSocket` subclass
  - Subclass checks URL for `irc-ws.chat.twitch.tv` — if match, adds `message` event listener that calls `hookMessageEvent`
  - Also overrides `OrigWebSocket.prototype.addEventListener` to wrap `message` type listeners
  - `Object.defineProperty(window, "WebSocket", { value: ChatPulseWebSocket, writable: false, configurable: true })`
  - Emits `CustomEvent("chatpulse:msg", { detail: { frame, timestamp } })`

- **ISOLATED-world relay details:**
  - Batching: `BUFFER_FLUSH_SIZE = 20`, `BUFFER_FLUSH_INTERVAL_MS = 1000`
  - Messages buffered in `messageBuffer: UnifiedChatMessage[]`
  - Flushed via `port.postMessage({ type: "BATCH_MESSAGES", payload: { messages: batch } })`
  - Auto-reconnect on `port.onDisconnect` with 1s delay
  - Extension validity check: `typeof chrome !== "undefined" && !!chrome.runtime?.id`
  - Processing pipeline per message: `parseTwitchIRC` → `toUnifiedChatMessage` → `isDuplicate` → `filterMessage` → buffer

- **MVP responsibilities (Twitch only):**

| Platform | Interception Method | Message Schema | MVP status |
|----------|---------------------|----------------|-------------|
| **Twitch** | MAIN-world WebSocket subclass + addEventListener hook on `wss://irc-ws.chat.twitch.tv` | `{id, username, displayName, message, timestamp, badges, emotes, bits, platform}` | ✅ MVP |
| **Kick** | Override `WebSocket` to capture Pusher `App\Events\ChatMessageEvent` | `{id, username, content, timestamp, sender_identity}` | 🔜 Planned (post-MVP) |
| **YouTube** | Intercept `fetch`/`XHR` to `youtubei/v1/live_chat/get_live_chat` polling | `{id, authorName, message, timestamp, purchaseAmount, membershipInfo}` | 🔜 Planned (post-MVP) |
| **W.TV** | Override `WebSocket` to capture platform-specific chat events | `{id, username, message, timestamp}` | 🧊 Backlog |

- **Filtering (`src/shared/filter.ts`):**
  - Bot filter: known bot usernames (streamlabs, nightbot, moobot, fossabot, soundalerts, stay_hydrated_bot, slocool, commanderroot, streamelements, wizebot) + repetitive pattern detection (`/^(.)\1{5,}/`)
  - Emote-only filter: `emoteCount / wordCount > 0.7`
  - URL-only filter: messages matching `^https?://\S+$`

- **Normalization:** All messages normalized to `UnifiedChatMessage` interface before sending to service worker

#### D. LLM Prompt Engine (`src/engine/promptBuilder.ts`)
- **Type:** Deterministic prompt assembler (no ML, fully explainable)
- **Input:** Aggregated chat messages (deduplicated, filtered, time-sliced) + `topic` parameter
- **Output:** Structured prompt string for OpenRouter
- **Key features:**
  - Dynamic prompt length adaptation: truncate oldest messages if context-window limit exceeded
  - Language auto-detection or user-specified language override
  - Context injection: stream title, category, viewer count, duration
  - **Analysis Topic injection:** если `topic` задан, добавляет `## ANALYSIS TOPIC CONTEXT` секцию в system prompt + `Analysis Topic` в user prompt + фразу "in the context of the topic" в инструкции
  - **Adaptive few-shot examples** (не по умолчанию — только при retry)
  - Token estimation: `Math.ceil(text.length / 4)`

- **System prompt structure:**
  1. Role definition (ChatPulse analyst)
  2. Topic context block (if `topic` provided)
  3. Critical rules (8 items — ignore noise, focus on substance, evidence required, sample messages, language rule, max_topics, conciseness, no hallucination)
  4. Input format description
  5. Output JSON schema (full inline)
  6. Optional few-shot examples block

- **User prompt structure:**
  ```
  STREAM METADATA: {title, category, platform, viewers, duration, messages, filtered, language, maxTopics, topic}
  CHAT MESSAGES (chronological, deduplicated):
  {message_block}
  [truncation note if applicable]
  Analyze the above chat [in the context of the topic "{topic}"] and produce the JSON report.
  ```

#### E. Report Parser (`src/engine/reportParser.ts`)
- **Input:** Raw JSON string from OpenRouter
- **Output:** Validated `ChatPulseReport` object or `null`
- **Pipeline:**
  1. `extractJSON(text)`: tries markdown code block → raw braces extraction → returns parsed object or null
  2. `validateAndParseReport(raw, maxTopics)`: Zod `safeParse` → per-field error logging → `toCamelCase` transform → `maxTopics` slice → return

- **Zod schema — `coerceNum` transform:**
  ```typescript
  const coerceNum = z.union([z.number(), z.string()]).transform((v) => {
    const n = typeof v === "string" ? parseFloat(v) : v;
    return Number.isFinite(n) ? n : 0;
  });
  ```
  Все числовые поля в схеме используют `coerceNum` вместо `z.number()`. Это решает проблему LLM, возвращающих числа как строки (например `"influence_score": "78"`).

- **Schema fields:**
  - `report_meta`: generated_at, messages_analyzed (coerceNum), messages_substantive (coerceNum), dominant_language, confidence_score (coerceNum)
  - `overall_sentiment`: score (coerceNum), label (enum 5 значений), summary
  - `engagement_quality`: score (coerceNum), active_chatters_ratio (coerceNum), substantive_ratio (coerceNum), top_contributors[] (message_count + influence_score — coerceNum)
  - `top_topics[]`: rank (coerceNum), topic_title, category (enum 7), frequency (coerceNum), sentiment (enum 3), severity (enum 4), key_usernames[], evidence_quotes[], actionable_insight, related_topics[] (optional), sample_messages[] (optional)
  - `brand_mentions[]`: brand_name, context (enum 4), mentions_count (coerceNum), key_usernames[], sample_quotes[]
  - `audience_segments[]`: segment_name, estimated_size (enum 3), characteristics, key_usernames[]
  - `recommendations[]`: priority (enum 4), audience, action, expected_impitch

- **Post-processing (`toCamelCase`):**
  - snake_case → camelCase conversion for all field names
  - `top_topics` sorted by `frequency` descending, sliced to `maxTopics`
  - `sample_messages` sorted by `message.length` descending, sliced to top 5

#### F. Shared Modules (`src/shared/`)

| Модуль | Файл | Ответственность |
|--------|------|-----------------|
| Types | `types.ts` | `UnifiedChatMessage`, `StreamMetadata`, `ChatPulseReport`, `AnalysisHistory`, `UserSettings`, `PortMessage` |
| Constants | `constants.ts` | Model IDs, context windows, buffer limits, dedup window, retry delays, API URL, WS URL, emote threshold, default topic, report languages |
| Messages | `messages.ts` | `parseTwitchIRC` (IRC frame → `TwitchIRCMessage`) + `toUnifiedChatMessage` (→ `UnifiedChatMessage`) |
| Dedup | `dedup.ts` | `isDuplicate` — primary: IRC `id` tag; fallback: `hash(username:message:10s_window)` per-user. Memory cap: 100K IDs + 100K hashes with auto-prune |
| Filter | `filter.ts` | `filterMessage` — bot filter + emote-only filter + URL-only filter |
| Storage | `storage.ts` | IndexedDB via `idb` library. Stores: `messages` (keyPath: `id`), `history` (keyPath: `id`). Functions: addMessages, getMessagesInRange, getMessageCount, clearMessages, saveHistory, getHistory, deleteHistoryEntry, updateHistoryEntry, getSettings, saveSettings, getCachedReport |

### 2.3 Data Flow (Sequence)

```
1. User navigates to twitch.tv/xqc or opens popup directly
2. Popup auto-detects Twitch from active tab URL or user pastes Twitch URL
3. User sets time range (e.g., "Last 15 minutes") and clicks "Start Monitoring"
4. MAIN-world script overrides WebSocket constructor on real page window,
   starts emitting CustomEvents for every IRC PRIVMSG frame
5. ISOLATED-world content script receives events, parses IRC, normalizes,
   deduplicates, filters, batches (20 msg every 1s),
   pushes to Service Worker over long-lived Port
6. Service Worker writes to IndexedDB buffer
   (if Port disconnects because SW was unloaded, content script
   buffers locally and reconnects automatically — no message loss)
7. Popup shows live counter: "2,341 messages collected" (polled every 500ms)
8. Timer expires → auto-analyze triggers (or user clicks "Analyze" manually)
9. Service Worker:
   a. Reads settings from chrome.storage.local
   b. Saves pending history entry to IndexedDB
   c. Slices messages by time range
   d. Filters noise (emotes-only, bots, duplicates)
   e. Estimates tokens (length/4), checks against model context window
   f. Assembles structured prompt with topic context
   g. POST to OpenRouter: openai/gpt-oss-120b:free
      → on 429/5xx, return null → fall back to
        google/gemma-4-31b-it:free → never a paid model
   h. If response received but Zod validation fails →
      retry once with few-shot examples + temperature=0
   i. Coerce numeric fields (string → number) during validation
10. OpenRouter returns structured JSON report
11. Service Worker validates (Zod) → toCamelCase → maxTopics slice
    → updates history entry (completed/failed)
12. Popup renders report: Sentiment gauge, engagement stats,
    top-N topics with expandable sample messages, recommendations
13. User can export (JSON/CSV copy), view history, or start new analysis
14. If analysis fails → auto-trigger raw CSV export as fallback
```

### 2.4 API Stack & Rate Limits

| Provider | Endpoint | Use Case | Rate Limit |
|----------|----------|----------|------------|
| **OpenRouter (free tier)** | `POST /api/v1/chat/completions` | LLM analysis | ~20 req/min shared pool; daily cap ~50–1000/day depending on account. `gpt-oss-120b:free` returns upstream 429s even under light load — backoff mandatory |
| **Twitch IRC (anonymous, `justinfan`)** | `wss://irc-ws.chat.twitch.tv:443` | Real-time chat read | 20 msg/sec read, no auth required |

**Rate-limit / reliability strategy:**
- **Deduplication (single method):**
  1. Primary: Twitch IRC message `id` tag (exact, no false positives)
  2. Fallback: `hash(username:message:10s_window)` scoped per-user only
- **Context-window guard:** `Math.ceil(text.length / 4)` tokens vs model's context window (131K/262K)
- **Model fallback:** `openai/gpt-oss-120b:free` → `google/gemma-4-31b-it:free`. No paid fallback, ever.
- **Retry delays:** `[1000, 2000, 4000]` ms between model fallbacks

### 2.5 Known LLM Response Issues

| Проблема | Решение |
|----------|---------|
| LLM возвращает числа как строки (`"influence_score": "78"`) | `coerceNum` transform в Zod-схеме — `z.union([z.number(), z.string()]).transform(parseFloat)` |
| LLM оборачивает JSON в markdown code blocks | `extractJSON()` ищет ` ```json...``` ` перед raw braces extraction |
| LLM не соблюдает严格的 JSON schema | Zod safeParse + adaptive few-shot retry + temperature=0 |
| snake_case ключи вместо camelCase | `toCamelCase()` transform после валидации |

---

## 3. LLM Prompt Template (Core Asset)

### 3.1 Design Principles
1. **Maximize signal extraction** — force LLM to ignore noise (emotes, spam, reactions)
2. **Enforce structure** — strict JSON schema with no free-text hallucination
3. **Preserve evidence** — every claim must cite original usernames and message snippets
4. **Enable actionability** — output must be immediately usable by marketing/product teams
5. **Respect context-window limits** — adaptive truncation while preserving temporal distribution
6. **Stay token-lean** — no free-tier prompt caching guaranteed, so fixed overhead minimized on common path

### 3.2 System Prompt

```
You are ChatPulse, an expert audience intelligence analyst specializing in live streaming communities.
Your task is to analyze a batch of chat messages from a live stream and produce a structured intelligence report.

## ANALYSIS TOPIC CONTEXT (conditional — only when topic is set)
The user has specified the analysis topic: "{topic}".
When analyzing chat messages, focus on identifying issues, complaints, questions, and feedback
specifically related to this topic. Prioritize messages that are relevant to "{topic}" over
off-topic discussions. If messages contain references, slang, or context connected to this topic,
interpret them accordingly. If no messages relate to this topic, state so explicitly rather than
forcing irrelevant connections.

## CRITICAL RULES
1. IGNORE completely: pure emote messages, single-word reactions, spam/repeated messages.
2. FOCUS ON: questions, complaints, suggestions, product mentions, feature requests, bug reports,
   comparative mentions, and substantive feedback.
3. Every topic MUST be backed by specific usernames and direct message quotes as evidence.
4. For each topic, include up to 5 `sample_messages` — select the longest, most substantive
   messages that best illustrate the topic. Skip short reactions or emote-only messages.
5. **LANGUAGE RULE**: {language_instruction}
6. Respect `max_topics` parameter: generate exactly N top topics, sorted by `frequency` descending.
7. Be CONCISE: no fluff, no summaries for the sake of summaries.
8. Do NOT invent messages, usernames, or topics.

## INPUT FORMAT
- stream_metadata: {title, category, platform, viewer_count_approx, duration_monitored}
- messages: array of {username, message, timestamp, badges}
- report_language: string
- max_topics: number (1-20)
- analysis_topic: string (optional)

## OUTPUT FORMAT — STRICT JSON
{full JSON schema inline}
```

### 3.3 User Prompt Template

```
STREAM METADATA:
- Title: {title}
- Category: {category}
- Platform: twitch
- Approx. Viewers: {viewerCountApprox}
- Duration Monitored: {durationMonitored} minutes
- Messages Collected: {totalMessages}
- Messages After Filtering: {filteredMessages}
- Report Language: {reportLanguage}
- Max Topics to Generate: {maxTopics}
- Analysis Topic: {topic}

CHAT MESSAGES (chronological, deduplicated):
{messageBlock}

[if truncated: "Messages truncated to last {includedMessages} to fit context window."]

Analyze the above chat in the context of the topic "{topic}" and produce the JSON report.
```

### 3.4 Adaptive Few-Shot Examples

**Не отправляются на каждый запрос.** Только при retry после Zod validation failure.

```
## EXAMPLE 1 — SUBSTANTIVE CHAT (Tech Product Launch)
Input: @techgamer: The new mouse has insane latency... / @newbie123: How do I enable RGB sync?
Expected topics: 1. "Mouse latency vs competitors" (Praise) 2. "RGB sync setup" (Question) 3. "DPI nerf" (Complaint)

## EXAMPLE 2 — NOISE-HEAVY CHAT
Input: 90% "Pog", "LUL" + @viewer42: The audio is desynced
Expected: 1 topic only, low engagement score, critical recommendation
```

---

## 4. Best Practices for Implementation

### 4.1 Manifest V3 Compliance
- **No background pages:** `service_worker` with event listeners
- **No remote code:** all JS bundled at build time
- **Two-world content script injection:** MAIN world (`world: "MAIN"`, `run_at: "document_start"`) + ISOLATED world (`run_at: "document_idle"`)
- **Permissions:** `storage`, `activeTab`, `alarms`, `windows`
- **Host permissions:** `*://*.twitch.tv/*`
- **CSP:** `script-src 'self'; object-src 'self'`
- **Keyboard shortcut:** `Ctrl+Shift+C` / `Cmd+Shift+C` via `commands._execute_action`

### 4.2 Security & Privacy

- **Where data goes:** chat collection/filtering/dedup/normalization on-device. Aggregated dataset sent over HTTPS to OpenRouter → model provider (OpenAI/Google). Only place chat data leaves the device.
- **No first-party tracking:** no analytics, no telemetry, no fingerprinting
- **API key storage:** `chrome.storage.local` (plain text, NOT synced). No `chrome.identity` encryption available. UI recommends spend limit on OpenRouter key.
- **HTTPS-only:** all API calls over TLS
- **User consent:** explicit "I Understand & Accept" button on first run; never auto-collect
- **Privacy notice:** displayed on first run — explains data flow to OpenRouter and model provider

### 4.3 Performance
- **Durable message buffer:** IndexedDB-backed, 50,000 messages (~10MB) cap with auto-prune
- **Content script batching:** 20 messages per batch, 1s flush interval — reduces Port message overhead
- **Token estimation:** `Math.ceil(text.length / 4)` — simple heuristic, not `gpt-tokenizer`
- **Debounced UI updates:** message counter polled every 500ms
- **SW state persistence:** `sw_collecting` + `sw_metadata` in `chrome.storage.local`, restored on SW init
- **Keep-alive:** `chrome.alarms` every 0.4 min while collecting
- **History cap:** 50 entries in IndexedDB, oldest auto-deleted

### 4.4 Build & Distribution
- **Build tool:** Vite + `@crxjs/vite-plugin` (beta.28) for hot-reload
- **TypeScript:** strict mode, no `any`
- **Linting:** ESLint + Prettier
- **Testing:** Vitest (unit) + Playwright (E2E)
- **Distribution:** GitHub Releases only (`.zip` attached to semver-tagged release)
- **Known limitation:** no auto-update without Chrome Web Store; users must manually re-download

---

## 5. File Structure

```
src/
├── popup/
│   ├── App.tsx                    # Root component, state management, view routing
│   ├── main.tsx                   # React mount point
│   ├── index.html                 # Popup entry HTML
│   ├── index.css                  # Tailwind base styles
│   └── components/
│       ├── ConsentScreen.tsx       # First-run privacy consent
│       ├── StreamInput.tsx         # Twitch URL input with validation
│       ├── TimeRangeSelector.tsx   # 5/15/30 min, 1 hr selector
│       ├── MessageCounter.tsx      # Live counter + countdown timer
│       ├── ReportViewer.tsx        # Sentiment gauge, stats, topics, recommendations
│       ├── TopicCard.tsx           # Expandable topic card with sample messages
│       ├── ExportPanel.tsx         # JSON/CSV copy-to-clipboard
│       ├── History.tsx             # Last 50 analyses list
│       └── Settings.tsx            # API key, topic, language, max topics
├── background/
│   ├── service-worker.ts          # Message routing, API calls, history mgmt
│   └── sw-state.ts                # State persistence, keep-alive alarms
├── content/
│   ├── twitch-main.ts             # MAIN world: WebSocket.prototype override
│   └── twitch-isolated.ts         # ISOLATED world: CustomEvent → SW relay
├── engine/
│   ├── promptBuilder.ts           # System/user prompt assembly + topic context
│   ├── reportParser.ts            # Zod validation + coerceNum + JSON extraction
│   └── openrouter.ts              # OpenRouter API client with retry/fallback
├── shared/
│   ├── types.ts                   # UnifiedChatMessage, ChatPulseReport, UserSettings, etc.
│   ├── constants.ts               # Model IDs, context windows, limits, languages
│   ├── messages.ts                # Twitch IRC parser → UnifiedChatMessage
│   ├── dedup.ts                   # Deduplication (IRC id primary, hash fallback)
│   ├── filter.ts                  # Noise filtering (emotes, bots, URLs)
│   └── storage.ts                 # IndexedDB buffer + history + settings
├── __tests__/                     # Unit tests (Vitest)
└── vite-env.d.ts                  # Vite client types
```

---

## 6. Development Commands

```bash
npm install           # Install dependencies
npm run dev           # Start dev server (hot-reload with crxjs)
npm run build         # Production build (tsc + vite build)
npm run preview       # Preview production build
npm test              # Run unit tests (vitest run)
npm run test:watch    # Run tests in watch mode
npm run lint          # ESLint
npm run format        # Prettier
npm run e2e           # Playwright E2E tests
```

---

## 7. Success Metrics (KPIs)

| Metric | Target | How to measure | Note |
|--------|--------|----------------|------|
| Analysis time | < 20 sec (p50); track p90 separately | Chrome DevTools Performance + in-app timing log | Free-tier shared rate-limit pool means occasional spikes to 30–60s expected |
| Message collection accuracy | Best-effort, no hard target for MVP | Manual sample verification on Twitch anonymous IRC | Twitch anonymous read path is officially tolerated and stable |
| Report usefulness score | > 4.0 / 5.0 | In-app thumbs up/down per report | — |
| Cost per analysis | $0 | N/A — only free models are called | — |
| Free-tier failure rate | < 5% of attempts | Log fallback chain outcomes | Tracks whether free-only strategy is viable day to day |
| False-positive rate (noise in topics) | < 5% | User feedback + manual audit | — |
| User adoption | 100+ GitHub clones/downloads (Month 1) | GitHub repo traffic/Insights | — |
| Time saved per stream | 3–6 hours → ~20 sec | User interview | — |

---

## 8. Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Twitch changes anonymous IRC access | Chat collection fails | Watch Twitch developer changelog; anonymous read stable for years |
| Both free OpenRouter models rate-limited/deprecated | Analysis fails | Retry with backoff; if both fail, error + raw CSV export. No paid fallback. Periodically review free-models catalog |
| `gpt-oss-120b:free` returns upstream 429s under light usage | Slower/failed analyses | Treat as expected behavior — design UI error states around it from day one |
| LLM returns numeric fields as strings | Zod validation fails | `coerceNum` transform handles `number | string` → `parseFloat` |
| LLM wraps JSON in markdown code blocks | JSON extraction fails | `extractJSON()` tries code block extraction before raw braces |
| LLM hallucinates topics/usernames | Wrong insights | Strict JSON schema + Zod validation + adaptive few-shot retry + temperature=0 |
| No auto-update without Chrome Web Store | Users stay on stale versions | Clear GitHub Releases changelog; README sets expectations |
| Chrome "Disable developer mode extensions" nag | Non-technical users may disable | Address in README/FAQ |
| Privacy concerns (chat data sent to third-party LLM) | User trust loss | Explicit consent screen, honest data-flow disclosure |
| MAIN-world injection breaks if Twitch changes chat player | Collection silently stops | Manual smoke test before each release |
| Content script buffer overflow under extreme chat load | Memory pressure | Cap at 50K messages with auto-prune; batch by 20 to reduce overhead |

---

## 9. Future Perspectives (v2 & Beyond)

### 9.1 Real-Time Alerting
- Live trigger words: auto-alert popup when "scam", "bug", "broken", "refund" mentioned >N times in 5 min
- Slack/Discord webhook integration for team notifications

### 9.2 Streamer Portfolio Dashboard
- Aggregate reports across all monitored streamers
- Trend graphs: sentiment over time, topic evolution, audience growth quality

### 9.3 Competitive Intelligence
- Monitor competitor brand mentions across multiple streams simultaneously

### 9.4 Custom Prompt Templates
- User-defined prompt templates for specific use cases
- A/B test prompt variants

### 9.5 On-Device LLM (Privacy Mode)
- Chrome's built-in AI (Prompt API) or local model via `transformers.js`
- Zero cloud dependency for sensitive brand data

### 9.6 Sentiment Heatmap
- Visual heatmap of sentiment across stream timeline (5-minute buckets)
- Correlate with stream events

### 9.7 Influencer Scoring
- "Audience Quality Score" per streamer based on substantive ratio, sentiment stability, brand mention quality, toxicity level

### 9.8 Multi-platform Expansion
- Kick / YouTube / W.TV adapters — each ships independently once interception method is validated

### 9.9 Export Enhancements
- PDF export via `jsPDF` (dependency already present)
- History search/filter
- Power user highlighting (users appearing in 3+ topics)

---

## 10. Appendix: OpenRouter Integration Reference

### 10.1 API Endpoint
```
POST https://openrouter.ai/api/v1/chat/completions
```

### 10.2 Request Headers
```
Authorization: Bearer {user_api_key}
Content-Type: application/json
HTTP-Referer: https://github.com/chatpulse
X-Title: ChatPulse
```

### 10.3 Request Body
```json
{
  "model": "openai/gpt-oss-120b:free",
  "messages": [
    {"role": "system", "content": "{system_prompt}"},
    {"role": "user", "content": "{user_prompt_with_messages}"}
  ],
  "temperature": 0.1
}
```

**Note:** `response_format` и `max_tokens` не используются — модели возвращают JSON свободно, а лимит на выход определяется провайдером.

### 10.4 Allow-listed Models (MVP — free only, fixed priority)

| Order | Model | Context window | Price | Notes |
|-------|-------|-----------------|-------|-------|
| 1 (default) | `openai/gpt-oss-120b:free` | 131,072 tokens | $0 / $0 | 117B MoE, strong reasoning. Observed returning upstream 429s under light load |
| 2 (fallback) | `google/gemma-4-31b-it:free` | 262,144 tokens | $0 / $0 | ~31B dense, larger context window — also escape valve for messages that don't fit in 131K |

No other model is called automatically. A future "custom model" field (post-MVP) must show a non-free-cost warning before use.

### 10.5 Token / Context Budget
```
input_tokens ≈ system_prompt.length/4 + user_prompt.length/4
output_tokens = estimated 2000–4000 (report JSON)

if input_tokens > active_model_context_window - 6000:
    truncate oldest chat messages until it fits
```

---

*Document version: 1.1-current*
*Last updated: 2026-06-19*
*Author: ChatPulse Product Team*
*Changes from v1.1: see §0.1*
