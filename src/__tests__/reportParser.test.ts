import { describe, it, expect } from "vitest";
import { validateAndParseReport, extractJSON } from "../engine/reportParser";
// Note: normalizeKeys is internal but we test it via validateAndParseReport

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

  it("extracts JSON from plain code block without language specifier", () => {
    const text = '```\n{"key": "value"}\n```';
    const result = extractJSON(text);
    expect(result).toEqual({ key: "value" });
  });

  it("strips think blocks", () => {
    const text = '<think>Some reasoning here</think> {"key": "value"}';
    const result = extractJSON(text);
    expect(result).toEqual({ key: "value" });
  });

  it("handles deeply nested JSON object", () => {
    const text = '{"top_topics": [{"topic_title": "Test", "category": "Other", "frequency": 1, "sentiment": "Neutral", "severity": "Low", "key_usernames": [], "evidence_quotes": [], "detailed_description": "", "related_topics": [], "sample_messages": []}]}';
    const result = extractJSON(text);
    expect(result).toHaveProperty("top_topics");
    expect((result as Record<string, unknown>).top_topics).toHaveLength(1);
  });

  it("handles malformed JSON with trailing commas", () => {
    const text = '{"key": "value", "nested": {"arr": [1, 2, 3,]},}';
    const result = extractJSON(text);
    expect(result).toEqual({ key: "value", nested: { arr: [1, 2, 3] } });
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

  it("validates report with numeric strings (coercion)", () => {
    const reportWithStringNums = {
      ...validReport,
      report_meta: {
        ...validReport.report_meta,
        messages_analyzed: "1000",
        confidence_score: "85",
      },
      overall_sentiment: {
        ...validReport.overall_sentiment,
        score: "25",
      },
    };
    const result = validateAndParseReport(reportWithStringNums, 10);
    expect(result).not.toBeNull();
    expect(result!.reportMeta.messagesAnalyzed).toBe(1000);
    expect(result!.overallSentiment.score).toBe(25);
  });

  it("normalizes case-insensitive enum values", () => {
    const reportWithLowercaseEnums = {
      ...validReport,
      overall_sentiment: {
        score: 25,
        label: "positive", // lowercase
        summary: "The audience is generally positive.",
      },
      top_topics: [
        {
          ...validReport.top_topics[0],
          category: "complaint", // lowercase
          sentiment: "negative", // lowercase
          severity: "high", // lowercase
        },
      ],
    };
    const result = validateAndParseReport(reportWithLowercaseEnums, 10);
    expect(result).not.toBeNull();
    expect(result!.overallSentiment.label).toBe("Positive");
    expect(result!.topTopics[0].category).toBe("Complaint");
    expect(result!.topTopics[0].sentiment).toBe("Negative");
    expect(result!.topTopics[0].severity).toBe("High");
  });

  it("handles empty top_topics array gracefully", () => {
    const reportWithEmptyTopics = {
      ...validReport,
      top_topics: [],
    };
    const result = validateAndParseReport(reportWithEmptyTopics, 10);
    expect(result).not.toBeNull();
    expect(result!.topTopics).toHaveLength(0);
  });

  it("handles null/undefined gracefully in arrays", () => {
    const reportWithNulls = {
      ...validReport,
      top_topics: null as unknown,
      brand_mentions: undefined as unknown,
    };
    const result = validateAndParseReport(reportWithNulls, 10);
    expect(result).not.toBeNull();
    expect(result!.topTopics).toHaveLength(0);
    expect(result!.brandMentions).toHaveLength(0);
  });

  it("uses defaults for missing nested fields", () => {
    const reportWithMissingNested = {
      report_meta: {}, // all missing
      overall_sentiment: {}, // all missing
      engagement_quality: {}, // all missing
      top_topics: [
        {
          // All top-level fields missing, but valid TopicSchema structure
        },
      ],
      brand_mentions: [],
      audience_segments: [],
      recommendations: [],
    };
    const result = validateAndParseReport(reportWithMissingNested, 10);
    expect(result).not.toBeNull();
    expect(result!.reportMeta.messagesAnalyzed).toBe(0);
    expect(result!.overallSentiment.label).toBe("Neutral");
    expect(result!.topTopics[0].topicTitle).toBe("Untitled topic");
  });

  it("handles camelCase keys from LLM output", () => {
    const camelCaseReport = {
      reportMeta: {
        generatedAt: "2024-01-01T00:00:00Z",
        messagesAnalyzed: 1000,
        messagesSubstantive: 50,
        dominantLanguage: "en",
        confidenceScore: 85,
      },
      overallSentiment: {
        score: 25,
        label: "Positive",
        summary: "The audience is generally positive.",
      },
      engagementQuality: {
        score: 72,
        activeChattersRatio: 0.35,
        substantiveRatio: 0.12,
        topContributors: [
          { username: "user1", messageCount: 45, influenceScore: 80 },
        ],
      },
      topTopics: [
        {
          rank: 1,
          topicTitle: "Audio quality issues",
          category: "Complaint",
          frequency: 15,
          totalUniqueUsers: 8,
          sentiment: "Negative",
          severity: "High",
          keyUsernames: ["user1", "user2"],
          evidenceQuotes: ["The audio is terrible today"],
          detailedDescription: "Users are experiencing poor audio quality.",
          relatedTopics: [],
          sampleMessages: [
            { username: "user1", message: "Audio is bad", timestamp: "2024-01-01T00:00:00Z" },
          ],
        },
      ],
      brandMentions: [],
      audienceSegments: [],
      recommendations: [],
    };
    const result = validateAndParseReport(camelCaseReport, 10);
    expect(result).not.toBeNull();
    expect(result!.reportMeta.messagesAnalyzed).toBe(1000);
    expect(result!.topTopics[0].topicTitle).toBe("Audio quality issues");
  });
});
