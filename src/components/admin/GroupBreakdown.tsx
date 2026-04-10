"use client";

interface Props {
  solo: number;
  conAlguien: number;
  grupo: number;
}

export default function GroupBreakdown({ solo, conAlguien, grupo }: Props) {
  const total = solo + conAlguien + grupo || 1;
  const items = [
    { label: "Por mi cuenta", value: solo, color: "bg-forest" },
    { label: "Con alguien", value: conAlguien, color: "bg-terracotta" },
    { label: "Grupo (3+)", value: grupo, color: "bg-sage" },
  ];

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-charcoal/70">{item.label}</span>
            <span className="font-semibold text-charcoal">
              {item.value}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-sage/15">
            <div
              className={`h-full rounded-full ${item.color} transition-all duration-500`}
              style={{ width: `${(item.value / total) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
