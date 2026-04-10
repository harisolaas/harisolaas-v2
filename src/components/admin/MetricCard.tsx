"use client";

export default function MetricCard({
  label,
  value,
  subtitle,
  accent,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-sage/20 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-charcoal/40">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-bold ${
          accent ? "text-terracotta" : "text-forest"
        }`}
      >
        {value}
      </p>
      {subtitle && (
        <p className="mt-0.5 text-xs text-charcoal/50">{subtitle}</p>
      )}
    </div>
  );
}
