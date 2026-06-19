import { DEDUP_WINDOW_MS } from "./constants";
import type { UnifiedChatMessage } from "./types";

const ID_TTL_MS = 60 * 60 * 1000;
const MAX_IDS = 100_000;
const MAX_HASHES = 100_000;

class DedupStore {
  private seenIds = new Map<string, number>();
  private seenHashes = new Map<string, number>();

  private pruneIds(now: number): void {
    if (this.seenIds.size <= MAX_IDS) return;
    const cutoff = now - ID_TTL_MS;
    for (const [id, ts] of this.seenIds) {
      if (ts < cutoff) this.seenIds.delete(id);
    }
    if (this.seenIds.size > MAX_IDS) {
      const entries = Array.from(this.seenIds.entries())
        .sort((a, b) => a[1] - b[1]);
      const toRemove = entries.slice(0, this.seenIds.size - MAX_IDS / 2);
      for (const [id] of toRemove) this.seenIds.delete(id);
    }
    console.log("[ChatPulse DEDUP] Pruned IDs, remaining:", this.seenIds.size);
  }

  private pruneHashes(now: number): void {
    if (this.seenHashes.size <= MAX_HASHES) return;
    const cutoff = now - DEDUP_WINDOW_MS;
    for (const [k, v] of this.seenHashes) {
      if (v < cutoff) this.seenHashes.delete(k);
    }
    console.log("[ChatPulse DEDUP] Pruned hashes, remaining:", this.seenHashes.size);
  }

  isDuplicate(msg: UnifiedChatMessage): boolean {
    const now = Date.now();

    if (this.seenIds.has(msg.id)) {
      console.log("[ChatPulse DEDUP] Duplicate by ID:", msg.id);
      return true;
    }

    const windowIndex = Math.floor(now / DEDUP_WINDOW_MS);
    const key = `${msg.username}:${msg.message.toLowerCase().trim()}:${windowIndex}`;
    const lastSeen = this.seenHashes.get(key);
    if (lastSeen !== undefined && now - lastSeen < DEDUP_WINDOW_MS) {
      console.log("[ChatPulse DEDUP] Duplicate by hash:", msg.username);
      return true;
    }

    this.seenIds.set(msg.id, now);
    this.seenHashes.set(key, now);

    this.pruneIds(now);
    this.pruneHashes(now);

    return false;
  }

  reset(): void {
    this.seenIds.clear();
    this.seenHashes.clear();
  }
}

const store = new DedupStore();

export function isDuplicate(msg: UnifiedChatMessage): boolean {
  return store.isDuplicate(msg);
}

export function resetDedup(): void {
  store.reset();
}
