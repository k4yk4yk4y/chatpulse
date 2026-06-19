import { z } from "zod";
import type { ChatPulseReport } from "../shared/types";

const coerceNum = z.union([z.number(), z.string()]).transform((v) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
});

const SampleMessageSchema = z.object({
  username: z.string(),
  message: z.string(),
  timestamp: z.string(),
});

const TopicSchema = z.object({
  rank: coerceNum,
  topic_title: z.string(),
  category: z.enum(["Complaint", "Question", "Suggestion", "Praise", "Bug Report", "Comparison", "Other"]),
  frequency: coerceNum,
  sentiment: z.enum(["Negative", "Neutral", "Positive"]),
  severity: z.enum(["Critical", "High", "Medium", "Low"]),
  key_usernames: z.array(z.string()),
  evidence_quotes: z.array(z.string()),
  detailed_description: z.string(),
  related_topics: z.array(z.string()).optional().default([]),
  sample_messages: z.array(SampleMessageSchema).optional().default([]),
});

const ReportSchema = z.object({
  report_meta: z.object({
    generated_at: z.string(),
    messages_analyzed: coerceNum,
    messages_substantive: coerceNum,
    dominant_language: z.string(),
    confidence_score: coerceNum,
  }),
  overall_sentiment: z.object({
    score: coerceNum,
    label: z.enum(["Very Negative", "Negative", "Neutral", "Positive", "Very Positive"]),
    summary: z.string(),
  }),
  engagement_quality: z.object({
    score: coerceNum,
    active_chatters_ratio: coerceNum,
    substantive_ratio: coerceNum,
    top_contributors: z.array(
      z.object({
        username: z.string(),
        message_count: coerceNum,
        influence_score: coerceNum,
      })
    ),
  }),
  top_topics: z.array(TopicSchema),
  brand_mentions: z.array(
    z.object({
      brand_name: z.string(),
      context: z.enum(["Positive", "Negative", "Neutral", "Question"]),
      mentions_count: coerceNum,
      key_usernames: z.array(z.string()),
      sample_quotes: z.array(z.string()),
    })
  ),
  audience_segments: z.array(
    z.object({
      segment_name: z.string(),
      estimated_size: z.enum(["Small", "Medium", "Large"]),
      characteristics: z.string(),
      key_usernames: z.array(z.string()),
    })
  ),
  recommendations: z.array(
    z.object({
      priority: z.enum(["Critical", "High", "Medium", "Low"]),
      audience: z.string(),
      action: z.string(),
      expected_impact: z.string(),
      related_topic_rank: coerceNum.optional().default(0),
    })
  ),
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
      label: raw.overall_sentiment.label,
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
        category: t.category,
        frequency: t.frequency,
        sentiment: t.sentiment,
        severity: t.severity,
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
      context: b.context,
      mentionsCount: b.mentions_count,
      keyUsernames: b.key_usernames,
      sampleQuotes: b.sample_quotes,
    })),
    audienceSegments: raw.audience_segments.map((s) => ({
      segmentName: s.segment_name,
      estimatedSize: s.estimated_size,
      characteristics: s.characteristics,
      keyUsernames: s.key_usernames,
    })),
    recommendations: raw.recommendations.map((r) => ({
      priority: r.priority,
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
  const result = ReportSchema.safeParse(raw);
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

export function extractJSON(text: string): unknown | null {
  console.log("[ChatPulse PARSER] extractJSON, input length:", text.length);
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1].trim());
      console.log("[ChatPulse PARSER] Extracted JSON from markdown code block");
      return parsed;
    } catch {
      console.warn("[ChatPulse PARSER] Failed to parse JSON from code block");
      return null;
    }
  }

  const firstBrace = text.indexOf("{");
  if (firstBrace === -1) {
    console.warn("[ChatPulse PARSER] No JSON found in response");
    return null;
  }

  let depth = 0;
  let inString = false;
  let escape = false;
  let endIdx = -1;

  for (let i = firstBrace; i < text.length; i++) {
    const ch = text[i];
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

  try {
    const parsed = JSON.parse(text.slice(firstBrace, endIdx + 1));
    console.log("[ChatPulse PARSER] Extracted JSON via brace balancing");
    return parsed;
  } catch {
    console.warn("[ChatPulse PARSER] Failed to parse balanced JSON");
    return null;
  }
}
