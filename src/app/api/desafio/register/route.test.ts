import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db";

// DB-backed: POST /api/desafio/register. Resend is mocked (never hit the
// real API) and the event id points at a test-owned row.

const EVENT = "test-desafio-evt";
const EMAIL_PREFIX = "test-desafio-reg-";

const h = vi.hoisted(() => ({
  send: vi.fn<(msg: unknown) => Promise<unknown>>(async () => ({
    data: { id: "r1" },
    error: null,
  })),
  registrationOpen: true,
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: h.send };
  },
}));

vi.mock("@/data/desafio", async (orig) => ({
  ...(await orig<typeof import("@/data/desafio")>()),
  DESAFIO_EVENT_ID: "test-desafio-evt",
  isRegistrationOpen: () => h.registrationOpen,
}));

const { POST } = await import("./route");

let ipCounter = 0;
function register(body: unknown, ip?: string) {
  return POST(
    new Request("http://localhost/api/desafio/register", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // The limiter is 5/IP — unique IP per request unless a test says otherwise.
        "x-forwarded-for": ip ?? `10.77.0.${++ipCounter}`,
      },
      body: JSON.stringify(body),
    }),
  );
}

const valid = (suffix: string) => ({
  name: "Luz Test",
  email: `${EMAIL_PREFIX}${suffix}@example.com`,
  phone: "11 2255 5110",
  locale: "es",
});

// This suite never writes challenge_days; the events delete cascades to it.
async function sweep() {
  await db.execute(sql`
    DELETE FROM participations
    WHERE event_id = ${EVENT}
       OR person_id IN (SELECT id FROM people WHERE email LIKE ${EMAIL_PREFIX + "%"})
  `);
  await db.execute(sql`DELETE FROM people WHERE email LIKE ${EMAIL_PREFIX + "%"}`);
  await db.execute(sql`DELETE FROM events WHERE id = ${EVENT}`);
}

beforeAll(async () => {
  vi.stubEnv("DESAFIO_NOTIFY_EMAILS", "host@example.com");
  await sweep();
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await sweep();
});
beforeEach(async () => {
  h.registrationOpen = true;
  h.send.mockClear();
  await sweep();
});
afterEach(() => {
  h.registrationOpen = true;
});

describe("POST /api/desafio/register", () => {
  it.each([
    ["missing name", { ...valid("a"), name: "  " }],
    ["overlong name", { ...valid("a"), name: "x".repeat(121) }],
    ["bad email", { ...valid("a"), email: "nope@x" }],
    ["bad phone", { ...valid("a"), phone: "123" }],
    ["a JSON null body", null],
    ["a JSON array body", [valid("a")]],
  ])("400 for %s", async (_label, body) => {
    const res = await register(body);
    expect(res.status).toBe(400);
    expect(h.send).not.toHaveBeenCalled();
  });

  it("409 closed once registration is over", async () => {
    h.registrationOpen = false;
    const res = await register(valid("closed"));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, closed: true });
  });

  it("registers, stores the phone and sends both emails", async () => {
    const res = await register(valid("fresh"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.participationId).toMatch(/^DES-/);
    expect(body.alreadyRegistered).toBeUndefined();

    const rows = await db.execute<{ role: string; status: string; phone: string }>(sql`
      SELECT p.role, p.status, people.phone
      FROM participations p JOIN people ON people.id = p.person_id
      WHERE p.event_id = ${EVENT}
    `);
    expect(rows.rows).toEqual([
      { role: "participant", status: "confirmed", phone: "11 2255 5110" },
    ]);

    expect(h.send).toHaveBeenCalledTimes(2);
    const [confirm, hostMail] = h.send.mock.calls.map(
      (c) => c[0] as { to: string | string[]; html: string },
    );
    expect(confirm.to).toBe(`${EMAIL_PREFIX}fresh@example.com`);
    expect(confirm.html).toContain("/es/desafio");
    expect(hostMail.to).toEqual(["host@example.com"]);
    expect(hostMail.html).toContain("https://wa.me/5491122555110");
  });

  it("a repeat registration is flagged and sends nothing", async () => {
    await register(valid("repeat"));
    h.send.mockClear();
    const res = await register(valid("repeat"));
    expect(res.status).toBe(200);
    expect((await res.json()).alreadyRegistered).toBe(true);
    expect(h.send).not.toHaveBeenCalled();
  });

  it("429 on the 6th request from the same IP", async () => {
    const ip = "10.78.0.1";
    for (let i = 0; i < 5; i++) {
      expect((await register({ name: "" }, ip)).status).toBe(400);
    }
    expect((await register({ name: "" }, ip)).status).toBe(429);
  });
});
