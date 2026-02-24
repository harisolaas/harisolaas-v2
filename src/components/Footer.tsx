import type { Dictionary } from "@/dictionaries/types";

interface FooterProps {
  dict: Dictionary["footer"];
}

export default function Footer({ dict }: FooterProps) {
  return (
    <footer className="bg-forest px-6 py-8 text-center">
      <p className="text-xs text-cream/30">
        &copy; {new Date().getFullYear()} {dict.copyright}
      </p>
    </footer>
  );
}
