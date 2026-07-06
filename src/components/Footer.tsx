import type { Dictionary } from "@/dictionaries/types";

interface FooterProps {
  dict: Dictionary["footer"];
}

export default function Footer({ dict }: FooterProps) {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);

  return (
    <footer className="bg-forest px-6 py-8 text-center">
      <p className="text-xs text-cream/30">
        &copy; {new Date().getFullYear()} {dict.copyright}
      </p>
      <p className="mt-2 font-mono text-[10px] tracking-wider text-cream/20">
        hand-built with next.js · no template{sha ? ` · build ${sha}` : ""}
      </p>
    </footer>
  );
}
