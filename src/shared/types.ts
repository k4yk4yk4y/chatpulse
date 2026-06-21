export interface UnifiedChatMessage {
  id: string;
  username: string;
  displayName: string;
  message: string;
  timestamp: number;
  badges: string[];
  emotes: string[];
  bits: number;
  platform: "twitch" | "kick";
}

export interface StreamMetadata {
  title: string;
  category: string;
  platform: "twitch" | "kick";
  viewerCountApprox: number;
  durationMonitored: number;
}

export interface ChatPulseReport {
  reportMeta: {
    generatedAt: string;
    messagesAnalyzed: number;
    messagesSubstantive: number;
    dominantLanguage: string;
    confidenceScore: number;
  };
  overallSentiment: {
    score: number;
    label: "Very Negative" | "Negative" | "Neutral" | "Positive" | "Very Positive";
    summary: string;
  };
  engagementQuality: {
    score: number;
    activeChattersRatio: number;
    substantiveRatio: number;
    topContributors: Array<{
      username: string;
      messageCount: number;
      influenceScore: number;
    }>;
  };
  topTopics: Array<{
    rank: number;
    topicTitle: string;
    category: "Complaint" | "Question" | "Suggestion" | "Praise" | "Bug Report" | "Comparison" | "Other";
    frequency: number;
    sentiment: "Negative" | "Neutral" | "Positive";
    severity: "Critical" | "High" | "Medium" | "Low";
    totalUniqueUsers: number;
    keyUsernames: string[];
    evidenceQuotes: string[];
    detailedDescription: string;
    relatedTopics: string[];
    sampleMessages: Array<{
      username: string;
      message: string;
      timestamp: string;
    }>;
  }>;
  brandMentions: Array<{
    brandName: string;
    context: "Positive" | "Negative" | "Neutral" | "Question";
    mentionsCount: number;
    keyUsernames: string[];
    sampleQuotes: string[];
  }>;
  audienceSegments: Array<{
    segmentName: string;
    estimatedSize: "Small" | "Medium" | "Large";
    characteristics: string;
    keyUsernames: string[];
  }>;
  recommendations: Array<{
    priority: "Critical" | "High" | "Medium" | "Low";
    audience: string;
    action: string;
    expectedImpact: string;
    relatedTopicRank: number;
  }>;
}

export interface AnalysisHistory {
  id: string;
  streamUrl: string;
  streamTitle: string;
  timestamp: string;
  messageCount: number;
  report: ChatPulseReport | null;
  status: "completed" | "pending" | "failed";
  startTime?: number;
  endTime?: number;
}

export interface UserSettings {
  apiKey: string;
  reportLanguage: string;
  maxTopics: number;
  topic: string;
  consentGiven: boolean;
}

export interface PortMessage {
  type: "CHAT_MESSAGE" | "START_COLLECTION" | "STOP_COLLECTION" | "ANALYZE" | "ANALYSIS_RESULT" | "MESSAGE_COUNT" | "ERROR" | "RAW_EXPORT" | "RETRY_ANALYSIS";
  payload: unknown;
}
