import { NextResponse } from "next/server";
import { Payment } from "mercadopago";
import {
  getMpClient,
  parseWebhookEnvelope,
  resolveMpFlow,
  verifyMpSignature,
} from "@/lib/mp-webhook";
import { handleSinergiaPayment } from "@/lib/mp-flows/sinergia";
import { handleBrotePayment } from "@/lib/mp-flows/brote";

// Single MercadoPago webhook for all payment flows. Verifies HMAC,
// fetches the payment once to read its metadata, then dispatches to
// the matching per-flow handler. Each handler owns its own idempotency
// + business logic so the dispatcher stays a thin router.
export async function POST(req: Request) {
  const body = await req.text();

  if (!verifyMpSignature(req, body)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const envelope = parseWebhookEnvelope(body);
  if (!envelope) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (envelope.type !== "payment") {
    return NextResponse.json({ ok: true });
  }

  const mpPaymentId = envelope.dataId;
  if (!mpPaymentId) {
    return NextResponse.json({ error: "No payment id" }, { status: 400 });
  }

  // Fetch the payment to decide routing. The matched handler will
  // re-fetch inside its own idempotency-protected critical section —
  // that's intentional, so handlers can keep their atomic Redis NX
  // claims without the dispatcher needing to reason about each flow's
  // race semantics. Cost: one extra MP GET per delivery.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let payment: any;
  try {
    payment = await new Payment(getMpClient()).get({ id: mpPaymentId });
  } catch (err) {
    // Payment fetch can fail transiently. Return 200 so MP retries on
    // its normal cadence rather than escalating this delivery as failed.
    console.error("MP dispatcher payment fetch failed:", mpPaymentId, err);
    return NextResponse.json({ error: "Payment not found" }, { status: 200 });
  }

  const flow = resolveMpFlow(payment);
  if (!flow) {
    console.warn("MP dispatcher: unrecognized flow for payment", {
      mpPaymentId,
      metadata: payment.metadata,
      external_reference: payment.external_reference,
    });
    return NextResponse.json({ ok: true, status: "unrecognized" });
  }

  switch (flow) {
    case "sinergia":
      return handleSinergiaPayment({ mpPaymentId });
    case "brote":
      return handleBrotePayment({ mpPaymentId, req });
  }
}
