import { describe, it, expect, beforeEach } from "vitest";
import { isDuplicate, resetDedup } from "../shared/dedup";
import type { UnifiedChatMessage } from "../shared/types";

function makeMessage(overrides: Partial<UnifiedChatMessage> = {}): UnifiedChatMessage {
  return {
    id: "msg-1",
    username: "testuser",
    displayName: "TestUser",
    message: "Hello world",
    timestamp: Date.now(),
    badges: [],
    emotes: [],
    bits: 0,
    platform: "twitch",
    ...overrides,
  };
}

describe("dedup", () => {
  beforeEach(() => {
    resetDedup();
  });

  it("allows the first message", () => {
    const msg = makeMessage({ id: "unique-1" });
    expect(isDuplicate(msg)).toBe(false);
  });

  it("blocks duplicate ID", () => {
    const msg = makeMessage({ id: "same-id" });
    expect(isDuplicate(msg)).toBe(false);
    expect(isDuplicate(msg)).toBe(true);
  });

  it("allows same message from different users", () => {
    const msg1 = makeMessage({ id: "id-1", username: "user1" });
    const msg2 = makeMessage({ id: "id-2", username: "user2" });
    expect(isDuplicate(msg1)).toBe(false);
    expect(isDuplicate(msg2)).toBe(false);
  });

  it("blocks same user with same message within window", () => {
    const msg1 = makeMessage({
      id: "id-a",
      username: "user1",
      message: "same text",
    });
    const msg2 = makeMessage({
      id: "id-b",
      username: "user1",
      message: "same text",
    });
    expect(isDuplicate(msg1)).toBe(false);
    expect(isDuplicate(msg2)).toBe(true);
  });

  it("reset clears all state", () => {
    const msg = makeMessage({ id: "to-reset" });
    expect(isDuplicate(msg)).toBe(false);
    resetDedup();
    expect(isDuplicate(msg)).toBe(false);
  });
});
