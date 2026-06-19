import { describe, it, expect } from "vitest";
import { parseTwitchIRC, toUnifiedChatMessage } from "../shared/messages";

describe("parseTwitchIRC", () => {
  it("parses a valid Twitch PRIVMSG", () => {
    const frame =
      "@badge-info=;badges=broadcaster/1;bits=0;color=#FF0000;display-name=TestUser;emotes=;flags=;id=abc123;mod=0;room-id=12345;subscriber=0;tmi-sent-ts=1700000000000;turbo=0;user-id=12345;user-type= :testuser!testuser@testuser.tmi.twitch.tv PRIVMSG #testuser :Hello world!";

    const result = parseTwitchIRC(frame);

    expect(result).not.toBeNull();
    expect(result!.id).toBe("abc123");
    expect(result!.username).toBe("testuser");
    expect(result!.displayName).toBe("TestUser");
    expect(result!.message).toBe("Hello world!");
    expect(result!.badges).toContain("broadcaster");
  });

  it("returns null for non-PRIVMSG frames", () => {
    const frame = "@badge-info=;badges=;id=abc123 :user!user@user.tmi.twitch.tv JOIN #channel";
    expect(parseTwitchIRC(frame)).toBeNull();
  });

  it("returns null for frames without tags", () => {
    const frame = ":user!user@user.tmi.twitch.tv PRIVMSG #channel :Hello";
    expect(parseTwitchIRC(frame)).toBeNull();
  });

  it("handles messages with bits", () => {
    const frame =
      "@badge-info=;badges=subscriber/1;bits=100;color=;display-name=BitUser;emotes=;id=def456;mod=0;room-id=12345;subscriber=1;tmi-sent-ts=1700000000000;user-id=67890;user-type= :bituser!bituser@bituser.tmi.twitch.tv PRIVMSG #channel :cheer100";

    const result = parseTwitchIRC(frame);

    expect(result).not.toBeNull();
    expect(result!.bits).toBe(100);
    expect(result!.badges).toContain("subscriber");
  });
});

describe("toUnifiedChatMessage", () => {
  it("converts parsed IRC to UnifiedChatMessage", () => {
    const parsed = {
      id: "test123",
      username: "testuser",
      displayName: "TestUser",
      message: "Hello!",
      badges: ["subscriber"],
      emotes: ["emote1"],
      bits: 0,
    };

    const result = toUnifiedChatMessage(parsed, 1700000000000);

    expect(result.id).toBe("test123");
    expect(result.username).toBe("testuser");
    expect(result.displayName).toBe("TestUser");
    expect(result.message).toBe("Hello!");
    expect(result.badges).toEqual(["subscriber"]);
    expect(result.emotes).toEqual(["emote1"]);
    expect(result.bits).toBe(0);
    expect(result.platform).toBe("twitch");
    expect(result.timestamp).toBe(1700000000000);
  });
});
