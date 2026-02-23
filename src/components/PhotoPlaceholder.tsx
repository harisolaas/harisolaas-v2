interface PhotoPlaceholderProps {
  alt: string;
  className?: string;
  aspect?: "landscape" | "portrait" | "square";
}

export default function PhotoPlaceholder({
  alt,
  className = "",
  aspect = "landscape",
}: PhotoPlaceholderProps) {
  const aspectClass =
    aspect === "portrait"
      ? "aspect-[3/4]"
      : aspect === "square"
        ? "aspect-square"
        : "aspect-[4/3]";

  return (
    <div
      className={`photo-warm-overlay relative overflow-hidden rounded-lg ${aspectClass} ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-tan via-sage/30 to-terracotta/20" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center px-6">
          <svg
            className="mx-auto mb-3 h-10 w-10 text-forest/30"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
            />
          </svg>
          <p className="text-sm text-forest/40 font-sans">{alt}</p>
        </div>
      </div>
    </div>
  );
}
