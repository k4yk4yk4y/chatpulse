import { useState } from "react";
import type { ChatPulseReport } from "../../shared/types";

type Topic = ChatPulseReport["topTopics"][number];

interface TopicCardProps {
  topic: Topic;
}

export function TopicCard({ topic }: TopicCardProps) {
  const [expanded, setExpanded] = useState(false);

  const sentimentBadge = (sentiment: string) => {
    switch (sentiment) {
      case "Positive":
        return "badge-positive";
      case "Negative":
        return "badge-negative";
      default:
        return "badge-neutral";
    }
  };

  const categoryIcon = (category: string) => {
    switch (category) {
      case "Complaint":
        return "😤";
      case "Question":
        return "❓";
      case "Suggestion":
        return "💡";
      case "Praise":
        return "👍";
      case "Bug Report":
        return "🐛";
      case "Comparison":
        return "⚖️";
      default:
        return "💬";
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm">{categoryIcon(topic.category)}</span>
          <h4
            className="text-sm font-medium text-gray-800 break-words line-clamp-2"
            title={topic.topicTitle}
          >
            {topic.topicTitle}
          </h4>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${sentimentBadge(topic.sentiment)}`}>
            {topic.sentiment}
          </span>
          {topic.severity && topic.severity !== "Low" && (
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                topic.severity === "Critical"
                  ? "badge-critical"
                  : topic.severity === "High"
                    ? "bg-orange-100 text-orange-700"
                    : "badge-neutral"
              }`}
            >
              {topic.severity}
            </span>
          )}
        </div>
      </div>

      <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-500">
        <span>{topic.frequency} mentions</span>
        <span>{topic.keyUsernames.length} users</span>
      </div>

      {topic.keyUsernames.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {topic.keyUsernames.map((u) => (
            <span key={u} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">
              @{u}
            </span>
          ))}
        </div>
      )}

      {topic.sampleMessages.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-[11px] text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
          >
            <span
              className={`inline-block transition-transform ${expanded ? "rotate-90" : ""}`}
            >
              ▶
            </span>
            Show sample messages ({topic.sampleMessages.length})
          </button>

          {expanded && (
            <div className="mt-2 space-y-1.5 border-t border-gray-100 pt-2">
              {topic.sampleMessages.map((msg, i) => (
                <div key={i} className="p-2 bg-gray-50 rounded text-xs">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="font-medium text-gray-700">@{msg.username}</span>
                    <span className="text-gray-400 text-[10px]">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-gray-600">{msg.message}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
