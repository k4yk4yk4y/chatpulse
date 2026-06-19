import type { UnifiedChatMessage } from "./types";
import { EMOTE_RATIO_THRESHOLD } from "./constants";

const KNOWN_BOTS = new Set([
  "streamlabs",
  "nightbot",
  "moobot",
  "fossabot",
  "soundalerts",
  "stay_hydrated_bot",
  "slocool",
  "commanderroot",
  "streamelements",
  "wizebot",
]);

function isEmoteOnly(message: string, emotes: string[]): boolean {
  if (message.trim().length === 0) return true;

  const emoteCount = emotes.length;
  const wordCount = message.split(/\s+/).filter((w) => w.length > 0).length;

  if (wordCount === 0) return true;
  return emoteCount / wordCount > EMOTE_RATIO_THRESHOLD;
}

function isBotMessage(username: string, message: string): boolean {
  if (KNOWN_BOTS.has(username.toLowerCase())) return true;

  if (message.length < 3) return false;

  const trimmed = message.trim();
  const repeated = /^(.)\1{5,}/.test(trimmed);
  if (repeated) return true;

  if (/^![a-z]+(\s|$)/i.test(trimmed)) return true;

  return false;
}

function isUrlOnly(message: string): boolean {
  const urlPattern = /^https?:\/\/\S+$/;
  return urlPattern.test(message.trim());
}

export function filterMessage(msg: UnifiedChatMessage): boolean {
  if (isBotMessage(msg.username, msg.message)) {
    console.log("[ChatPulse FILTER] Bot message filtered:", msg.username);
    return false;
  }
  if (isEmoteOnly(msg.message, msg.emotes)) {
    console.log("[ChatPulse FILTER] Emote-only message filtered:", msg.username);
    return false;
  }
  if (isUrlOnly(msg.message)) {
    console.log("[ChatPulse FILTER] URL-only message filtered:", msg.username);
    return false;
  }
  return true;
}
