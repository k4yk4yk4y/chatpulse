interface StreamInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}

export function StreamInput({ value, onChange, disabled }: StreamInputProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Twitch Stream URL
      </label>
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="https://twitch.tv/xqc"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
      />
      <p className="mt-1 text-xs text-gray-400">
        Paste a Twitch channel URL or type the channel name
      </p>
    </div>
  );
}
