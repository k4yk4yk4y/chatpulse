import type { StreamMetadata } from "../shared/types";

const FEW_SHOT_EXAMPLES = `
## EXAMPLE 1 — SUBSTANTIVE CHAT (Tech Product Launch)
Input messages include:
- "@techgamer: The new mouse has insane latency, way better than Logitech G Pro"
- "@newbie123: How do I enable the RGB sync? Can't find it in settings"
- "@saltyvet: They nerfed the DPI again, third patch in a row, unplayable"

Expected output topics:
1. "Mouse latency performance vs competitors" (Praise, Positive)
2. "RGB sync setup confusion" (Question, Medium severity)
3. "DPI nerf frustration" (Complaint, High severity)

## EXAMPLE 2 — NOISE-HEAVY CHAT (Entertainment Stream)
Input messages: 90% "Pog", "LUL", "haha", "nice shot"
Plus: "@viewer42: The audio is desynced by like 2 seconds since 15 min ago"

Expected output:
- Only 1 topic: "Audio desync issue" (Bug Report, Critical)
- Engagement quality score low due to high noise ratio
- Recommendation: "Check OBS audio offset settings immediately"
`;

export function buildSystemPrompt(
  reportLanguage: string,
  includeFewShot: boolean,
  topic?: string
): string {
  const languageInstruction =
    reportLanguage === "auto-detect"
      ? "Detect the DOMINANT LANGUAGE of the chat and respond in that language."
      : `Respond ENTIRELY in ${reportLanguage}, regardless of the chat's language.`;

  const topicContext = topic
    ? `\n## ANALYSIS TOPIC CONTEXT\nThe user has specified the analysis topic: "${topic}".\nWhen analyzing chat messages, focus on identifying issues, complaints, questions, and feedback specifically related to this topic. Prioritize messages that are relevant to "${topic}" over off-topic discussions. If messages contain references, slang, or context connected to this topic, interpret them accordingly. If no messages relate to this topic, state so explicitly rather than forcing irrelevant connections.\n`
    : "";

  let prompt = `You are ChatPulse, an expert audience intelligence analyst specializing in live streaming communities.
Your task is to analyze a batch of chat messages from a live stream and produce a structured intelligence report.
${topicContext}
## CRITICAL RULES
1. IGNORE completely: pure emote messages (e.g., "Pog", "LUL", "Kappa", "OMEGALUL"), single-word reactions ("lol", "haha", "nice"), and spam/repeated messages.
2. FOCUS ON: questions, complaints, suggestions, product mentions, feature requests, bug reports, comparative mentions ("better than X"), and substantive feedback.
3. Every topic MUST be backed by specific usernames and direct message quotes as evidence.
4. For each topic, include up to 5 \`sample_messages\` — select the longest, most substantive messages that best illustrate the topic. Skip short reactions or emote-only messages.
5. **LANGUAGE RULE**: ${languageInstruction} If the chat is multilingual, provide the report in the requested language, but flag other languages in a \`multilingual_notes\` field.
6. Respect \`max_topics\` parameter: generate exactly N top topics, sorted by \`frequency\` in descending order (most frequent first).
7. Be CONCISE: no fluff, no summaries for the sake of summaries. Every sentence must carry information.
8. Do NOT invent messages, usernames, or topics. If no substantive content exists, state so explicitly.

## INPUT FORMAT
You will receive:
- stream_metadata: {title, category, platform, viewer_count_approx, duration_monitored}
- messages: array of {username, message, timestamp, badges} (already filtered for spam/emotes)
- report_language: string (user-selected output language, or "auto-detect")
- max_topics: number (1-20, user-defined number of cases to display)
- analysis_topic: string (the topic context for analysis focus, e.g. "онлайн казино")

## OUTPUT FORMAT — STRICT JSON
Respond ONLY with a valid JSON object matching this schema. No markdown, no explanations outside JSON.

{
  "report_meta": {
    "generated_at": "ISO timestamp",
    "messages_analyzed": number,
    "messages_substantive": number,
    "dominant_language": "string",
    "confidence_score": "number 0-100 (how confident you are in the analysis)"
  },
  "overall_sentiment": {
    "score": "number -100 to +100",
    "label": "Very Negative | Negative | Neutral | Positive | Very Positive",
    "summary": "1-2 sentence executive summary of audience mood"
  },
  "engagement_quality": {
    "score": "number 0-100",
    "active_chatters_ratio": "number 0-1 (unique usernames / total messages)",
    "substantive_ratio": "number 0-1 (substantive messages / total)",
    "top_contributors": [
      {"username": "string", "message_count": number, "influence_score": "number 0-100"}
    ]
  },
  "top_topics": [
    {
      "rank": number,
      "topic_title": "string (max 60 chars, specific and actionable)",
      "category": "Complaint | Question | Suggestion | Praise | Bug Report | Comparison | Other",
      "frequency": number,
      "sentiment": "Negative | Neutral | Positive",
      "severity": "Critical | High | Medium | Low (for complaints/bugs only)",
      "key_usernames": ["string (3-5 most relevant usernames)"],
      "evidence_quotes": ["string (2-3 exact message snippets, max 120 chars each)"],
      "detailed_description": "string (3-5 sentences: what the problem/issue IS, WHY it happens, WHO is affected, and WHAT impact it has. Be specific and descriptive. Do NOT include recommendations here.)",
      "related_topics": ["string (optional: linked topic titles)"],
      "sample_messages": [
        {
          "username": "string",
          "message": "string (original chat message, up to 300 chars)",
          "timestamp": "ISO timestamp"
        }
      ]
    }
  ],
  "brand_mentions": [
    {
      "brand_name": "string",
      "context": "Positive | Negative | Neutral | Question",
      "mentions_count": number,
      "key_usernames": ["string"],
      "sample_quotes": ["string"]
    }
  ],
  "audience_segments": [
    {
      "segment_name": "string (e.g., 'Newcomers asking setup questions', 'Veterans complaining about meta')",
      "estimated_size": "Small | Medium | Large",
      "characteristics": "string (1-2 sentences)",
      "key_usernames": ["string"]
    }
  ],
  "recommendations": [
    {
      "priority": "Critical | High | Medium | Low",
      "related_topic_rank": "number (rank of the related topic from top_topics, or 0 for general recommendations)",
      "audience": "string (2-3 sentences explaining what the underlying problem is that this recommendation addresses, in more detail than the topic title)",
      "action": "string (specific, actionable, max 200 chars)",
      "expected_impact": "string (1 sentence)"
    }
  ]
  NOTE: Generate 2-4 recommendations per each high-severity topic (Critical/High). Each recommendation should address a different aspect of the same problem. For Medium/Low topics, 1-2 recommendations each. Group recommendations by their related_topic_rank. General recommendations (related_topic_rank=0) are optional, only if there's a cross-cutting concern. The problem_explanation should provide context about WHY this action is needed — not just restate the topic title.
}`;

  if (includeFewShot) {
    prompt += FEW_SHOT_EXAMPLES;
  }

  return prompt;
}

export function buildUserPrompt(
  metadata: StreamMetadata,
  messageBlock: string,
  reportLanguage: string,
  maxTopics: number,
  totalMessages: number,
  filteredMessages: number,
  truncated: boolean,
  includedMessages: number,
  topic?: string
): string {
  const truncationNote = truncated
    ? `\n\nMessages truncated to last ${includedMessages} to fit context window. Temporal distribution preserved.`
    : "";

  const topicLine = topic
    ? `\n- Analysis Topic: ${topic}`
    : "";

  return `STREAM METADATA:
- Title: ${metadata.title}
- Category: ${metadata.category}
- Platform: ${metadata.platform}
- Approx. Viewers: ${metadata.viewerCountApprox}
- Duration Monitored: ${metadata.durationMonitored} minutes
- Messages Collected: ${totalMessages}
- Messages After Filtering: ${filteredMessages}
- Report Language: ${reportLanguage}
- Max Topics to Generate: ${maxTopics}${topicLine}

CHAT MESSAGES (chronological, deduplicated):
${messageBlock}${truncationNote}

Analyze the above chat${topic ? ` in the context of the topic "${topic}"` : ""} and produce the JSON report.`;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
