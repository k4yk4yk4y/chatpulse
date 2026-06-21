import { useState } from "react";
import type { ChatPulseReport } from "../../shared/types";
import { PriorityBadge } from "./PriorityBadge";

type Topic = ChatPulseReport["topTopics"][number];
type Recommendation = ChatPulseReport["recommendations"][number];

interface TopicCardProps {
  topic: Topic;
  recommendations?: Recommendation[];
}

export function TopicCard({ topic, recommendations = [] }: TopicCardProps) {
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
            <PriorityBadge priority={topic.severity} />
          )}
        </div>
      </div>

      {topic.detailedDescription && (
        <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">
          {topic.detailedDescription}
        </p>
      )}

      <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-500">
        <span>{topic.frequency} mentions</span>
        <span>{topic.totalUniqueUsers > 0 ? topic.totalUniqueUsers : topic.keyUsernames.length} users</span>
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

      {recommendations.length > 0 && (
        <div className="mt-2 border-t border-gray-100 pt-2 space-y-1.5">
          {recommendations.map((rec) => (
            <div key={rec.action} className="bg-blue-50 border border-blue-200 rounded p-2">
              <div className="flex items-center gap-2 mb-1">
                <PriorityBadge priority={rec.priority} />
              </div>
              <p className="text-xs font-medium text-gray-800">{rec.action}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
