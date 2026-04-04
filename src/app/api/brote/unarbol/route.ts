import { NextResponse } from "next/server";

// BROTE event ended March 28, 2026. Un Árbol discount checkout disabled.

export async function POST() {
  return NextResponse.json(
    { error: "BROTE event has ended. Registration for tree planting is open at /brote" },
    { status: 410 },
  );
}

/* --- Original Un Árbol discount code (preserved for future events) ---

import { MercadoPagoConfig, Preference } from "mercadopago";
import { broteConfig } from "@/data/brote";

const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
});

const DISCOUNT_CODE = process.env.BROTE_UNARBOL_CODE || "MESUMOALPLANTEL";

// POST — validate code + checkout
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, code } = body as { action: string; code?: string };

    // ── Validate code ──
    if (action === "validate") {
      if (!code) {
        return NextResponse.json({ error: "Missing code" }, { status: 400 });
      }

      const valid = code.trim().toUpperCase() === DISCOUNT_CODE.toUpperCase();
      if (!valid) {
        return NextResponse.json({ valid: false, reason: "invalid" });
      }

      return NextResponse.json({ valid: true, code: code.trim().toUpperCase() });
    }

    // ── Checkout with valid code ──
    if (action === "checkout") {
      if (!code) {
        return NextResponse.json({ error: "Missing code" }, { status: 400 });
      }

      if (code.trim().toUpperCase() !== DISCOUNT_CODE.toUpperCase()) {
        return NextResponse.json(
          { error: "Invalid code" },
          { status: 403 },
        );
      }

      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL || "https://www.harisolaas.com";

      const preference = await new Preference(mp).create({
        body: {
          items: [
            {
              id: "brote-ticket-unarbol",
              title: "BROTE — Entrada Comunidad Un Árbol",
              quantity: 1,
              unit_price: broteConfig.unArbolPriceRaw,
              currency_id: broteConfig.currency,
            },
          ],
          back_urls: {
            success: `${baseUrl}/es/brote/success`,
            failure: `${baseUrl}/es/brote/failure`,
            pending: `${baseUrl}/es/brote/failure`,
          },
          auto_return: "approved",
          notification_url: `${baseUrl}/api/brote/webhook`,
          metadata: { type: "ticket", source: "unarbol" },
        },
      });

      const url =
        process.env.NODE_ENV === "development"
          ? preference.sandbox_init_point
          : preference.init_point;

      return NextResponse.json({ init_point: url });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Un Árbol API error:", error);
    return NextResponse.json(
      { error: "Server error", message: String(error) },
      { status: 500 },
    );
  }
}
*/
