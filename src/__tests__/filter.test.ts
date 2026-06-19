import { describe, it, expect } from "vitest";
import { filterMessage } from "../shared/filter";
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

describe("filterMessage", () => {
  it("passes normal messages", () => {
    expect(filterMessage(makeMessage({ message: "This is a normal message" }))).toBe(true);
  });

  it("filters bot messages", () => {
    expect(filterMessage(makeMessage({ username: "nightbot", message: "!songrequest" }))).toBe(false);
    expect(filterMessage(makeMessage({ username: "streamlabs", message: "Alert!" }))).toBe(false);
    expect(filterMessage(makeMessage({ username: "moobot", message: "Auto message" }))).toBe(false);
  });

  it("filters emote-only messages", () => {
    expect(
      filterMessage(
        makeMessage({
          message: "Pog Pog Pog Pog Pog Pog Pog Pog",
          emotes: ["pog", "pog", "pog", "pog", "pog", "pog", "pog", "pog"],
        })
      )
    ).toBe(false);
  });

  it("filters URL-only messages", () => {
    expect(filterMessage(makeMessage({ message: "https://example.com" }))).toBe(false);
  });

  it("allows messages with mixed content", () => {
    expect(
      filterMessage(
        makeMessage({
          message: "Check this out https://example.com it's great",
          emotes: ["pog"],
        })
      )
    ).toBe(true);
  });

  it("allows empty emotes array with normal message", () => {
    expect(filterMessage(makeMessage({ message: "Great stream!", emotes: [] }))).toBe(true);
  });
});
