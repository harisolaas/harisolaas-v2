/**
 * The handful of Lucide icons the desafío design uses, inlined (the site
 * doesn't ship an icon library). Paths are Lucide's; stroke-width 2.75 with
 * round caps/joins, as in the design.
 */
const PATHS = {
  check: <path d="M20 6 9 17l-5-5" />,
  "chevron-left": <path d="m15 18-6-6 6-6" />,
  "chevron-right": <path d="m9 18 6-6-6-6" />,
  "arrow-right": (
    <>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </>
  ),
  lock: (
    <>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  "message-circle": <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />,
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({
  name,
  size,
  className,
}: {
  name: IconName;
  size: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}
