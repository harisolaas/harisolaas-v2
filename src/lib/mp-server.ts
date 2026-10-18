import { createHmac } from "crypto";
import { MercadoPagoConfig } from "mercadopago";

// Shared MercadoPago server helpers for new flows. Every MP flow uses one
// access token and one webhook secret. The existing BROTE / Sinergia routes
// keep their own copies on purpose — moving them is a separate change.

let _mp: MercadoPagoConfig | null = null;
/** Lazy singleton: instantiating at import time breaks `next build`. */
export function getMp(): MercadoPagoConfig {
  if (!_mp) {
    _mp = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN!,
    });
  }
  return _mp;
}

/**
 * Strict MP webhook HMAC check (same rules as the Sinergia webhook).
 *
 * `dataId` is the `data.id` the caller parsed from the body — the signed
 * manifest is `id:{dataId};request-id:{x-request-id};ts:{ts};`.
 * A missing MP_WEBHOOK_SECRET is only tolerated under `next dev`; anywhere
 * else it is a misconfiguration and every request is rejected.
 */
export function verifyMpSignature(req: Request, dataId: string): boolean {
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

  const parts = Object.fromEntries(
    xSignature.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim() ?? "", v?.trim() ?? ""];
    }),
  );

  const ts = parts.ts;
  const hash = parts.v1;
  if (!ts || !hash) return false;

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");

  if (hash !== expected) {
    console.warn("MP webhook signature mismatch:", { dataId, xRequestId, ts });
    return false;
  }

  return true;
}
