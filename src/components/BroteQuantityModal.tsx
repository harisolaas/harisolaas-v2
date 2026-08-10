"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatArs } from "@/data/brote";
import { MAX_TICKETS_PER_PURCHASE } from "@/lib/brote-ticket-ids";
import type { BroteDict } from "@/dictionaries/types";

/**
 * Quantity picker, opened by every BROTE ticket CTA.
 *
 * The previous programme deliberately removed every step between the CTA and
 * MercadoPago, so putting one back needs to earn it: this exists only because
 * a buyer bringing friends otherwise has to pay N separate times. It stays a
 * modal rather than a control on the landing so the page keeps its shape, and
 * it opens at 1 with the pay button focused — one extra tap in the common
 * case.
 *
 * It renders NO price authority: `unitPrice` is display only. What anyone is
 * charged is decided server-side in `/api/brote/checkout`, which prices from
 * `currentTicketPrice()` or the invitation registry and clamps the quantity
 * again with the same helper used here.
 */

const PAPER = "#EAE3D2";
const FOREST = "#3E5226";
const INK = "#2C2C2C";

export interface BroteQuantityModalProps {
  onClose: () => void;
  /** Called with the chosen quantity. Keeps the modal open while it runs. */
  onConfirm: (quantity: number) => void | Promise<void>;
  /** Unit price in whole pesos — for the running total only. */
  unitPrice: number;
  loading: boolean;
  dict: BroteDict["quantity"];
}

export default function BroteQuantityModal({
  onClose,
  onConfirm,
  unitPrice,
  loading,
  dict,
}: BroteQuantityModalProps) {
  const [quantity, setQuantity] = useState(1);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // The parent renders this conditionally, so it MOUNTS on open — which is
  // what resets the count to 1. A buyer who picked 4, closed, and reopened
  // from another CTA starting at 4 again would be a small nasty surprise,
  // and resetting in an effect instead would re-render every open for no
  // reason.
  //
  // Focus moves in on mount so the keyboard path works and the pay button is
  // one Enter away.
  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
      if (e.key !== "Tab") return;
      // Trap focus: a modal that lets Tab wander behind it is unusable with
      // a keyboard and invisible to a screen reader.
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled])',
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [loading, onClose]);

  const step = useCallback((delta: number) => {
    setQuantity((q) =>
      Math.min(MAX_TICKETS_PER_PURCHASE, Math.max(1, q + delta)),
    );
  }, []);

  const total = formatArs(unitPrice * quantity);
  const countLabel =
    quantity === 1 ? dict.one : dict.many.replace("{n}", String(quantity));

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(20,24,16,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={dict.heading}
        style={{
          background: PAPER,
          color: INK,
          borderRadius: 4,
          padding: "28px 24px 24px",
          width: "100%",
          maxWidth: 380,
          boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-brote-mono), monospace",
            fontSize: 13,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: FOREST,
            margin: 0,
          }}
        >
          {dict.heading}
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.55, margin: "12px 0 22px" }}>
          {dict.intro}
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 22,
            marginBottom: 8,
          }}
        >
          <StepButton
            label={dict.decrease}
            onClick={() => step(-1)}
            disabled={quantity <= 1 || loading}
          >
            −
          </StepButton>
          <span
            aria-live="polite"
            style={{
              fontFamily: "var(--font-brote-mono), monospace",
              fontSize: 30,
              fontWeight: 700,
              color: FOREST,
              minWidth: 48,
              textAlign: "center",
            }}
          >
            {quantity}
          </span>
          <StepButton
            label={dict.increase}
            onClick={() => step(1)}
            disabled={quantity >= MAX_TICKETS_PER_PURCHASE || loading}
          >
            +
          </StepButton>
        </div>

        <p
          style={{
            textAlign: "center",
            fontSize: 13,
            color: "#6B6B5E",
            margin: "0 0 20px",
          }}
        >
          {countLabel}
          {quantity >= MAX_TICKETS_PER_PURCHASE ? ` · ${dict.maxNote}` : ""}
        </p>

        <button
          ref={confirmRef}
          type="button"
          onClick={() => void onConfirm(quantity)}
          disabled={loading}
          style={{
            display: "block",
            width: "100%",
            boxSizing: "border-box",
            fontFamily: "var(--font-brote-mono), monospace",
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            padding: "16px 20px",
            borderRadius: 2,
            border: "none",
            cursor: loading ? "default" : "pointer",
            background: FOREST,
            color: PAPER,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? dict.submitting : dict.submit.replace("{total}", total)}
        </button>

        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          style={{
            display: "block",
            margin: "14px auto 0",
            background: "none",
            border: "none",
            color: "#6B6B5E",
            fontSize: 13,
            textDecoration: "underline",
            cursor: loading ? "default" : "pointer",
          }}
        >
          {dict.close}
        </button>
      </div>
    </div>
  );
}

function StepButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 46,
        height: 46,
        borderRadius: "50%",
        border: `1px solid ${FOREST}`,
        background: "transparent",
        color: FOREST,
        fontSize: 22,
        lineHeight: 1,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.35 : 1,
      }}
    >
      {children}
    </button>
  );
}
