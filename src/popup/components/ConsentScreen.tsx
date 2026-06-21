interface ConsentScreenProps {
  onAccept: () => void;
}

export function ConsentScreen({ onAccept }: ConsentScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center w-[420px] h-[680px] p-6 text-center">
      <div className="w-16 h-16 bg-brand-600 rounded-2xl flex items-center justify-center mb-6">
        <span className="text-white font-bold text-2xl">CP</span>
      </div>

      <h1 className="text-2xl font-bold mb-2">Welcome to ChatPulse</h1>
      <p className="text-gray-500 mb-6">
        Live Stream Chat Analysis & Audience Intelligence
      </p>

      <div className="w-full bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left">
        <h3 className="font-semibold text-amber-800 mb-2">Privacy Notice</h3>
        <ul className="text-sm text-amber-700 space-y-1.5">
          <li>
            Collected chat messages and usernames will be sent to{" "}
            <strong>OpenRouter</strong> and the <strong>AI model</strong> that
            processes your request.
          </li>
          <li>
            ChatPulse does not run its own servers and does not store this data
            anywhere we control.
          </li>
          <li>
            Your OpenRouter API key is stored locally in your browser and never
            leaves your device except when making API calls.
          </li>
          <li>
            No analytics, telemetry, or fingerprinting is collected by ChatPulse.
          </li>
        </ul>
      </div>

      <div className="w-full bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 text-left">
        <h3 className="font-semibold mb-2">How It Works</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>1. Navigate to a Twitch stream</li>
          <li>2. Click "Start Monitoring" to collect chat messages</li>
          <li>3. Click "Analyze" to get an AI-powered intelligence report</li>
          <li>4. Export insights as JSON, CSV, or PDF</li>
        </ul>
      </div>

      <button
        onClick={onAccept}
        className="w-full py-3 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 transition-colors"
      >
        I Understand & Accept
      </button>

      <p className="text-xs text-gray-400 mt-4">
        You need an OpenRouter API key (free tier) to use ChatPulse. You can get
        one at{" "}
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
  );
}
