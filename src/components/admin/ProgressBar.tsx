"use client";

export default function ProgressBar({
  current,
  max,
  label,
}: {
  current: number;
  max: number;
  label?: string;
}) {
  const pct = Math.min(100, Math.round((current / max) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-bold text-forest">
          {current} / {max}
        </span>
        {label && <span className="text-xs text-charcoal/40">{label}</span>}
      </div>
      <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-sage/20">
        <div
          className="h-full rounded-full bg-forest transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
