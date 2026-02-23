interface MetricDisplayProps {
  value: string;
  label: string;
  dark?: boolean;
}

export default function MetricDisplay({
  value,
  label,
  dark = false,
}: MetricDisplayProps) {
  return (
    <div className="text-center">
      <div
        className={`font-serif text-2xl md:text-3xl ${
          dark ? "text-terracotta/90" : "text-terracotta"
        }`}
      >
        {value}
      </div>
      <div
        className={`mt-1 text-xs uppercase tracking-wide ${
          dark ? "text-cream/50" : "text-charcoal/50"
        }`}
      >
        {label}
      </div>
    </div>
  );
}
