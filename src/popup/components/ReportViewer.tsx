import { useMemo, useState } from "react";
import { TopicCard } from "./TopicCard";
import { PriorityBadge } from "./PriorityBadge";
import type { ChatPulseReport } from "../../shared/types";

interface ReportViewerProps {
  report: ChatPulseReport;
}

export function ReportViewer({ report }: ReportViewerProps) {
  const [expanded, setExpanded] = useState(false);

  const topicRecsMap = useMemo(() => {
    const map = new Map<number, typeof report.recommendations>();
    for (const rec of report.recommendations) {
      if (rec.relatedTopicRank === 0) continue;
      const existing = map.get(rec.relatedTopicRank) ?? [];
      existing.push(rec);
      map.set(rec.relatedTopicRank, existing);
    }
    return map;
  }, [report.recommendations]);

  const generalRecs = useMemo(
    () => report.recommendations.filter((r) => r.relatedTopicRank === 0),
    [report.recommendations]
  );

  const sentimentColor = (score: number) => {
    if (score > 30) return "text-emerald-600";
    if (score > -30) return "text-amber-600";
    return "text-red-600";
  };

  const sentimentBg = (score: number) => {
    if (score > 30) return "bg-emerald-50 border-emerald-200";
    if (score > -30) return "bg-amber-50 border-amber-200";
    return "bg-red-50 border-red-200";
  };

  return (
    <div className="space-y-3">
      <div className={`p-3 rounded-lg border ${sentimentBg(report.overallSentiment.score)}`}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-700">Sentiment</span>
          <span className={`text-lg font-bold ${sentimentColor(report.overallSentiment.score)}`}>
            {report.overallSentiment.score > 0 ? "+" : ""}
            {report.overallSentiment.score}
          </span>
        </div>
        <div className="text-xs text-gray-500">{report.overallSentiment.label}</div>
        <p className="text-sm text-gray-600 mt-1">{report.overallSentiment.summary}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="p-2 bg-gray-50 rounded text-center">
          <div className="text-lg font-bold text-brand-600">
            {report.engagementQuality.score}
          </div>
          <div className="text-xs text-gray-500">Engagement</div>
        </div>
        <div className="p-2 bg-gray-50 rounded text-center">
          <div className="text-lg font-bold text-brand-600">
            {Math.round(report.engagementQuality.substantiveRatio * 100)}%
          </div>
          <div className="text-xs text-gray-500">Substantive</div>
        </div>
        <div className="p-2 bg-gray-50 rounded text-center">
          <div className="text-lg font-bold text-brand-600">
            {report.reportMeta.messagesAnalyzed.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">Messages</div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          Top Topics ({report.topTopics.length})
        </h3>
        <div className="space-y-2">
          {(expanded ? report.topTopics : report.topTopics.slice(0, 3)).map((topic) => (
            <TopicCard
              key={topic.rank}
              topic={topic}
              recommendations={topicRecsMap.get(topic.rank)}
            />
          ))}
        </div>
        {report.topTopics.length > 3 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full mt-2 py-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium"
          >
            {expanded ? "Show less" : `Show all ${report.topTopics.length} topics`}
          </button>
        )}
      </div>

      {generalRecs.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">General Recommendations</h3>
          <div className="space-y-2">
            {generalRecs.map((rec) => (
              <div key={rec.action} className="bg-blue-50 border border-blue-200 rounded p-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <PriorityBadge priority={rec.priority} />
                </div>
                <p className="text-xs font-medium text-gray-800">{rec.action}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
