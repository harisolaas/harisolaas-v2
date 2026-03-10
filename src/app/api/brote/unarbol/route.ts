import { NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { getRedis } from "@/lib/redis";
import { broteConfig } from "@/data/brote";
import { nanoid } from "nanoid";

const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
});

function auth(req: Request): boolean {
  const secret = req.headers.get("authorization");
  return secret === `Bearer ${process.env.BROTE_ADMIN_SECRET}`;
}

const PREFIX = "brote:unarbol:";

// POST — validate code + checkout, or admin actions
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body as { action: string };
    const redis = await getRedis();

    // ── Admin: generate codes ──
    if (action === "generate") {
      if (!auth(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const count = Math.min(body.count || 10, 100);
      const codes: string[] = [];
      for (let i = 0; i < count; i++) {
        const code = `UNARBOL-${nanoid(6).toUpperCase()}`;
        await redis.set(`${PREFIX}${code}`, "valid");
        codes.push(code);
      }
      return NextResponse.json({ ok: true, codes });
    }

    // ── Admin: reset a used code ──
    if (action === "reset") {
      if (!auth(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const { code } = body as { code: string };
      const status = await redis.get(`${PREFIX}${code}`);
      if (!status) {
        return NextResponse.json({ error: "Code not found" }, { status: 404 });
      }
      await redis.set(`${PREFIX}${code}`, "valid");
      return NextResponse.json({ ok: true, code, status: "valid" });
    }

    // ── Public: validate code ──
    if (action === "validate") {
      const { code } = body as { code: string };
      if (!code) {
        return NextResponse.json({ error: "Missing code" }, { status: 400 });
      }

      const normalized = code.trim().toUpperCase();
      const status = await redis.get(`${PREFIX}${normalized}`);

      if (!status) {
        return NextResponse.json({ valid: false, reason: "invalid" });
      }
      if (status === "used") {
        return NextResponse.json({ valid: false, reason: "used" });
      }

      return NextResponse.json({ valid: true, code: normalized });
    }

    // ── Public: checkout with valid code ──
    if (action === "checkout") {
      const { code } = body as { code: string };
      if (!code) {
        return NextResponse.json({ error: "Missing code" }, { status: 400 });
      }

      const normalized = code.trim().toUpperCase();
      const status = await redis.get(`${PREFIX}${normalized}`);

      if (!status || status === "used") {
        return NextResponse.json(
          { error: "Invalid or used code" },
          { status: 403 },
        );
      }

      // Mark code as used
      await redis.set(`${PREFIX}${normalized}`, "used");

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
          metadata: { type: "ticket", source: "unarbol", code: normalized },
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

// GET — admin: list all codes
export async function GET(req: Request) {
  if (!auth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const redis = await getRedis();
    const keys = await redis.keys(`${PREFIX}*`);
    const codes: { code: string; status: string }[] = [];

    for (const key of keys) {
      const status = await redis.get(key);
      codes.push({
        code: key.replace(PREFIX, ""),
        status: status || "unknown",
      });
    }

    codes.sort((a, b) => a.code.localeCompare(b.code));

    const valid = codes.filter((c) => c.status === "valid").length;
    const used = codes.filter((c) => c.status === "used").length;

    return NextResponse.json({ total: codes.length, valid, used, codes });
  } catch (error) {
    console.error("Un Árbol GET error:", error);
    return NextResponse.json(
      { error: "Server error", message: String(error) },
      { status: 500 },
    );
  }
}
