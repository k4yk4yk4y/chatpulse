import { DEDUP_WINDOW_MS } from "./constants";
import type { UnifiedChatMessage } from "./types";

const seenIds = new Set<string>();
const seenHashes = new Map<string, number>();

function hashKey(username: string, message: string, windowMs: number): string {
  const windowIndex = Math.floor(Date.now() / windowMs);
  return `${username}:${message}:${windowIndex}`;
}

export function isDuplicate(msg: UnifiedChatMessage): boolean {
  if (seenIds.has(msg.id)) {
    console.log("[ChatPulse DEDUP] Duplicate by ID:", msg.id);
    return true;
  }

  const key = hashKey(msg.username, msg.message.toLowerCase().trim(), DEDUP_WINDOW_MS);
  const now = Date.now();

  const lastSeen = seenHashes.get(key);
  if (lastSeen !== undefined && now - lastSeen < DEDUP_WINDOW_MS) {
    console.log("[ChatPulse DEDUP] Duplicate by hash:", msg.username);
    return true;
  }

  seenIds.add(msg.id);
  seenHashes.set(key, now);

  if (seenIds.size > 100_000) {
    const idsArray = Array.from(seenIds);
    for (let i = 0; i < 50_000; i++) {
      seenIds.delete(idsArray[i]);
    }
    console.log("[ChatPulse DEDUP] Pruned 50k old IDs");
  }

  if (seenHashes.size > 100_000) {
    const entries = Array.from(seenHashes.entries());
    const cutoff = now - DEDUP_WINDOW_MS;
    for (const [k, v] of entries) {
      if (v < cutoff) seenHashes.delete(k);
    }
    console.log("[ChatPulse DEDUP] Pruned old hashes");
  }

  return false;
}

export function resetDedup(): void {
  seenIds.clear();
  seenHashes.clear();
}
