import { z } from "zod";
import type { ChatPulseReport } from "../shared/types";

const coerceNum = z.union([z.number(), z.string()]).transform((v) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
});

const clampNum = (min: number, max: number) =>
  z.union([z.number(), z.string()]).transform((v) => {
    const n = typeof v === "string" ? parseFloat(v) : v;
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min;
  });

const lenientEnum = <T extends readonly string[]>(values: T) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => {
      const s = String(v).trim();
      const lower = s.toLowerCase();
      for (const valid of values) {
        if (valid.toLowerCase() === lower) return valid;
      }
      if (lower === "bug") return "Bug Report" as T[number];
      if (lower === "very negative") return "Very Negative" as T[number];
      if (lower === "very positive") return "Very Positive" as T[number];
      return values[0];
    });

const CATEGORIES = ["Complaint", "Question", "Suggestion", "Praise", "Bug Report", "Comparison", "Other"] as const;
const SENTIMENTS = ["Negative", "Neutral", "Positive"] as const;
const SEVERITIES = ["Critical", "High", "Medium", "Low"] as const;
const OVERALL_SENTIMENTS = ["Very Negative", "Negative", "Neutral", "Positive", "Very Positive"] as const;
const BRAND_CONTEXTS = ["Positive", "Negative", "Neutral", "Question"] as const;
const SEGMENT_SIZES = ["Small", "Medium", "Large"] as const;

const TopicSchema = z.object({
  rank: coerceNum.default(0),
  topic_title: z.string().default("Untitled topic"),
  category: lenientEnum(CATEGORIES).default("Other"),
  frequency: coerceNum.default(1),
  total_unique_users: coerceNum.default(0),
  sentiment: lenientEnum(SENTIMENTS).default("Neutral"),
  severity: lenientEnum(SEVERITIES).default("Medium"),
  key_usernames: z.array(z.string()).default([]),
  evidence_quotes: z.array(z.string()).default([]),
  detailed_description: z.string().default(""),
  related_topics: z.array(z.string()).default([]),
  sample_messages: z
    .array(
      z.object({
        username: z.string().default("unknown"),
        message: z.string().default(""),
        timestamp: z.string().default(() => new Date().toISOString()),
      })
    )
    .default([]),
});

const ReportSchema = z.object({
  report_meta: z.object({
    generated_at: z.string().default(() => new Date().toISOString()),
    messages_analyzed: coerceNum.default(0),
    messages_substantive: coerceNum.default(0),
    dominant_language: z.string().default("en"),
    confidence_score: clampNum(0, 100).default(50),
  }),
  overall_sentiment: z.object({
    score: clampNum(-100, 100).default(0),
    label: lenientEnum(OVERALL_SENTIMENTS).default("Neutral"),
    summary: z.string().default("No summary available."),
  }),
  engagement_quality: z.object({
    score: clampNum(0, 100).default(50),
    active_chatters_ratio: clampNum(0, 1).default(0.5),
    substantive_ratio: clampNum(0, 1).default(0.5),
    top_contributors: z
      .array(
        z.object({
          username: z.string().default("unknown"),
          message_count: coerceNum.default(0),
          influence_score: clampNum(0, 100).default(50),
        })
      )
      .default([]),
  }),
  top_topics: z.array(TopicSchema).default([]),
  brand_mentions: z
    .array(
      z.object({
        brand_name: z.string().default("Unknown"),
        context: lenientEnum(BRAND_CONTEXTS).default("Neutral"),
        mentions_count: coerceNum.default(0),
        key_usernames: z.array(z.string()).default([]),
        sample_quotes: z.array(z.string()).default([]),
      })
    )
    .default([]),
  audience_segments: z
    .array(
      z.object({
        segment_name: z.string().default("General audience"),
        estimated_size: lenientEnum(SEGMENT_SIZES).default("Medium"),
        characteristics: z.string().default(""),
        key_usernames: z.array(z.string()).default([]),
      })
    )
    .default([]),
  recommendations: z
    .array(
      z.object({
        priority: lenientEnum(SEVERITIES).default("Medium"),
        audience: z.string().default("General"),
        action: z.string().default(""),
        expected_impact: z.string().default(""),
        related_topic_rank: coerceNum.default(0),
      })
    )
    .default([]),
});

export type RawReport = z.infer<typeof ReportSchema>;

function toCamelCase(raw: RawReport): ChatPulseReport {
  return {
    reportMeta: {
      generatedAt: raw.report_meta.generated_at,
      messagesAnalyzed: raw.report_meta.messages_analyzed,
      messagesSubstantive: raw.report_meta.messages_substantive,
      dominantLanguage: raw.report_meta.dominant_language,
      confidenceScore: raw.report_meta.confidence_score,
    },
    overallSentiment: {
      score: raw.overall_sentiment.score,
      label: raw.overall_sentiment.label as ChatPulseReport["overallSentiment"]["label"],
      summary: raw.overall_sentiment.summary,
    },
    engagementQuality: {
      score: raw.engagement_quality.score,
      activeChattersRatio: raw.engagement_quality.active_chatters_ratio,
      substantiveRatio: raw.engagement_quality.substantive_ratio,
      topContributors: raw.engagement_quality.top_contributors.map((c) => ({
        username: c.username,
        messageCount: c.message_count,
        influenceScore: c.influence_score,
      })),
    },
    topTopics: raw.top_topics
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 20)
      .map((t, i) => ({
        rank: i + 1,
        topicTitle: t.topic_title,
        category: t.category as ChatPulseReport["topTopics"][number]["category"],
        frequency: t.frequency,
        sentiment: t.sentiment as ChatPulseReport["topTopics"][number]["sentiment"],
        severity: t.severity as ChatPulseReport["topTopics"][number]["severity"],
        totalUniqueUsers: t.total_unique_users,
        keyUsernames: t.key_usernames,
        evidenceQuotes: t.evidence_quotes,
        detailedDescription: t.detailed_description,
        relatedTopics: t.related_topics,
        sampleMessages: t.sample_messages
          .sort((a, b) => b.message.length - a.message.length)
          .slice(0, 5)
          .map((m) => ({
            username: m.username,
            message: m.message,
            timestamp: m.timestamp,
          })),
      })),
    brandMentions: raw.brand_mentions.map((b) => ({
      brandName: b.brand_name,
      context: b.context as ChatPulseReport["brandMentions"][number]["context"],
      mentionsCount: b.mentions_count,
      keyUsernames: b.key_usernames,
      sampleQuotes: b.sample_quotes,
    })),
    audienceSegments: raw.audience_segments.map((s) => ({
      segmentName: s.segment_name,
      estimatedSize: s.estimated_size as ChatPulseReport["audienceSegments"][number]["estimatedSize"],
      characteristics: s.characteristics,
      keyUsernames: s.key_usernames,
    })),
    recommendations: raw.recommendations.map((r) => ({
      priority: r.priority as ChatPulseReport["recommendations"][number]["priority"],
      audience: r.audience,
      action: r.action,
      expectedImpact: r.expected_impact,
      relatedTopicRank: r.related_topic_rank,
    })),
  };
}

export function validateAndParseReport(
  raw: unknown,
  maxTopics: number
): ChatPulseReport | null {
  console.log("[ChatPulse PARSER] Validating report, maxTopics:", maxTopics);

  // Normalize snake_case keys to camelCase for LLM flexibility
  const normalized = normalizeKeys(raw);
  console.log("[ChatPulse PARSER] Normalized keys for validation");

  const result = ReportSchema.safeParse(normalized);
  if (!result.success) {
    for (const issue of result.error.issues) {
      console.warn("[ChatPulse PARSER] Validation issue:", issue.path.join("."), issue.message);
    }
    return null;
  }

  const report = toCamelCase(result.data);
  report.topTopics = report.topTopics.slice(0, maxTopics);
  console.log("[ChatPulse PARSER] Report valid, topics:", report.topTopics.length, "sentiment:", report.overallSentiment.label);
  return report;
}

/**
 * Recursively normalize object keys: handle both snake_case and camelCase
 * Maps LLM outputs to expected schema format
 */
function normalizeKeys(obj: unknown): unknown {
  if (obj === null || obj === undefined) return undefined;
  if (Array.isArray(obj)) return obj.map(normalizeKeys);
  if (typeof obj !== "object") return obj;

  const result: Record<string, unknown> = {};
  // Map camelCase to snake_case for schema compatibility, and keep snake_case as-is
  const keyMap: Record<string, string> = {
    // Top-level mappings (camelCase -> snake_case)
    reportMeta: "report_meta",
    overallSentiment: "overall_sentiment",
    engagementQuality: "engagement_quality",
    topTopics: "top_topics",
    brandMentions: "brand_mentions",
    audienceSegments: "audience_segments",
    // Nested mappings (camelCase -> snake_case)
    generatedAt: "generated_at",
    messagesAnalyzed: "messages_analyzed",
    messagesSubstantive: "messages_substantive",
    dominantLanguage: "dominant_language",
    confidenceScore: "confidence_score",
    activeChattersRatio: "active_chatters_ratio",
    substantiveRatio: "substantive_ratio",
    topContributors: "top_contributors",
    messageCount: "message_count",
    influenceScore: "influence_score",
    topicTitle: "topic_title",
    totalUniqueUsers: "total_unique_users",
    keyUsernames: "key_usernames",
    evidenceQuotes: "evidence_quotes",
    detailedDescription: "detailed_description",
    relatedTopics: "related_topics",
    sampleMessages: "sample_messages",
    brandName: "brand_name",
    mentionsCount: "mentions_count",
    sampleQuotes: "sample_quotes",
    segmentName: "segment_name",
    estimatedSize: "estimated_size",
    expectedImpact: "expected_impact",
    relatedTopicRank: "related_topic_rank",
  };

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    // Convert camelCase to snake_case, or keep original key if already snake_case
    const normalizedKey = keyMap[key] || key;
    result[normalizedKey] = normalizeKeys(value);
  }
  return result;
}

export function extractJSON(text: string): unknown | null {
  console.log("[ChatPulse PARSER] extractJSON, input length:", text.length);

  let cleanText = text;

  // Handle <think> blocks (some models use this format)
  const thinkMatch = cleanText.match(/<think[\s\S]*?<\/think>/);
  if (thinkMatch) {
    cleanText = cleanText.slice(thinkMatch.index! + thinkMatch[0].length).trim();
    console.log("[ChatPulse PARSER] Stripped <think> block");
  }

  // Also try <ltag> variant
  const ltagMatch = cleanText.match(/<ltag[\s\S]*?<\/ltag>/);
  if (ltagMatch) {
    cleanText = cleanText.slice(ltagMatch.index! + ltagMatch[0].length).trim();
    console.log("[ChatPulse PARSER] Stripped <ltag> block");
  }

  // Try markdown code block first
  const jsonMatch = cleanText.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1].trim());
      console.log("[ChatPulse PARSER] Extracted JSON from markdown code block");
      return parsed;
    } catch (e) {
      console.warn("[ChatPulse PARSER] Failed to parse JSON from code block:", e);
    }
  }

  // Also try plain code block without language specifier
  const plainCodeMatch = cleanText.match(/```\s*(\{[\s\S]*?\})\s*```/);
  if (plainCodeMatch) {
    try {
      const parsed = JSON.parse(plainCodeMatch[1].trim());
      console.log("[ChatPulse PARSER] Extracted JSON from plain code block");
      return parsed;
    } catch (e) {
      console.warn("[ChatPulse PARSER] Failed to parse JSON from plain code block:", e);
    }
  }

  // Find first JSON object
  const firstBrace = cleanText.indexOf("{");
  if (firstBrace === -1) {
    console.warn("[ChatPulse PARSER] No JSON found in response");
    return null;
  }

  let depth = 0;
  let inString = false;
  let escape = false;
  let endIdx = -1;

  for (let i = firstBrace; i < cleanText.length; i++) {
    const ch = cleanText[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        endIdx = i;
        break;
      }
    }
  }

  if (endIdx === -1) {
    console.warn("[ChatPulse PARSER] Unbalanced braces in response");
    return null;
  }

  let jsonStr = cleanText.slice(firstBrace, endIdx + 1);

  // Fix trailing commas
  jsonStr = jsonStr.replace(/,\s*([\]}])/g, "$1");

  // Remove control characters except newlines/tabs
  jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, (ch) => {
    if (ch === "\n" || ch === "\r" || ch === "\t") return ch;
    return "";
  });

  // Try to parse
  try {
    const parsed = JSON.parse(jsonStr);
    console.log("[ChatPulse PARSER] Extracted JSON via brace balancing");
    return parsed;
  } catch (e) {
    console.warn("[ChatPulse PARSER] Failed to parse balanced JSON:", e, "jsonStr preview:", jsonStr.substring(0, 200));
    return null;
  }
}
