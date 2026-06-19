interface TimeRangeSelectorProps {
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
}

const TIME_RANGES = [
  { minutes: 5, label: "5 min" },
  { minutes: 15, label: "15 min" },
  { minutes: 30, label: "30 min" },
  { minutes: 60, label: "1 hr" },
  { minutes: -1, label: "Full" },
];

export function TimeRangeSelector({ value, onChange, disabled }: TimeRangeSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Time Range
      </label>
      <div className="flex gap-1">
        {TIME_RANGES.map((range) => (
          <button
            key={range.minutes}
            onClick={() => onChange(range.minutes)}
            disabled={disabled}
            className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
              value === range.minutes
                ? "bg-brand-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {range.label}
          </button>
        ))}
      </div>
    </div>
  );
}
