"use client";

interface UtmEntry {
  source: string;
  count: number;
}

const SOURCE_LABELS: Record<string, string> = {
  plantacion_email1: "Email 1 (pala)",
  plantacion_email2: "Email 2 (directo)",
};

export default function UtmFunnel({
  data,
  organic,
}: {
  data: UtmEntry[];
  organic: number;
}) {
  const all = [
    { source: "Orgánico", count: organic },
    ...data.map((d) => ({
      source: SOURCE_LABELS[d.source] || d.source,
      count: d.count,
    })),
  ].sort((a, b) => b.count - a.count);

  const max = Math.max(...all.map((d) => d.count), 1);

  return (
    <div className="space-y-2">
      {all.map((item) => (
        <div key={item.source} className="flex items-center gap-3">
          <span className="w-28 truncate text-xs text-charcoal/60">
            {item.source}
          </span>
          <div className="flex-1">
            <div className="h-5 overflow-hidden rounded bg-sage/15">
              <div
                className="flex h-full items-center rounded bg-forest/80 px-2 text-[10px] font-bold text-cream transition-all duration-500"
                style={{ width: `${Math.max(10, (item.count / max) * 100)}%` }}
              >
                {item.count}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
