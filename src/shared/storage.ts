import { openDB, type IDBPDatabase } from "idb";
import type { UnifiedChatMessage, AnalysisHistory, UserSettings } from "./types";
import { MAX_BUFFER_SIZE, REPORT_CACHE_TTL_MS, DEFAULT_TOPIC } from "./constants";

const DB_NAME = "chatpulse-db";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    console.log("[ChatPulse STORAGE] Opening IndexedDB:", DB_NAME, "v" + DB_VERSION);
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        console.log("[ChatPulse STORAGE] Upgrading DB, existing stores:", Array.from(db.objectStoreNames));
        if (!db.objectStoreNames.contains("messages")) {
          db.createObjectStore("messages", { keyPath: "id" });
          console.log("[ChatPulse STORAGE] Created 'messages' store");
        }
        if (!db.objectStoreNames.contains("history")) {
          db.createObjectStore("history", { keyPath: "id" });
          console.log("[ChatPulse STORAGE] Created 'history' store");
        }
      },
    });
  }
  return dbPromise;
}

export async function addMessages(messages: UnifiedChatMessage[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("messages", "readwrite");
  const store = tx.objectStore("messages");

  for (const msg of messages) {
    await store.put(msg);
  }

  const count = await store.count();
  await tx.done;

  console.log("[ChatPulse STORAGE] addMessages:", messages.length, "added, total:", count);
  if (count > MAX_BUFFER_SIZE) {
    const toDelete = count - MAX_BUFFER_SIZE;
    console.log("[ChatPulse STORAGE] Pruning", toDelete, "old messages via cursor");
    const deleteTx = db.transaction("messages", "readwrite");
    const deleteStore = deleteTx.objectStore("messages");
    let cursor = await deleteStore.openCursor();
    let deleted = 0;
    while (cursor && deleted < toDelete) {
      await cursor.delete();
      deleted++;
      cursor = await cursor.continue();
    }
    await deleteTx.done;
  }
}

export async function getMessagesInRange(
  startTime: number,
  endTime: number
): Promise<UnifiedChatMessage[]> {
  const db = await getDB();
  const all = await db.getAll("messages");
  const filtered = all.filter((m) => m.timestamp >= startTime && m.timestamp <= endTime);
  console.log("[ChatPulse STORAGE] getMessagesInRange:", filtered.length, "messages from", all.length, "total");
  return filtered;
}

export async function getAllMessages(): Promise<UnifiedChatMessage[]> {
  const db = await getDB();
  return db.getAll("messages");
}

export async function getMessageCount(): Promise<number> {
  const db = await getDB();
  return db.count("messages");
}

export async function clearMessages(): Promise<void> {
  const db = await getDB();
  await db.clear("messages");
}

export async function saveHistory(entry: AnalysisHistory): Promise<void> {
  const db = await getDB();
  await db.put("history", entry);

  const count = await db.count("history");
  if (count > 50) {
    const toPrune = count - 50;
    console.log("[ChatPulse STORAGE] Pruning", toPrune, "old history entries via cursor");
    const tx = db.transaction("history", "readwrite");
    const store = tx.objectStore("history");
    let cursor = await store.openCursor();
    let deleted = 0;
    while (cursor && deleted < toPrune) {
      await cursor.delete();
      deleted++;
      cursor = await cursor.continue();
    }
    await tx.done;
  }
}

export async function getHistory(): Promise<AnalysisHistory[]> {
  const db = await getDB();
  const all = await db.getAll("history");
  return all.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export async function getHistoryEntry(id: string): Promise<AnalysisHistory | null> {
  const db = await getDB();
  return (await db.get("history", id)) ?? null;
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("history", id);
}

export async function updateHistoryEntry(entry: AnalysisHistory): Promise<void> {
  const db = await getDB();
  await db.put("history", entry);
}

export function getSettings(): Promise<UserSettings> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(
      ["apiKey", "reportLanguage", "maxTopics", "topic", "consentGiven"],
      (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        const settings = {
          apiKey: result.apiKey || "",
          reportLanguage: result.reportLanguage || "auto-detect",
          maxTopics: result.maxTopics || 10,
          topic: result.topic || DEFAULT_TOPIC,
          consentGiven: result.consentGiven || false,
        };
        console.log("[ChatPulse STORAGE] getSettings:", { hasApiKey: !!settings.apiKey, language: settings.reportLanguage, topic: settings.topic, consent: settings.consentGiven });
        resolve(settings);
      }
    );
  });
}

export function saveSettings(settings: Partial<UserSettings>): Promise<void> {
  console.log("[ChatPulse STORAGE] saveSettings:", Object.keys(settings));
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(settings, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

export async function getCachedReport(
  streamUrl: string
): Promise<AnalysisHistory | null> {
  const db = await getDB();
  const all = await db.getAll("history");
  const match = all.find((h) => h.streamUrl === streamUrl);
  if (!match) return null;

  const age = Date.now() - new Date(match.timestamp).getTime();
  if (age > REPORT_CACHE_TTL_MS) {
    await db.delete("history", match.id);
    return null;
  }

  return match;
}
