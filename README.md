# ChatPulse

Chrome Extension for live stream chat analysis and audience intelligence. Connects to Twitch chat in real time, collects messages, and produces structured AI-powered reports using free-tier LLM models — $0 per analysis.

## Tech Stack

- **TypeScript** + **React 18** + **Tailwind CSS**
- **Vite** + **crxjs** (Manifest V3)
- **Zod** for schema validation
- **OpenRouter API** (free models only: `openai/gpt-oss-120b:free`, `google/gemma-4-31b-it:free`)
- **IndexedDB** for durable message buffering and history

---

## Prerequisites

Before you begin, make sure you have:

1. **Google Chrome** (or Chromium-based browser: Edge, Brave)
2. **Node.js 18+** with npm (see [Installing Node.js & npm](#installing-nodejs--npm) below)
3. **OpenRouter API key** (free tier — $0 cost, see [Getting an OpenRouter API Key](#getting-an-openrouter-api-key) below)

---

## Installing Node.js & npm

Node.js is a JavaScript runtime that includes npm — a package manager for installing project dependencies.

### Linux / macOS

**Option A — nvm (recommended):**

nvm (Node Version Manager) lets you install and switch between Node versions easily.

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

# Close and reopen your terminal, then install Node.js 22 (LTS)
nvm install 22
nvm use 22

# Verify
node -v   # should print v22.x.x
npm -v    # should print 10.x.x or newer
```

**Option B — Official installer:**

Download the LTS version from [https://nodejs.org](https://nodejs.org). The installer includes npm automatically.

```bash
# After installation, verify:
node -v
npm -v
```

**Option C — Package manager:**

```bash
# Ubuntu / Debian
sudo apt update && sudo apt install -y nodejs npm

# macOS (Homebrew)
brew install node
```

> Full npm documentation: [https://docs.npmjs.com/cli](https://docs.npmjs.com/cli)

### Windows

**Option A — Official installer (recommended):**

1. Go to [https://nodejs.org](https://nodejs.org)
2. Download the **LTS** installer (`.msi` file)
3. Run the installer — keep all default settings (make sure "npm package manager" is checked)
4. **Restart your terminal** (or open a new PowerShell / CMD window)

```powershell
# Verify in PowerShell or CMD:
node -v   # should print v22.x.x
npm -v    # should print 10.x.x or newer
```

**Option B — fnm (Fast Node Manager):**

```powershell
# Install fnm via winget
winget install Schniz.fnm

# Restart terminal, then:
fnm install 22
fnm use 22

node -v
npm -v
```

**Option C — nvm-windows:**

Download the installer from [https://github.com/coreybutler/nvm-windows/releases](https://github.com/coreybutler/nvm-windows/releases), then:

```powershell
nvm install 22
nvm use 22
node -v
npm -v
```

> Full npm documentation: [https://docs.npmjs.com/cli](https://docs.npmjs.com/cli)

---

## Getting an OpenRouter API Key

OpenRouter is an API gateway that provides access to multiple LLM providers through a single API. ChatPulse uses it to call free-tier models — **you won't be charged anything**.

### Step 1 — Create an account

1. Go to [https://openrouter.ai](https://openrouter.ai)
2. Click **Sign Up** and register with your email or Google/GitHub account

### Step 2 — Generate an API key

1. Go to [https://openrouter.ai/keys](https://openrouter.ai/keys)
2. Click **Create Key**
3. Give it a name (e.g. "ChatPulse") and click **Create**
4. Copy the key (starts with `sk-or-v1-...`) — **you won't see it again**

### Step 3 — (Optional) Set a spend limit

Even though ChatPulse only uses free models, OpenRouter recommends setting a safety limit:

1. Go to [https://openrouter.ai/settings/limits](https://openrouter.ai/settings/limits)
2. Set a monthly spend limit (e.g. $0 or $1)

> Free models on OpenRouter have shared rate limits (~20 req/min, ~50–1000 requests/day depending on demand). The extension handles rate-limit errors gracefully with automatic retry and user-friendly messages.

---

## Installation

### Step 1 — Build the Extension

**Linux / macOS:**

```bash
git clone https://github.com/your-username/ChatPulse.git
cd ChatPulse
npm install
npm run build
```

**Windows:**

```cmd
git clone https://github.com/your-username/ChatPulse.git
cd ChatPulse
npm install
npm run build
```

> If Git is not installed, download it from [https://git-scm.com/download/win](https://git-scm.com/download/win) or clone the ZIP from GitHub.

### Step 2 — Enable Developer Mode in Chrome

1. Open Chrome (or Edge/Brave) and navigate to `chrome://extensions`
2. In the top-right corner, toggle **Developer mode** ON

   ![Developer mode toggle location: top-right corner of chrome://extensions page](https://img.shields.io/badge/Developer_mode-ON-blue?style=for-the-badge)

3. You should now see additional buttons appear: **Load unpacked**, **Pack extension**, and **Update**

### Step 3 — Load the Extension

1. Click the **Load unpacked** button (top-left area)
2. In the file dialog, navigate to the `dist/` folder inside your ChatPulse project directory
   - **Linux/macOS:** `~/ChatPulse/dist`
   - **Windows:** `C:\Users\<YourName>\ChatPulse\dist`
     > Tip: open File Explorer, go to `ChatPulse\dist`, click the address bar, and copy the full path
3. Select the `dist/` folder and click **Select** (or **Open**)

The ChatPulse extension icon should now appear in your browser toolbar.

### Loading in Edge / Brave

The process is identical — both support Chrome extensions:

- **Edge:** Navigate to `edge://extensions` → Enable **Developer mode** → **Load unpacked** → select `dist/`
- **Brave:** Navigate to `brave://extensions` → Enable **Developer mode** → **Load unpacked** → select `dist/`

### Updating After Code Changes

After pulling new changes or making edits:

```bash
npm run build
```

Then go back to `chrome://extensions` and click the **reload** icon (circular arrow) on the ChatPulse extension card.

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
