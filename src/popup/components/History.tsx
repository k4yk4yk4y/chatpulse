import { useState, useEffect } from "react";
import { getHistory, deleteHistoryEntry } from "../../shared/storage";
import type { AnalysisHistory, ChatPulseReport } from "../../shared/types";

interface HistoryProps {
  onSelectReport: (report: ChatPulseReport) => void;
  onRetryAnalysis: (historyId: string) => void;
  retryingId: string | null;
}

export function History({ onSelectReport, onRetryAnalysis, retryingId }: HistoryProps) {
  const [entries, setEntries] = useState<AnalysisHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    const history = await getHistory();
    setEntries(history);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    await deleteHistoryEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="skeleton h-16 w-full" />
        <div className="skeleton h-16 w-full" />
        <div className="skeleton h-16 w-full" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-sm">No analysis history yet</p>
        <p className="text-gray-300 text-xs mt-1">
          Analyzed streams will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-800">
        History ({entries.length})
      </h2>

      <div className="space-y-2">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className={`p-3 border rounded-lg transition-colors ${
              entry.status === "pending"
                ? "bg-amber-50 border-amber-200"
                : entry.status === "failed"
                  ? "bg-red-50 border-red-200"
                  : "bg-white border-gray-200 hover:border-brand-300"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h4
                  className="text-sm font-medium text-gray-800 break-words line-clamp-2"
                  title={entry.streamTitle}
                >
                  {entry.streamTitle}
                </h4>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                  <span>{new Date(entry.timestamp).toLocaleDateString()}</span>
                  <span>·</span>
                  <span>{entry.messageCount.toLocaleString()} msgs</span>
                  {entry.status === "pending" && (
                    <span className="text-amber-600 font-medium">· In progress</span>
                  )}
                {(entry.status === "failed" || entry.status === "pending") && (
                    <span className="text-red-600 font-medium">· Failed</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {entry.status === "completed" && entry.report && (
                  <button
                    onClick={() => onSelectReport(entry.report!)}
                    className="px-2 py-1 text-xs text-brand-600 hover:bg-brand-50 rounded"
                  >
                    View
                  </button>
                )}
                {entry.status === "failed" && (
                  <button
                    onClick={() => onRetryAnalysis(entry.id)}
                    disabled={retryingId === entry.id}
                    className="px-2 py-1 text-xs text-amber-600 hover:bg-amber-50 rounded disabled:opacity-50"
                  >
                    {retryingId === entry.id ? "Retrying..." : "Retry"}
                  </button>
                )}
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded"
                >
                  Delete
                </button>
              </div>
            </div>

            {entry.status === "completed" && entry.report && (
              <div className="mt-2 flex items-center gap-3 text-xs">
                <span
                  className={`font-medium ${
                    entry.report.overallSentiment.score > 0
                      ? "text-emerald-600"
                      : entry.report.overallSentiment.score < 0
                        ? "text-red-600"
                        : "text-amber-600"
                  }`}
                >
                  Sentiment: {entry.report.overallSentiment.score}
                </span>
                <span className="text-gray-500">
                  {entry.report.topTopics.length} topics
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
