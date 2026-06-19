import type { UnifiedChatMessage } from "./types";

interface TwitchIRCMessage {
  id: string;
  username: string;
  displayName: string;
  message: string;
  badges: string[];
  emotes: string[];
  bits: number;
}

const BADGE_MAP: Record<string, string> = {
  broadcaster: "broadcaster",
  mod: "moderator",
  vip: "vip",
  subscriber: "subscriber",
  "premium/t1": "premium",
  "premium/t2": "premium",
  "premium/t3": "premium",
  "bits/100": "bits",
  "bits/1000": "bits",
  "bits/5000": "bits",
  "bits/10000": "bits",
};

function parseBadges(badgeStr: string): string[] {
  if (!badgeStr) return [];
  return badgeStr.split(",").map((b) => {
    const [key] = b.split("/");
    return BADGE_MAP[key] || key;
  });
}

function parseEmotes(emoteStr: string): string[] {
  if (!emoteStr) return [];
  return emoteStr.split("/").map((e) => {
    const [id] = e.split(":");
    return id;
  });
}

export function parseTwitchIRC(rawFrame: string): TwitchIRCMessage | null {
  if (!rawFrame.startsWith("@")) {
    console.log("[ChatPulse IRC] Frame missing @ prefix, skipping");
    return null;
  }

  const spaceIdx = rawFrame.indexOf(" ");
  if (spaceIdx === -1) {
    console.log("[ChatPulse IRC] Frame missing space delimiter, skipping");
    return null;
  }

  const tagStr = rawFrame.substring(1, spaceIdx);
  const rest = rawFrame.substring(spaceIdx + 1);

  const tags: Record<string, string> = {};
  for (const part of tagStr.split(";")) {
    const eqIdx = part.indexOf("=");
    if (eqIdx !== -1) {
      const key = part.substring(0, eqIdx);
      const rawVal = part.substring(eqIdx + 1).replace(/\+/g, " ");
      try {
        tags[key] = decodeURIComponent(rawVal);
      } catch {
        tags[key] = rawVal;
      }
    }
  }

  const msgIdMatch = rest.match(/:(\S+)!\S+ PRIVMSG #\S+ :(.+)/);
  if (!msgIdMatch) {
    console.log("[ChatPulse IRC] No PRIVMSG match in frame");
    return null;
  }

  const username = msgIdMatch[1].toLowerCase();
  const displayName = tags["display-name"] || username;
  const message = msgIdMatch[2];

  if (!message || message.trim().length === 0) {
    console.log("[ChatPulse IRC] Empty message from", username);
    return null;
  }

  const id = tags["msg-id"] || tags["id"] || `${username}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  console.log("[ChatPulse IRC] Parsed message from", username, "(id:", id, ")");
  return {
    id,
    username,
    displayName,
    message: message.trim(),
    badges: parseBadges(tags["badges"] || ""),
    emotes: parseEmotes(tags["emotes"] || ""),
    bits: parseInt(tags["bits"] || "0", 10) || 0,
  };
}

export function toUnifiedChatMessage(
  parsed: TwitchIRCMessage,
  timestamp: number
): UnifiedChatMessage {
  return {
    id: parsed.id,
    username: parsed.username,
    displayName: parsed.displayName,
    message: parsed.message,
    timestamp,
    badges: parsed.badges,
    emotes: parsed.emotes,
    bits: parsed.bits,
    platform: "twitch",
  };
}
