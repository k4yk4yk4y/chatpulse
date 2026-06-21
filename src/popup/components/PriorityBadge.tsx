interface PriorityBadgeProps {
  priority: string;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const className =
    priority === "Critical"
      ? "bg-red-100 text-red-700"
      : priority === "High"
        ? "bg-orange-100 text-orange-700"
        : priority === "Medium"
          ? "bg-amber-100 text-amber-700"
          : "bg-gray-100 text-gray-700";

  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${className}`}>
      {priority}
    </span>
  );
}
