import type { StreamMetadata } from "../shared/types";

export const KEEP_ALIVE_ALARM = "chatpulse-keepalive";

export async function restoreState(): Promise<{ collecting: boolean; metadata: StreamMetadata }> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["sw_collecting", "sw_metadata"], (result) => {
      const collecting = !!result.sw_collecting;
      const metadata: StreamMetadata = result.sw_metadata ?? {
        title: "Unknown Stream",
        category: "Just Chatting",
        platform: "twitch",
        viewerCountApprox: 0,
        durationMonitored: 0,
      };
      console.log("[ChatPulse SW] State restored, collecting:", collecting);
      resolve({ collecting, metadata });
    });
  });
}

export function persistCollectingState(collecting: boolean, metadata: StreamMetadata): void {
  chrome.storage.local.set({ sw_collecting: collecting, sw_metadata: metadata });
}

export function startKeepAlive(): void {
  chrome.alarms.create(KEEP_ALIVE_ALARM, { periodInMinutes: 0.4 });
  console.log("[ChatPulse SW] Keep-alive alarm started");
}

export function stopKeepAlive(): void {
  chrome.alarms.clear(KEEP_ALIVE_ALARM);
  console.log("[ChatPulse SW] Keep-alive alarm stopped");
}
