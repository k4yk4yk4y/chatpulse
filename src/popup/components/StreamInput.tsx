import { detectPlatform } from "../../shared/platform";

interface StreamInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}

export function StreamInput({ value, onChange, disabled }: StreamInputProps) {
  const platform = detectPlatform(value);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Stream URL
      </label>
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="https://twitch.tv/xqc or https://kick.com/xqc"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
      />
      <p className="mt-1 text-xs text-gray-400 flex items-center gap-2">
        Paste a Twitch or Kick channel URL or type the channel name
        {platform && (
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            platform === "twitch" ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"
          }`}>
            {platform === "twitch" ? "Twitch" : "Kick"}
          </span>
        )}
      </p>
    </div>
  );
}
