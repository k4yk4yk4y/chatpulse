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

interface KickChatMessage {
  id: string;
  username: string;
  displayName: string;
  message: string;
  badges: string[];
  emotes: string[];
}

let msgIdCounter = 0;

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

  const id = tags["msg-id"] || tags["id"] || `${username}-${Date.now()}-${++msgIdCounter}`;
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

// Kick Platform Chat Parser

interface KickWebSocketFrame {
  type?: string;
  event?: string;
  data?: KickChatData | string;
}

interface KickChatData {
  id?: string;
  chatroom_id?: number;
  content?: string;
  type?: string;
  created_at?: string;
  message?: KickMessage;
  sender?: KickSender;
  emotes?: KickEmote[];
}

interface KickMessage {
  text?: string;
  emotes?: KickEmote[];
}

interface KickEmote {
  id?: string;
  name?: string;
}

interface KickSender {
  username?: string;
  displayName?: string;
  badges?: KickBadge[];
}

interface KickBadge {
  id?: string;
  type?: string;
  text?: string;
}

/**
 * Parse Kick chat messages from WebSocket JSON frames.
 * Supports both legacy format ({type:"chat_message", data:{...}}) and
 * Pusher format ({event:"App\\Events\\ChatMessageEvent", data:"<json string>"}).
 */
export function parseKickChat(rawFrame: string): KickChatMessage | null {
  let outer: KickWebSocketFrame;
  try {
    outer = JSON.parse(rawFrame);
  } catch {
    console.log("[ChatPulse Kick] Invalid JSON frame, skipping");
    return null;
  }

  let data: KickChatData | null = null;

  const eventName = outer.event ?? outer.type ?? "";

  if (eventName === "App\\Events\\ChatMessageEvent" || eventName === "chat_message") {
    if (typeof outer.data === "string") {
      try {
        data = JSON.parse(outer.data);
      } catch {
        console.log("[ChatPulse Kick] Failed to parse inner data JSON, skipping");
        return null;
      }
    } else if (typeof outer.data === "object" && outer.data !== null) {
      data = outer.data;
    }
  }

  if (!data) return null;

  const content = data.content ?? data.message?.text ?? "";
  if (!content || content.trim().length === 0) {
    return null;
  }

  const username = data.sender?.username?.toLowerCase() || "unknown";
  const displayName = data.sender?.displayName || username;
  const message = content.trim();

  const badges: string[] = (data.sender?.badges || [])
    .map((b) => b.type || b.text || "")
    .filter((b) => b.length > 0);

  const emotes: string[] = (data.emotes || data.message?.emotes || [])
    .map((e) => e.id || e.name || "")
    .filter((e) => e.length > 0);

  return {
    id: data.id || `${username}-${Date.now()}-${++msgIdCounter}`,
    username,
    displayName,
    message,
    badges,
    emotes,
  };
}

export function toUnifiedKickChatMessage(
  parsed: KickChatMessage,
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
    bits: 0, // Kick doesn't have bits equivalent in the same way
    platform: "kick",
  };
}
