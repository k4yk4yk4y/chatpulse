export const MODELS = {
  DEFAULT: "openai/gpt-oss-120b:free",
  FALLBACK: "google/gemma-4-31b-it:free",
} as const;

export const CONTEXT_WINDOWS: Record<string, number> = {
  [MODELS.DEFAULT]: 131_072,
  [MODELS.FALLBACK]: 262_144,
};

export const MAX_BUFFER_SIZE = 50_000;

export const REPORT_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const DEDUP_WINDOW_MS = 10_000;

export const UI_UPDATE_INTERVAL_MS = 500;

export const RETRY_DELAYS_MS = [1000, 2000, 4000];

export const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

export const TWITCH_CHAT_WS = "wss://irc-ws.chat.twitch.tv:443";

export const EMOTE_RATIO_THRESHOLD = 0.7;

export const DEFAULT_TOPIC = "онлайн казино";

export const REPORT_LANGUAGES = [
  { code: "auto-detect", label: "Auto-detect" },
  { code: "en", label: "English" },
  { code: "ru", label: "Russian" },
  { code: "es", label: "Spanish" },
  { code: "de", label: "German" },
  { code: "fr", label: "French" },
  { code: "pt", label: "Portuguese" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
] as const;
