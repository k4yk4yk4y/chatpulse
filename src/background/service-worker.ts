import {
  addMessages,
  getMessagesInRange,
  clearMessages,
  getMessageCount,
  getSettings,
  saveHistory,
  updateHistoryEntry,
} from "../shared/storage";
import { analyzeChat } from "../engine/openrouter";
import { restoreState, persistCollectingState, startKeepAlive, stopKeepAlive, KEEP_ALIVE_ALARM } from "./sw-state";
import type { UnifiedChatMessage, StreamMetadata, ChatPulseReport } from "../shared/types";

let collecting = false;
let metadata: StreamMetadata = {
  title: "Unknown Stream",
  category: "Just Chatting",
  platform: "twitch",
  viewerCountApprox: 0,
  durationMonitored: 0,
};

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEP_ALIVE_ALARM) {
    console.log("[ChatPulse SW] Keep-alive tick, collecting:", collecting);
    if (!collecting) {
      stopKeepAlive();
    }
  }
});

restoreState().then((state) => {
  collecting = state.collecting;
  metadata = state.metadata;
  if (collecting) {
    startKeepAlive();
  }
  console.log("[ChatPulse SW] State restored, collecting:", collecting);
});

chrome.runtime.onConnect.addListener((connection) => {
  if (connection.name !== "chatpulse-content") return;

  console.log("[ChatPulse SW] Content script connected, id:", connection.sender?.tab?.id);

  connection.onMessage.addListener(async (msg: { type: string; payload: unknown }) => {
    switch (msg.type) {
      case "BATCH_MESSAGES": {
        const { messages } = msg.payload as { messages: UnifiedChatMessage[] };
        console.log("[ChatPulse SW] Received BATCH_MESSAGES:", messages.length, "messages, collecting:", collecting);
        if (collecting && messages.length > 0) {
          await addMessages(messages);
          const count = await getMessageCount();
          console.log("[ChatPulse SW] Total messages in DB:", count);
          broadcastToPopup({ type: "MESSAGE_COUNT", payload: count });
        }
        break;
      }
    }
  });

  connection.onDisconnect.addListener(() => {
    console.log("[ChatPulse SW] Content script disconnected");
  });
});

chrome.runtime.onMessage.addListener(
  (
    msg: { type: string; payload: unknown },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => {
    switch (msg.type) {
      case "START_COLLECTION": {
        collecting = true;
        const payload = msg.payload as Partial<StreamMetadata>;
        console.log("[ChatPulse SW] START_COLLECTION:", payload);
        if (payload) {
          metadata = { ...metadata, ...payload };
        }
        persistCollectingState(collecting, metadata);
        startKeepAlive();
        clearMessages();
        sendResponse({ success: true });
        break;
      }

      case "STOP_COLLECTION": {
        collecting = false;
        persistCollectingState(collecting, metadata);
        stopKeepAlive();
        console.log("[ChatPulse SW] STOP_COLLECTION");
        sendResponse({ success: true });
        break;
      }

      case "GET_MESSAGE_COUNT": {
        getMessageCount().then((count) => {
          console.log("[ChatPulse SW] GET_MESSAGE_COUNT:", count);
          sendResponse({ count });
        });
        return true;
      }

      case "ANALYZE": {
        console.log("[ChatPulse SW] ANALYZE request:", msg.payload);
        handleAnalysis(msg.payload as { startTime: number; endTime: number })
          .then((result) => {
            console.log("[ChatPulse SW] ANALYZE result:", result.report ? "success" : result.error);
            sendResponse(result);
          })
          .catch((error) => {
            console.error("[ChatPulse SW] ANALYZE error:", error);
            sendResponse({
              report: null,
              error: error instanceof Error ? error.message : "Analysis failed",
            });
          });
        return true;
      }

      case "GET_METADATA": {
        console.log("[ChatPulse SW] GET_METADATA");
        sendResponse({ metadata });
        break;
      }

      case "EXPORT_RAW": {
        console.log("[ChatPulse SW] EXPORT_RAW request:", msg.payload);
        handleRawExport(msg.payload as { startTime: number; endTime: number })
          .then((result) => {
            console.log("[ChatPulse SW] EXPORT_RAW result:", result.csv ? `csv length: ${result.csv.length}` : result.error);
            sendResponse(result);
          })
          .catch((error) => {
            console.error("[ChatPulse SW] EXPORT_RAW error:", error);
            sendResponse({ error: error instanceof Error ? error.message : "Export failed" });
          });
        return true;
      }
    }
  }
);

async function handleAnalysis(payload: {
  startTime: number;
  endTime: number;
}): Promise<{ report: ChatPulseReport | null; error?: string }> {
  console.log("[ChatPulse SW] handleAnalysis start:", { startTime: payload.startTime, endTime: payload.endTime });
  const settings = await getSettings();
  console.log("[ChatPulse SW] Settings loaded, hasApiKey:", !!settings.apiKey);
  const messages = await getMessagesInRange(payload.startTime, payload.endTime);
  console.log("[ChatPulse SW] Messages in range:", messages.length);

  const historyId = `analysis-${Date.now()}`;
  const streamUrl = `https://twitch.tv/${metadata.title}`;

  await saveHistory({
    id: historyId,
    streamUrl,
    streamTitle: metadata.title,
    timestamp: new Date().toISOString(),
    messageCount: messages.length,
    report: null,
    status: "pending",
  });
  console.log("[ChatPulse SW] Pending history entry saved:", historyId);

  const result = await analyzeChat(settings.apiKey, metadata, messages, settings.reportLanguage, settings.maxTopics, settings.topic);
  console.log("[ChatPulse SW] analyzeChat result:", result.report ? "success" : result.error);

  await updateHistoryEntry({
    id: historyId,
    streamUrl,
    streamTitle: metadata.title,
    timestamp: new Date().toISOString(),
    messageCount: messages.length,
    report: result.report,
    status: result.report ? "completed" : "failed",
  });
  console.log("[ChatPulse SW] History entry updated:", result.report ? "completed" : "failed");

  return result;
}

async function handleRawExport(payload: {
  startTime: number;
  endTime: number;
}): Promise<{ csv: string; error?: string }> {
  const messages = await getMessagesInRange(payload.startTime, payload.endTime);

  const header = "timestamp,username,display_name,message,badges,bits\n";
  const rows = messages
    .map((m) => {
      const escaped = (s: string) => `"${s.replace(/"/g, '""')}"`;
      return [
        new Date(m.timestamp).toISOString(),
        escaped(m.username),
        escaped(m.displayName),
        escaped(m.message),
        escaped(m.badges.join(";")),
        m.bits,
      ].join(",");
    })
    .join("\n");

  return { csv: header + rows };
}

function broadcastToPopup(message: { type: string; payload: unknown }): void {
  chrome.runtime.sendMessage(message).catch(() => {
    // Popup not open — that's fine
  });
}

chrome.action.onClicked.addListener((tab) => {
  const tabUrl = tab?.url || "";
  chrome.windows.create({
    url: chrome.runtime.getURL(`src/popup/index.html?url=${encodeURIComponent(tabUrl)}`),
    type: "popup",
    width: 450,
    height: 720,
  });
});

console.log("[ChatPulse] Service worker initialized");
