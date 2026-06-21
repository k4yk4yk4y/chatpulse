import { useState, useEffect, useCallback, useRef } from "react";
import { ConsentScreen } from "./components/ConsentScreen";
import { StreamInput } from "./components/StreamInput";
import { TimeRangeSelector } from "./components/TimeRangeSelector";
import { MessageCounter } from "./components/MessageCounter";
import { ReportViewer } from "./components/ReportViewer";
import { Settings } from "./components/Settings";
import { History } from "./components/History";
import { ExportPanel } from "./components/ExportPanel";
import type { ChatPulseReport, UserSettings } from "../shared/types";
import { getSettings, saveSettings } from "../shared/storage";
import { detectPlatform } from "../shared/platform";

type View = "main" | "settings" | "history";

export function App() {
  const [view, setView] = useState<View>("main");
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [streamUrl, setStreamUrl] = useState("");
  const [collecting, setCollecting] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [timeRange, setTimeRange] = useState(15);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [report, setReport] = useState<ChatPulseReport | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawCsv, setRawCsv] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  useEffect(() => {
    console.log("[ChatPulse POPUP] Initializing, loading settings...");
    getSettings().then((s) => {
      console.log("[ChatPulse POPUP] Settings loaded:", { consentGiven: s.consentGiven, hasApiKey: !!s.apiKey, language: s.reportLanguage });
      setSettings(s);
      setConsentGiven(s.consentGiven);
    });

    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get("url");
    if (urlParam) {
      console.log("[ChatPulse POPUP] Got URL from query param:", urlParam);
      setStreamUrl(urlParam);
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (tab?.url) {
          console.log("[ChatPulse POPUP] Current tab URL:", tab.url);
          setStreamUrl(tab.url);
        }
      });
    }
  }, []);

  useEffect(() => {
    if (!collecting) return;

    console.log("[ChatPulse POPUP] Message count polling started");

    let pollInterval = 2000;
    let consecutiveErrors = 0;

    const poll = () => {
      chrome.runtime.sendMessage({ type: "GET_MESSAGE_COUNT" }, (response: { count?: number }) => {
        if (chrome.runtime.lastError || response?.count === undefined) {
          consecutiveErrors++;
          if (consecutiveErrors >= 3) {
            pollInterval = Math.min(pollInterval * 2, 10_000);
          }
        } else {
          consecutiveErrors = 0;
          pollInterval = 2000;
          setMessageCount(response.count);
        }
      });
    };

    poll();
    const interval = setInterval(poll, pollInterval);

    return () => {
      console.log("[ChatPulse POPUP] Message count polling stopped");
      clearInterval(interval);
    };
  }, [collecting]);

  const handleConsent = useCallback(async () => {
    console.log("[ChatPulse POPUP] User gave consent");
    setConsentGiven(true);
    await saveSettings({ consentGiven: true });
  }, []);

  const handleStartCollection = useCallback(() => {
    const platform = detectPlatform(streamUrl);
    if (!platform) {
      console.warn("[ChatPulse POPUP] Invalid stream URL:", streamUrl);
      setError("Please enter a valid Twitch or Kick URL (e.g., https://twitch.tv/xqc or https://kick.com/xqc)");
      return;
    }

    console.log("[ChatPulse POPUP] Starting collection for:", streamUrl, "platform:", platform, "timeRange:", timeRange, "min");
    setError(null);
    setReport(null);
    setRawCsv(null);
    setMessageCount(0);
    const now = Date.now();
    setStartTime(now);
    setEndTime(timeRange > 0 ? now + timeRange * 60 * 1000 : 0);
    setCollecting(true);

    const channelName = streamUrl.split("/").pop() || "Unknown Stream";

    chrome.runtime.sendMessage({
      type: "START_COLLECTION",
      payload: {
        title: channelName,
        category: "Just Chatting",
        platform,
        viewerCountApprox: 0,
        durationMonitored: timeRange,
      },
    }, (response) => {
      console.log("[ChatPulse POPUP] START_COLLECTION response:", response);
    });
  }, [streamUrl, timeRange]);

  const handleStopCollection = useCallback(() => {
    console.log("[ChatPulse POPUP] Stopping collection");
    setCollecting(false);
    setEndTime(0);
    setRemainingSeconds(0);
    chrome.runtime.sendMessage({ type: "STOP_COLLECTION" }, (response) => {
      console.log("[ChatPulse POPUP] STOP_COLLECTION response:", response);
    });
  }, []);

  const handleAnalyze = useCallback(() => {
    handleStopCollection();

    if (messageCount === 0) {
      setError("No messages collected yet. Wait a bit or check if the stream chat is active.");
      return;
    }

    console.log("[ChatPulse POPUP] Starting analysis, messageCount:", messageCount, "startTime:", startTime);
    setAnalyzing(true);
    setError(null);

    chrome.runtime.sendMessage(
      {
        type: "ANALYZE",
        payload: { startTime, endTime: Date.now() },
      },
      (response: { report?: ChatPulseReport; error?: string }) => {
        console.log("[ChatPulse POPUP] ANALYZE response:", response?.error ? "error: " + response.error : "report received");
        setAnalyzing(false);
        if (response?.error) {
          setError(response.error);
          if (!response.report) {
            handleRawExport();
          }
        }
        if (response?.report) {
          setReport(response.report);
        }
      }
    );
  }, [startTime, messageCount, handleStopCollection]);

  const handleAnalyzeRef = useRef(handleAnalyze);
  handleAnalyzeRef.current = handleAnalyze;

  useEffect(() => {
    if (!collecting || endTime === 0) {
      setRemainingSeconds(0);
      return;
    }

    const tick = () => {
      const left = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setRemainingSeconds(left);
      if (left <= 0) {
        handleStopCollection();
        handleAnalyzeRef.current();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [collecting, endTime, handleStopCollection]);

  const handleRawExport = useCallback(() => {
    console.log("[ChatPulse POPUP] Requesting raw export, startTime:", startTime);
    chrome.runtime.sendMessage(
      {
        type: "EXPORT_RAW",
        payload: { startTime, endTime: Date.now() },
      },
      (response: { csv?: string; error?: string }) => {
        console.log("[ChatPulse POPUP] EXPORT_RAW response:", response?.csv ? `csv length: ${response.csv.length}` : response?.error || "empty");
        if (response?.csv) {
          setRawCsv(response.csv);
        }
      }
    );
  }, [startTime]);

  const handleRetryAnalysis = useCallback((historyId: string) => {
    console.log("[ChatPulse POPUP] Retrying analysis for:", historyId);
    setRetryingId(historyId);
    setError(null);
    setReport(null);

    chrome.runtime.sendMessage(
      {
        type: "RETRY_ANALYSIS",
        payload: { historyId },
      },
      (response: { report?: ChatPulseReport; error?: string }) => {
        console.log("[ChatPulse POPUP] RETRY_ANALYSIS response:", response?.error ? "error: " + response.error : "report received");
        setRetryingId(null);
        if (response?.error) {
          setError(response.error);
        }
        if (response?.report) {
          setReport(response.report);
          setView("main");
        }
      }
    );
  }, []);

  const handleSaveSettings = useCallback(async (newSettings: Partial<UserSettings>) => {
    await saveSettings(newSettings);
    setSettings((prev) => (prev ? { ...prev, ...newSettings } : null));
  }, []);

  if (!consentGiven) {
    return <ConsentScreen onAccept={handleConsent} />;
  }

  return (
    <div className="flex flex-col w-[420px] h-[680px]">
      <header className="flex items-center justify-between px-4 py-3 bg-brand-600 text-white">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-white rounded flex items-center justify-center">
            <span className="text-brand-600 font-bold text-xs">CP</span>
          </div>
          <h1 className="text-lg font-semibold">ChatPulse</h1>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setView("main")}
            className={`px-2 py-1 text-xs rounded ${view === "main" ? "bg-white/20" : "hover:bg-white/10"}`}
          >
            Monitor
          </button>
          <button
            onClick={() => setView("history")}
            className={`px-2 py-1 text-xs rounded ${view === "history" ? "bg-white/20" : "hover:bg-white/10"}`}
          >
            History
          </button>
          <button
            onClick={() => setView("settings")}
            className={`px-2 py-1 text-xs rounded ${view === "settings" ? "bg-white/20" : "hover:bg-white/10"}`}
          >
            Settings
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        {view === "settings" && settings && (
          <Settings settings={settings} onSave={handleSaveSettings} />
        )}

        {view === "history" && (
          <History
            onSelectReport={(r) => {
              setReport(r);
              setView("main");
            }}
            onRetryAnalysis={handleRetryAnalysis}
            retryingId={retryingId}
          />
        )}

        {view === "main" && (
          <div className="space-y-4">
            <StreamInput
              value={streamUrl}
              onChange={setStreamUrl}
              disabled={collecting}
            />

            <TimeRangeSelector
              value={timeRange}
              onChange={setTimeRange}
              disabled={collecting}
            />

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <p>{error}</p>
                {rawCsv && (
                  <p className="mt-2 text-xs text-red-600">
                    Raw chat data has been exported below. You can copy it for manual analysis.
                  </p>
                )}
                {startTime > 0 && !collecting && (
                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className="mt-2 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    Retry Analysis
                  </button>
                )}
              </div>
            )}

            <div className="flex gap-2">
              {!collecting ? (
                <button
                  onClick={handleStartCollection}
                  className="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 transition-colors"
                >
                  Start Monitoring
                </button>
              ) : (
                <>
                  <button
                    onClick={handleStopCollection}
                    className="flex-1 py-2.5 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600"
                  >
                    Stop
                  </button>
                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing || messageCount === 0}
                    className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {analyzing ? "Analyzing..." : "Analyze"}
                  </button>
                </>
              )}
            </div>

            {collecting && <MessageCounter count={messageCount} remainingSeconds={remainingSeconds} />}

            {analyzing && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
                  Sending to AI for analysis...
                </div>
                <div className="space-y-2">
                  <div className="skeleton h-20 w-full" />
                  <div className="skeleton h-32 w-full" />
                  <div className="skeleton h-24 w-full" />
                </div>
              </div>
            )}

            {report && (
              <>
                <ReportViewer report={report} />
                <ExportPanel report={report} rawCsv={rawCsv} />
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
