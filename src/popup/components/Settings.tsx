import { useState } from "react";
import type { UserSettings } from "../../shared/types";
import { REPORT_LANGUAGES, DEFAULT_TOPIC } from "../../shared/constants";

interface SettingsProps {
  settings: UserSettings;
  onSave: (settings: Partial<UserSettings>) => void;
}

export function Settings({ settings, onSave }: SettingsProps) {
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [reportLanguage, setReportLanguage] = useState(settings.reportLanguage);
  const [maxTopics, setMaxTopics] = useState(settings.maxTopics);
  const [topic, setTopic] = useState(settings.topic || DEFAULT_TOPIC);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave({ apiKey, reportLanguage, maxTopics, topic });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">Settings</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          OpenRouter API Key
        </label>
        <div className="relative">
          <input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-or-..."
            className="w-full px-3 py-2 pr-16 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
          >
            {showKey ? "Hide" : "Show"}
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-400">
          Get a free key at{" "}
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 hover:underline"
          >
            openrouter.ai/keys
          </a>
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Analysis Topic
        </label>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={DEFAULT_TOPIC}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        />
        <p className="mt-1 text-xs text-gray-400">
          Context topic for LLM analysis (e.g. "{DEFAULT_TOPIC}")
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Report Language
        </label>
        <select
          value={reportLanguage}
          onChange={(e) => setReportLanguage(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        >
          {REPORT_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Max Topics: {maxTopics}
        </label>
        <input
          type="range"
          min={1}
          max={20}
          value={maxTopics}
          onChange={(e) => setMaxTopics(parseInt(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>1</span>
          <span>10</span>
          <span>20</span>
        </div>
      </div>

      <button
        onClick={handleSave}
        className={`w-full py-2.5 rounded-lg font-medium transition-colors ${
          saved
            ? "bg-emerald-500 text-white"
            : "bg-brand-600 text-white hover:bg-brand-700"
        }`}
      >
        {saved ? "Saved!" : "Save Settings"}
      </button>

      <div className="pt-4 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-2">About</h3>
        <div className="text-xs text-gray-500 space-y-1">
          <p>ChatPulse v0.1.0 — MVP</p>
          <p>Models: gpt-oss-120b:free → gemma-4-31b-it:free</p>
          <p>Cost: $0 per analysis (free-tier models only)</p>
        </div>
      </div>
    </div>
  );
}
