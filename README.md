# ChatPulse

Chrome Extension for live stream chat analysis and audience intelligence. Connects to Twitch chat in real time, collects messages, and produces structured AI-powered reports using free-tier LLM models — $0 per analysis.

## Tech Stack

- **TypeScript** + **React 18** + **Tailwind CSS**
- **Vite** + **crxjs** (Manifest V3)
- **Zod** for schema validation
- **OpenRouter API** (free models only: `openai/gpt-oss-120b:free`, `google/gemma-4-31b-it:free`)
- **IndexedDB** for durable message buffering and history

## Requirements

- Google Chrome (or Chromium-based browser: Edge, Brave)
- [OpenRouter API key](https://openrouter.ai/keys) (free tier — no cost)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/ChatPulse.git
   cd ChatPulse
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Open Chrome → `chrome://extensions` → Enable "Developer mode"

5. Click "Load unpacked" → select the `dist/` folder

## Usage

1. Click the ChatPulse icon in the browser toolbar

2. Enter your OpenRouter API key in Settings (one-time setup)

3. Navigate to any Twitch stream

4. Set the analysis topic (default: "онлайн казино") and time range

5. Click "Start Monitoring" — the extension collects chat messages

6. After the timer expires, the report is generated automatically

7. Review the report: sentiment, top topics with detailed descriptions, key users, and actionable recommendations

8. Export results as JSON or CSV (copy to clipboard)

## Development

```bash
npm run dev       # Start dev server with hot-reload
npm run build     # Production build
npm test          # Run unit tests
npm run test:watch  # Run tests in watch mode
```

## How It Works

The extension uses a two-world content script injection to intercept Twitch's WebSocket chat:
- **MAIN world** overrides `WebSocket.prototype` to capture IRC frames from the real page context
- **ISOLATED world** normalizes, deduplicates, filters, and batches messages to the Service Worker

Messages are buffered in IndexedDB (survives Service Worker restarts) and sent to OpenRouter for analysis. The LLM produces a structured JSON report with sentiment scores, top topics, user segments, and recommendations — all validated with Zod before display.

## License

MIT
