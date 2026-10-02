import { createHmac, timingSafeEqual } from "crypto";
import { MercadoPagoConfig } from "mercadopago";

let _mp: MercadoPagoConfig | null = null;
export function getMpClient(): MercadoPagoConfig {
  if (!_mp) {
    _mp = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN!,
    });
  }
  return _mp;
}

export interface MpWebhookEnvelope {
  type: string;
  dataId: string;
}

export function parseWebhookEnvelope(body: string): MpWebhookEnvelope | null {
  try {
    const parsed = JSON.parse(body) as {
      type?: string;
      data?: { id?: string };
    };
    const type = parsed.type ?? "";
    const dataId = String(parsed.data?.id ?? "");
    if (!type) return null;
    return { type, dataId };
  } catch {
    return null;
  }
}

// Verifies MercadoPago's HMAC signature on a webhook request. Strict by
// default: in any non-development environment a missing MP_WEBHOOK_SECRET
// is treated as a misconfiguration and the request is rejected. Dev mode
// allows the secret to be absent so `next dev` + curl works locally.
export function verifyMpSignature(req: Request, body: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "MP webhook: signature verification skipped — MP_WEBHOOK_SECRET not set (dev only)",
      );
      return true;
    }
    console.error("MP webhook rejected: MP_WEBHOOK_SECRET not configured");
    return false;
  }

  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");
  if (!xSignature || !xRequestId) {
    console.warn("MP webhook missing signature headers:", {
      hasSignature: !!xSignature,
      hasRequestId: !!xRequestId,
    });
    return false;
  }

  // x-signature is a comma-separated list of `k=v` segments (e.g.
  // `ts=1700000000,v1=abc...`). Split on the first `=` so values
  // containing `=` (uncommon but legal in some hash encodings) survive,
  // and skip any segment that doesn't have one — a malformed segment
  // shouldn't crash the request with a 500.
  const parts: Record<string, string> = {};
  for (const segment of xSignature.split(",")) {
    const eq = segment.indexOf("=");
    if (eq < 0) continue;
    const k = segment.slice(0, eq).trim();
    const v = segment.slice(eq + 1).trim();
    if (k) parts[k] = v;
  }

  const ts = parts.ts;
  const hash = parts.v1;
  if (!ts || !hash) return false;

  let dataId: string;
  try {
    const parsed = JSON.parse(body);
    dataId = String(parsed.data?.id ?? "");
  } catch {
    return false;
  }

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");

  // Constant-time comparison. timingSafeEqual throws on length mismatch,
  // so guard up front; a length mismatch is a definitive "no match"
  // anyway and never reveals secret bytes by branching on them.
  if (hash.length !== expected.length) {
    console.warn("MP webhook signature mismatch:", {
      dataId,
      xRequestId,
      ts,
    });
    return false;
  }

  const matches = timingSafeEqual(Buffer.from(hash), Buffer.from(expected));
  if (!matches) {
    console.warn("MP webhook signature mismatch:", {
      dataId,
      xRequestId,
      ts,
    });
    return false;
  }

  return true;
}

export type MpFlow = "sinergia" | "brote";

// Decides which flow handler should process a payment. New preferences
// stamp `metadata.flow` directly; legacy preferences (created before
// the unified dispatcher landed) are matched on `metadata.type` and
// the `external_reference` prefix as a fallback. Returns null when no
// signal is recognized — the dispatcher then logs and 200s so MP
// stops retrying.
export function resolveMpFlow(payment: {
  metadata?: Record<string, unknown> | null;
  external_reference?: string | null;
}): MpFlow | null {
  const metadata = (payment.metadata ?? {}) as Record<string, unknown>;

  if (metadata.flow === "sinergia") return "sinergia";
  if (metadata.flow === "brote") return "brote";

  if (metadata.type === "sinergia-donation") return "sinergia";
  if (metadata.type === "ticket") return "brote";

  const externalRef =
    typeof payment.external_reference === "string"
      ? payment.external_reference
      : "";
  if (externalRef.startsWith("SIN-")) return "sinergia";
  if (externalRef.startsWith("BROTE-")) return "brote";

  return null;
}
