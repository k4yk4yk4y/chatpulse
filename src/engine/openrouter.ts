import { MODELS, CONTEXT_WINDOWS, RETRY_DELAYS_MS, OPENROUTER_API_URL } from "../shared/constants";
import { buildSystemPrompt, buildUserPrompt, estimateTokens } from "./promptBuilder";
import { validateAndParseReport, extractJSON } from "./reportParser";
import type { StreamMetadata, ChatPulseReport } from "../shared/types";
import type { UnifiedChatMessage } from "../shared/types";

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  error?: {
    message: string;
    code: number;
  };
}

async function callOpenRouter(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string | null> {
  try {
    console.log("[ChatPulse ENGINE] Calling OpenRouter with model:", model);
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/chatpulse",
        "X-Title": "ChatPulse",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const body = await response.text();
      console.warn("[ChatPulse ENGINE] OpenRouter HTTP", status, response.statusText, "for model:", model, "body:", body.substring(0, 500));
      if (status === 429 || status >= 500) {
        return null;
      }
      throw new Error(`OpenRouter API error: ${status} ${response.statusText}`);
    }

    const data: OpenRouterResponse = await response.json();

    if (data.error) {
      console.warn("[ChatPulse ENGINE] OpenRouter returned error:", data.error, "for model:", model);
      return null;
    }

    const content = data.choices?.[0]?.message?.content || null;
    console.log("[ChatPulse ENGINE] OpenRouter response from", model, ":", content ? `length: ${content.length}` : "empty");
    if (!content) {
      console.warn("[ChatPulse ENGINE] Empty content from model:", model, "response keys:", Object.keys(data));
    }
    return content;
  } catch (error) {
    console.error(`[ChatPulse ENGINE] OpenRouter call failed for model ${model}:`, error);
    return null;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildMessageBlock(messages: UnifiedChatMessage[]): string {
  return messages
    .map((m) => {
      const badges = m.badges.length > 0 ? `[${m.badges.join(",")}]` : "";
      const bits = m.bits > 0 ? ` [bits:${m.bits}]` : "";
      const time = new Date(m.timestamp).toISOString();
      return `${time} ${m.username}${badges}${bits}: ${m.message}`;
    })
    .join("\n");
}

export async function analyzeChat(
  apiKey: string,
  metadata: StreamMetadata,
  messages: UnifiedChatMessage[],
  reportLanguage: string,
  maxTopics: number,
  topic?: string
): Promise<{ report: ChatPulseReport | null; error?: string }> {
  console.log("[ChatPulse ENGINE] analyzeChat called, messages:", messages.length, "language:", reportLanguage, "maxTopics:", maxTopics, "topic:", topic || "(none)");

  if (!apiKey) {
    console.warn("[ChatPulse ENGINE] No API key configured");
    return { report: null, error: "OpenRouter API key not configured. Go to Settings to add your key." };
  }

  if (messages.length === 0) {
    console.warn("[ChatPulse ENGINE] No messages to analyze");
    return { report: null, error: "No messages collected. Make sure the stream chat is active." };
  }

  const models = [MODELS.DEFAULT, MODELS.FALLBACK];
  console.log("[ChatPulse ENGINE] Models to try:", models);

  for (const model of models) {
    const contextWindow = CONTEXT_WINDOWS[model] || 131_072;
    const systemPrompt = buildSystemPrompt(reportLanguage, false, topic);
    const systemTokens = estimateTokens(systemPrompt);
    console.log("[ChatPulse ENGINE] Trying model:", model, "contextWindow:", contextWindow, "systemTokens:", systemTokens);

    let messageBlock = buildMessageBlock(messages);
    let truncated = false;
    let includedMessages = messages.length;

    const availableTokens = contextWindow - systemTokens - 6000;
    const estimatedMessageTokens = estimateTokens(messageBlock);

    if (estimatedMessageTokens > availableTokens) {
      const ratio = availableTokens / estimatedMessageTokens;
      includedMessages = Math.floor(messages.length * ratio);
      const sliced = messages.slice(-includedMessages);
      messageBlock = buildMessageBlock(sliced);
      truncated = true;
      console.log("[ChatPulse ENGINE] Truncated messages to", includedMessages, "to fit context window");
    }

    const userPrompt = buildUserPrompt(
      metadata,
      messageBlock,
      reportLanguage,
      maxTopics,
      messages.length,
      messages.length,
      truncated,
      includedMessages,
      topic
    );

    console.log("[ChatPulse ENGINE] Calling OpenRouter...");
    let response = await callOpenRouter(apiKey, model, systemPrompt, userPrompt);

    if (response) {
      console.log("[ChatPulse ENGINE] Response received, length:", response.length, "first 200 chars:", response.substring(0, 200));
      const parsed = extractJSON(response);
      console.log("[ChatPulse ENGINE] JSON extraction:", parsed ? "success" : "failed");
      if (parsed) {
        const report = validateAndParseReport(parsed, maxTopics);
        if (report) {
          console.log("[ChatPulse ENGINE] Report validation passed");
          return { report };
        }
        console.warn("[ChatPulse ENGINE] Report validation failed for", model);
      }

      console.warn(`[ChatPulse ENGINE] First attempt for ${model} returned invalid JSON, retrying with few-shot...`);

      const retrySystemPrompt = buildSystemPrompt(reportLanguage, true, topic);
      response = await callOpenRouter(apiKey, model, retrySystemPrompt, userPrompt);

      if (response) {
        console.log("[ChatPulse ENGINE] Retry response received, length:", response.length);
        const parsed = extractJSON(response);
        if (parsed) {
          const report = validateAndParseReport(parsed, maxTopics);
          if (report) {
            console.log("[ChatPulse ENGINE] Retry succeeded for", model);
            return { report };
          }
        }
        console.warn("[ChatPulse ENGINE] Retry also failed for", model);
      } else {
        console.warn("[ChatPulse ENGINE] Retry returned null for", model);
      }
    } else {
      console.warn("[ChatPulse ENGINE] First call returned null for", model);
    }

    const delayIndex = models.indexOf(model);
    if (delayIndex < models.length - 1) {
      const delay = RETRY_DELAYS_MS[delayIndex] || 2000;
      console.log("[ChatPulse ENGINE] Waiting", delay, "ms before trying fallback model");
      await sleep(delay);
    }
  }

  console.error("[ChatPulse ENGINE] All models exhausted");
  return {
    report: null,
    error: "Both free AI models are temporarily unavailable. Try again in a minute, or export your raw chat data.",
  };
}
