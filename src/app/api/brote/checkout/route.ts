import { NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { broteConfig } from "@/data/brote";

const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
});

export async function POST(req: Request) {
  try {
    const { type } = (await req.json()) as { type: "ticket" | "donation" };

    const isTicket = type === "ticket";

    // Early bird: check if we're before the deadline (end of day Argentina time, UTC-3)
    const deadline = new Date(broteConfig.earlyBirdDeadline + "T23:59:59-03:00");
    const isEarlyBird = isTicket && new Date() <= deadline;

    const price = isTicket
      ? (isEarlyBird ? broteConfig.earlyBirdPriceRaw : broteConfig.ticketPriceRaw)
      : broteConfig.donationPriceRaw;
    const title = isTicket
      ? `BROTE — Entrada${isEarlyBird ? " (Preventa)" : ""}`
      : "BROTE — Donacion (1 arbol)";
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://harisolaas.com";

    const preference = await new Preference(mp).create({
      body: {
        items: [
          {
            id: `brote-${type}`,
            title,
            quantity: 1,
            unit_price: price,
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
        metadata: { type },
      },
    });

    const url = process.env.NODE_ENV === "development"
      ? preference.sandbox_init_point
      : preference.init_point;

    return NextResponse.json({ init_point: url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout" },
      { status: 500 },
    );
  }
}
