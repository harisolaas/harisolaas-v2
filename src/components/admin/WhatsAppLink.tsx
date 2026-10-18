"use client";

import { phoneToWaMe } from "@/lib/plant-types";

/**
 * Tappable wa.me link for a stored phone. WhatsApp is the default channel
 * and some people (Hackeá tu mente) have no email at all, so the admin
 * shows the number as the way to reach them. `stopPropagation` keeps a
 * tap inside a clickable table row from also opening the row's drawer.
 */
export default function WhatsAppLink({
  phone,
  className = "",
}: {
  phone: string;
  className?: string;
}) {
  const digits = phoneToWaMe(phone);
  if (!digits) return <span className={className}>{phone}</span>;
  return (
    <a
      href={`https://wa.me/${digits}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`text-terracotta underline-offset-2 hover:underline ${className}`}
    >
      {phone}
    </a>
  );
}
