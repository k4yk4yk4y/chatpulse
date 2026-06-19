import { describe, it, expect } from "vitest";
import { validateAndParseReport, extractJSON } from "../engine/reportParser";

describe("extractJSON", () => {
  it("extracts JSON from markdown code block", () => {
    const text = '```json\n{"key": "value"}\n```';
    const result = extractJSON(text);
    expect(result).toEqual({ key: "value" });
  });

  it("extracts JSON from plain text", () => {
    const text = 'Here is the report: {"key": "value"} done.';
    const result = extractJSON(text);
    expect(result).toEqual({ key: "value" });
  });

  it("returns null for invalid JSON", () => {
    const text = "No JSON here";
    expect(extractJSON(text)).toBeNull();
  });
});

describe("validateAndParseReport", () => {
  const validReport = {
    report_meta: {
      generated_at: "2024-01-01T00:00:00Z",
      messages_analyzed: 1000,
      messages_substantive: 50,
      dominant_language: "en",
      confidence_score: 85,
    },
    overall_sentiment: {
      score: 25,
      label: "Positive",
      summary: "The audience is generally positive.",
    },
    engagement_quality: {
      score: 72,
      active_chatters_ratio: 0.35,
      substantive_ratio: 0.12,
      top_contributors: [
        { username: "user1", message_count: 45, influence_score: 80 },
      ],
    },
    top_topics: [
      {
        rank: 1,
        topic_title: "Audio quality issues",
        category: "Complaint",
        frequency: 15,
        sentiment: "Negative",
        severity: "High",
        key_usernames: ["user1", "user2"],
        evidence_quotes: ["The audio is terrible today"],
        detailed_description: "Users are experiencing poor audio quality during the stream. This includes audio drops, crackling sounds, and desync issues that significantly impact the viewing experience.",
        related_topics: [],
        sample_messages: [
          { username: "user1", message: "Audio is bad", timestamp: "2024-01-01T00:00:00Z" },
        ],
      },
    ],
    brand_mentions: [],
    audience_segments: [],
    recommendations: [
      {
        priority: "High",
        audience: "Streamer",
        action: "Fix audio settings",
        expected_impact: "Improved viewer experience",
      },
    ],
  };

  it("validates a correct report", () => {
    const result = validateAndParseReport(validReport, 10);
    expect(result).not.toBeNull();
    expect(result!.reportMeta.messagesAnalyzed).toBe(1000);
    expect(result!.topTopics).toHaveLength(1);
    expect(result!.topTopics[0].topicTitle).toBe("Audio quality issues");
  });

  it("truncates topics to maxTopics", () => {
    const reportWith20Topics = {
      ...validReport,
      top_topics: Array.from({ length: 20 }, (_, i) => ({
        ...validReport.top_topics[0],
        rank: i + 1,
        topic_title: `Topic ${i + 1}`,
        frequency: 20 - i,
      })),
    } as typeof validReport;

    const result = validateAndParseReport(reportWith20Topics, 5);
    expect(result).not.toBeNull();
    expect(result!.topTopics).toHaveLength(5);
  });

  it("returns null for invalid report", () => {
    const invalid = { ...validReport, overall_sentiment: "invalid" };
    const result = validateAndParseReport(invalid, 10);
    expect(result).toBeNull();
  });

  it("returns null for missing required fields", () => {
    const incomplete = { report_meta: validReport.report_meta };
    const result = validateAndParseReport(incomplete, 10);
    expect(result).toBeNull();
  });
});
