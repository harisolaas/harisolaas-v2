"use client";

import { useCallback, useState, type CSSProperties } from "react";
import type { BroteInvitacionDict } from "@/dictionaries/types";
import type { InvitationSlug } from "@/lib/brote-invitations";
import { readBrowserAttribution } from "@/lib/attribution";
import { CONFIRM_TOKEN_STORAGE_KEY } from "@/lib/brote-confirm-token";
import BroteQuantityModal from "./BroteQuantityModal";
import type { BroteDict } from "@/dictionaries/types";

/**
 * The only interactive part of the invitation page.
 *
 * The rest of the page is a server component with no runtime state — the
 * design brief is explicit that it has to paint in one go. This island exists
 * because the CTA has to POST for a MercadoPago preference before it can
 * redirect, exactly like the main landing's CTA does.
 *
 * `invite` is sent so the SERVER can price the ticket. It is a lookup key,
 * never a price: nothing here decides what anyone is charged.
 */

interface Props {
  /** Only the three strings this button renders — everything crossing into
      the client bundle gets serialized into the RSC payload, and the rest of
      `price` (labels, badges, notes) is server-rendered above. */
  dict: Pick<BroteInvitacionDict["price"], "cta" | "loading" | "error">;
  /** Quantity-modal copy, from the shared BROTE dictionary. */
  quantityDict: BroteDict["quantity"];
  /**
   * Unit price in whole pesos, for the modal's running total ONLY. The
   * server prices the ticket from the invitation registry; this crosses
   * to the client purely so the total can be shown before leaving.
   */
  unitPrice: number;
  locale: string;
  invite: InvitationSlug;
  /** Visual variant — the hero CTA is paper-on-green, the closing one green. */
  variant: "onGreen" | "onPaper";
}

const PAPER = "#EAE3D2";
const FOREST = "#3E5226";
const FOREST_HOVER = "#2E3D1C";
const ERROR = "#A0522D";

const base: CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "var(--font-brote-mono), monospace",
  fontWeight: 700,
  fontSize: 14,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  padding: "18px 24px",
  borderRadius: 2,
  border: "none",
  cursor: "pointer",
  textAlign: "center",
};

export default function BroteInvitacionCta({
  dict,
  quantityDict,
  unitPrice,
  locale,
  invite,
  variant,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  const onGreen = variant === "onGreen";

  const handleClick = useCallback(async (quantity: number) => {
    if (loading) return;
    setLoading(true);
    setFailed(false);

    const cookies = document.cookie.split("; ");
    const fbp = cookies.find((c) => c.startsWith("_fbp="))?.split("=")[1];
    const fbc = cookies.find((c) => c.startsWith("_fbc="))?.split("=")[1];
    const eventId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      const res = await fetch("/api/brote/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invite,
          // A count, never a price: the server prices from the invitation
          // registry and clamps this with the same helper the webhook uses.
          quantity,
          eventId,
          fbp,
          fbc,
          locale,
          // A visitor who reached this page through /go/<slug> carries a more
          // specific attribution than "came via the collaborator"; the server
          // keeps whichever is more specific.
          ...readBrowserAttribution(window.location.search, document.cookie),
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (data.init_point) {
        if (data.confirmToken) {
          try {
            window.localStorage.setItem(
              CONFIRM_TOKEN_STORAGE_KEY,
              data.confirmToken,
            );
          } catch {
            // Locked-down browser: the ticket still reaches the MP email,
            // /success just won't offer the contact step.
          }
        }
        window.location.href = data.init_point;
        return;
      }
      setFailed(true);
      setLoading(false);
    } catch {
      setFailed(true);
      setLoading(false);
    }
  }, [invite, locale, loading]);

  return (
    <div>
      {open && (
        <BroteQuantityModal
          onClose={() => setOpen(false)}
          onConfirm={(quantity) => handleClick(quantity)}
          unitPrice={unitPrice}
          loading={loading}
          dict={quantityDict}
        />
      )}
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={loading}
        style={{
          ...base,
          background: onGreen ? PAPER : FOREST,
          color: onGreen ? FOREST : PAPER,
          opacity: loading ? 0.7 : 1,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = onGreen ? "#FFFFFF" : FOREST_HOVER;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = onGreen ? PAPER : FOREST;
        }}
      >
        {loading ? dict.loading : dict.cta}
      </button>
      {failed && (
        <p
          role="alert"
          style={{
            fontFamily: "var(--font-brote-mono), monospace",
            fontSize: 12,
            lineHeight: 1.6,
            marginTop: 10,
            color: onGreen ? PAPER : ERROR,
          }}
        >
          {dict.error}
        </p>
      )}
    </div>
  );
}
