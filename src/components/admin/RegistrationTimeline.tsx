"use client";

interface TimelinePoint {
  date: string;
  cumulative: number;
}

export default function RegistrationTimeline({
  data,
  capacity,
}: {
  data: TimelinePoint[];
  capacity: number;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-charcoal/30">
        Sin datos todavía
      </div>
    );
  }

  const maxY = Math.max(capacity, ...data.map((d) => d.cumulative));
  const w = 400;
  const h = 160;
  const px = 40; // left padding for labels
  const py = 20; // top/bottom padding

  const points = data.map((d, i) => {
    const x = px + ((w - px - 10) / Math.max(1, data.length - 1)) * i;
    const y = h - py - ((d.cumulative / maxY) * (h - py * 2));
    return { x, y, ...d };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  // Capacity line
  const capY = h - py - ((capacity / maxY) * (h - py * 2));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const y = h - py - frac * (h - py * 2);
        const val = Math.round(frac * maxY);
        return (
          <g key={frac}>
            <line
              x1={px}
              y1={y}
              x2={w - 10}
              y2={y}
              stroke="#A8B5A0"
              strokeOpacity={0.2}
              strokeWidth={0.5}
            />
            <text
              x={px - 6}
              y={y + 3}
              textAnchor="end"
              fill="#888"
              fontSize="9"
            >
              {val}
            </text>
          </g>
        );
      })}

      {/* Capacity line */}
      <line
        x1={px}
        y1={capY}
        x2={w - 10}
        y2={capY}
        stroke="#C4704B"
        strokeDasharray="4 3"
        strokeWidth={1}
        strokeOpacity={0.5}
      />
      <text
        x={w - 8}
        y={capY - 4}
        textAnchor="end"
        fill="#C4704B"
        fontSize="8"
        fontWeight="600"
      >
        {capacity}
      </text>

      {/* Line */}
      <polyline
        points={polyline}
        fill="none"
        stroke="#2D4A3E"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {/* Dots */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#2D4A3E" />
      ))}

      {/* Date labels */}
      {points
        .filter((_, i) => i === 0 || i === points.length - 1)
        .map((p, i) => (
          <text
            key={i}
            x={p.x}
            y={h - 4}
            textAnchor={i === 0 ? "start" : "end"}
            fill="#888"
            fontSize="8"
          >
            {p.date.slice(5)}
          </text>
        ))}
    </svg>
  );
}
