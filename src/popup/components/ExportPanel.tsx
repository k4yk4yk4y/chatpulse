import { useState } from "react";
import type { ChatPulseReport } from "../../shared/types";

interface ExportPanelProps {
  report: ChatPulseReport;
  rawCsv: string | null;
}

export function ExportPanel({ report, rawCsv }: ExportPanelProps) {
  const [exported, setExported] = useState<string | null>(null);

  const exportJSON = () => {
    const json = JSON.stringify(report, null, 2);
    copyToClipboard(json, "JSON");
  };

  const exportCSV = () => {
    if (rawCsv) {
      copyToClipboard(rawCsv, "CSV");
      return;
    }

    const header = "topic,category,sentiment,frequency,detailed_description,key_users\n";
    const rows = report.topTopics
      .map((t) => {
        const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
        return [
          escape(t.topicTitle),
          escape(t.category),
          escape(t.sentiment),
          t.frequency,
          escape(t.detailedDescription),
          escape(t.keyUsernames.join(";")),
        ].join(",");
      })
      .join("\n");

    copyToClipboard(header + rows, "CSV");
  };

  const copyToClipboard = async (text: string, format: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setExported(format);
      setTimeout(() => setExported(null), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setExported(format);
      setTimeout(() => setExported(null), 2000);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={exportJSON}
        className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
          exported === "JSON"
            ? "bg-emerald-50 border-emerald-300 text-emerald-700"
            : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
        }`}
      >
        {exported === "JSON" ? "Copied!" : "Export JSON"}
      </button>
      <button
        onClick={exportCSV}
        className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
          exported === "CSV"
            ? "bg-emerald-50 border-emerald-300 text-emerald-700"
            : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
        }`}
      >
        {exported === "CSV" ? "Copied!" : "Export CSV"}
      </button>
    </div>
  );
}
