import { describe, it, expect } from "vitest";
import { buildSystemPrompt, buildUserPrompt, estimateTokens } from "../engine/promptBuilder";

describe("buildSystemPrompt", () => {
  it("includes language instruction for auto-detect", () => {
    const prompt = buildSystemPrompt("auto-detect", false);
    expect(prompt).toContain("Detect the DOMINANT LANGUAGE");
    expect(prompt).not.toContain("few-shot");
  });

  it("includes specific language instruction", () => {
    const prompt = buildSystemPrompt("ru", false);
    expect(prompt).toContain("Respond ENTIRELY in ru");
  });

  it("includes few-shot examples when requested", () => {
    const prompt = buildSystemPrompt("en", true);
    expect(prompt).toContain("FULL OUTPUT EXAMPLE");
    expect(prompt).toContain("ENUM VALUES");
  });

  it("excludes few-shot examples by default", () => {
    const prompt = buildSystemPrompt("en", false);
    expect(prompt).not.toContain("FULL OUTPUT EXAMPLE");
    expect(prompt).not.toContain("ENUM VALUES");
  });

  it("includes JSON output schema", () => {
    const prompt = buildSystemPrompt("en", false);
    expect(prompt).toContain("report_meta");
    expect(prompt).toContain("overall_sentiment");
    expect(prompt).toContain("top_topics");
    expect(prompt).toContain("recommendations");
  });
});

describe("buildUserPrompt", () => {
  const metadata = {
    title: "Test Stream",
    category: "Just Chatting",
    platform: "twitch" as const,
    viewerCountApprox: 5000,
    durationMonitored: 30,
  };

  it("builds a complete user prompt", () => {
    const prompt = buildUserPrompt(
      metadata,
      "user1: Hello\nuser2: World",
      "en",
      10,
      1000,
      500,
      false,
      1000
    );

    expect(prompt).toContain("Test Stream");
    expect(prompt).toContain("Just Chatting");
    expect(prompt).toContain("5000");
    expect(prompt).toContain("30 minutes");
    expect(prompt).toContain("en");
    expect(prompt).toContain("10");
    expect(prompt).toContain("user1: Hello");
  });

  it("includes truncation notice when truncated", () => {
    const prompt = buildUserPrompt(
      metadata,
      "messages...",
      "en",
      10,
      50000,
      10000,
      true,
      5000
    );

    expect(prompt).toContain("Messages truncated to last 5000");
    expect(prompt).toContain("Temporal distribution preserved");
  });
});

describe("estimateTokens", () => {
  it("estimates token count from text length", () => {
    expect(estimateTokens("hello")).toBe(2);
    expect(estimateTokens("hello world")).toBe(3);
    expect(estimateTokens("a".repeat(100))).toBe(25);
  });
});
