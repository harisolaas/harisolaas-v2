import { createHmac } from "crypto";
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

  const parts = Object.fromEntries(
    xSignature.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k.trim(), v.trim()];
    }),
  );

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

  if (hash !== expected) {
    console.warn("MP webhook signature mismatch:", {
      dataId,
      xRequestId,
      ts,
    });
    return false;
  }

  return true;
}
