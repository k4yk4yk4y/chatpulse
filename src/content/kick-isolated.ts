import { parseKickChat, toUnifiedKickChatMessage } from "../shared/messages";
import { filterMessage } from "../shared/filter";
import { isDuplicate } from "../shared/dedup";
import type { UnifiedChatMessage } from "../shared/types";

const TAG = "[ChatPulse Kick ISOLATED]";

const CUSTOM_EVENT = "chatpulse:kick:msg";

let port: chrome.runtime.Port | null = null;
let messageBuffer: UnifiedChatMessage[] = [];
let extensionAlive = true;
const BUFFER_FLUSH_SIZE = 20;
const BUFFER_FLUSH_INTERVAL_MS = 1000;

function isExtensionValid(): boolean {
  try {
    return typeof chrome !== "undefined" && !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

function connectToSW(): void {
  if (!isExtensionValid()) {
    extensionAlive = false;
    console.warn(TAG, "Extension invalid, not connecting");
    return;
  }

  if (port) {
    try {
      port.disconnect();
    } catch {
      // Already disconnected
    }
  }

  try {
    port = chrome.runtime.connect({ name: "chatpulse-kick-content" });
    console.log(TAG, "Connected to SW");
  } catch (e) {
    console.warn(TAG, "Failed to connect to SW:", e);
    extensionAlive = false;
    return;
  }

  port.onDisconnect.addListener(() => {
    console.warn(TAG, "Disconnected from SW, reconnecting in 1s...");
    port = null;
    if (isExtensionValid()) {
      setTimeout(connectToSW, 1000);
    } else {
      extensionAlive = false;
      console.warn(TAG, "Extension invalid, not reconnecting");
    }
  });

  port.onMessage.addListener((msg: { type: string; payload: unknown }) => {
    if (msg.type === "FLUSH_ACK") {
      console.log(TAG, "FLUSH_ACK received, clearing buffer");
      messageBuffer = [];
    }
  });

  flushBuffer();
}

function flushBuffer(): void {
  if (messageBuffer.length === 0 || !port || !extensionAlive) return;

  const batch = messageBuffer.splice(0, BUFFER_FLUSH_SIZE);
  console.log(TAG, "Flushing", batch.length, "messages to SW (remaining:", messageBuffer.length, ")");
  try {
    port.postMessage({
      type: "BATCH_MESSAGES",
      payload: { messages: batch },
    });
  } catch (e) {
    console.warn(TAG, "Failed to send batch:", e);
  }
}

function handleChatEvent(event: CustomEvent<{ frame: string; timestamp: number }>): void {
  if (!extensionAlive) return;

  const { frame, timestamp } = event.detail;

  const parsed = parseKickChat(frame);
  if (!parsed) {
    console.log(TAG, "Frame parse returned null, skipping");
    return;
  }

  const unified = toUnifiedKickChatMessage(parsed, timestamp);

  if (isDuplicate(unified)) {
    console.log(TAG, "Duplicate message from", unified.username, "- skipped");
    return;
  }
  if (!filterMessage(unified)) {
    console.log(TAG, "Filtered out message from", unified.username, ":", unified.message.slice(0, 50));
    return;
  }

  console.log(TAG, "Accepted message from", unified.username, ":", unified.message.slice(0, 50));
  messageBuffer.push(unified);

  if (messageBuffer.length >= BUFFER_FLUSH_SIZE) {
    flushBuffer();
  }
}

window.addEventListener(CUSTOM_EVENT, handleChatEvent as EventListener);

setInterval(() => {
  if (extensionAlive) flushBuffer();
}, BUFFER_FLUSH_INTERVAL_MS);

try {
  connectToSW();
} catch {
  extensionAlive = false;
}

console.log(TAG, "Content script loaded");