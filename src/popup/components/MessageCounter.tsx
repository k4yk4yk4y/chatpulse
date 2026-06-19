interface MessageCounterProps {
  count: number;
  remainingSeconds: number;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MessageCounter({ count, remainingSeconds }: MessageCounterProps) {
  const hasTimer = remainingSeconds > 0;

  return (
    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse-dot" />
      <span className="text-sm text-green-700">
        Collecting...{" "}
        <strong className="animate-count-up inline-block">
          {count.toLocaleString()}
        </strong>{" "}
        messages
      </span>
      {hasTimer && (
        <span className="ml-auto text-xs font-mono text-green-600 bg-green-100 px-2 py-0.5 rounded">
          {formatTime(remainingSeconds)}
        </span>
      )}
    </div>
  );
}
