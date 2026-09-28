import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { AdminSession } from "@/lib/admin-auth";

// DB-backed: GET /api/admin/desafio + PUT /api/admin/desafio/days/[day].
// The event id is mocked to a test-owned key so nothing here can touch the
// real desafío row on the shared branch.

const EVENT = "test-desafio-evt";

vi.mock("@/data/desafio", async (orig) => ({
  ...(await orig<typeof import("@/data/desafio")>()),
  DESAFIO_EVENT_ID: "test-desafio-evt",
}));

const OWNER: AdminSession = {
  email: "owner@example.com",
  userId: null,
  role: "owner",
  scope: "all",
  allowedEventIds: [],
  createdAt: new Date().toISOString(),
};
const EDITOR_OTHER: AdminSession = {
  email: "editor@example.com",
  userId: 9101,
  role: "editor",
  scope: "scoped",
  allowedEventIds: ["some-other-event"],
  createdAt: new Date().toISOString(),
};
const VIEWER_WITH: AdminSession = {
  email: "viewer@example.com",
  userId: 9102,
  role: "viewer",
  scope: "scoped",
  allowedEventIds: [EVENT],
  createdAt: new Date().toISOString(),
};

let currentSession: AdminSession | null = OWNER;

vi.mock("@/lib/admin-api-auth", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/admin-api-auth")>();
  return {
    ...actual,
    requireAdminSession: async (
      _req: Request,
      opts: { minRole?: "viewer" | "editor" | "owner" } = {},
    ) => {
      const { NextResponse } = await import("next/server");
      if (!currentSession) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }
      const rank = { viewer: 0, editor: 1, owner: 2 } as const;
      if (opts.minRole && rank[currentSession.role] < rank[opts.minRole]) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return currentSession;
    },
  };
});

const { GET } = await import("./route");
const { PUT } = await import("./days/[day]/route");

async function sweep() {
  await db.execute(sql`DELETE FROM challenge_days WHERE event_id = ${EVENT}`);
  await db.execute(sql`DELETE FROM events WHERE id = ${EVENT}`);
}

beforeAll(sweep);
afterAll(sweep);
beforeEach(async () => {
  currentSession = OWNER;
  await sweep();
});

const getReq = () => new Request("http://localhost/api/admin/desafio");
function put(day: string, body: unknown) {
  return PUT(
    new Request(`http://localhost/api/admin/desafio/days/${day}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ day }) },
  );
}

describe("GET /api/admin/desafio", () => {
  it("401 without a session", async () => {
    currentSession = null;
    expect((await GET(getReq())).status).toBe(401);
  });

  it("owner gets all 15 days and the event row is created lazily", async () => {
    const res = await GET(getReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.event.id).toBe(EVENT);
    expect(body.days).toHaveLength(15);
    expect(body.days[0]).toMatchObject({
      dia: 1,
      titulo: "",
      meditacionVideo: "",
      publicado: false,
      visible: false,
    });
    expect(body.counts).toEqual({ published: 0 });

    const ev = await db.execute<{ landing_path: string; type: string }>(
      sql`SELECT landing_path, type FROM events WHERE id = ${EVENT}`,
    );
    expect(ev.rows[0]).toMatchObject({ landing_path: "/es/desafio", type: "desafio" });
  });

  it("404 for a scoped editor without the event", async () => {
    currentSession = EDITOR_OTHER;
    expect((await GET(getReq())).status).toBe(404);
  });

  it("200 for a scoped viewer with the event", async () => {
    currentSession = VIEWER_WITH;
    expect((await GET(getReq())).status).toBe(200);
  });
});

describe("PUT /api/admin/desafio/days/[day]", () => {
  const valid = {
    titulo: "Llegar al cuerpo",
    intro: "Texto del día",
    introVideo: "",
    meditacion: "Meditación de la luna llena",
    meditacionVideo: "https://youtu.be/sq9Ug1hrqW4",
    duracion: "18 min",
    reflexion: "¿Cómo te sentís?",
    reflexionVideo: "https://www.youtube.com/shorts/J1MwcuRU0r8",
    publicado: true,
  };

  it("403 for a viewer", async () => {
    currentSession = VIEWER_WITH;
    expect((await put("1", valid)).status).toBe(403);
  });

  it("404 for a scoped editor without access", async () => {
    currentSession = EDITOR_OTHER;
    expect((await put("1", valid)).status).toBe(404);
  });

  it.each(["0", "16", "x"])("400 for day %s", async (day) => {
    const res = await put(day, valid);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Día inválido" });
  });

  it("400 for a non-YouTube video URL", async () => {
    const res = await put("1", { ...valid, meditacionVideo: "javascript:alert(1)" });
    expect(res.status).toBe(400);
  });

  it("400 for a 121-char title", async () => {
    expect((await put("1", { ...valid, titulo: "x".repeat(121) })).status).toBe(400);
  });

  it("400 when publishing without a title", async () => {
    const res = await put("1", { ...valid, titulo: "" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Para publicar, el día necesita un título");
  });

  it("stores every design field, upserts in place and GET reflects it", async () => {
    const first = await put("2", valid);
    expect(first.status).toBe(200);
    expect((await first.json()).day).toEqual({
      dia: 2,
      ...valid,
      visible: true,
      updatedAt: expect.any(String),
      updatedByEmail: OWNER.email,
    });

    const cols = await db.execute(sql`
      SELECT title, body, intro_video_url, meditation_title, media_url,
             duration_label, reflection, reflection_video_url, published
      FROM challenge_days WHERE event_id = ${EVENT} AND day_number = 2
    `);
    expect(cols.rows[0]).toEqual({
      title: valid.titulo,
      body: valid.intro,
      intro_video_url: null,
      meditation_title: valid.meditacion,
      media_url: valid.meditacionVideo,
      duration_label: valid.duracion,
      reflection: valid.reflexion,
      reflection_video_url: valid.reflexionVideo,
      published: true,
    });

    const second = await put("2", { ...valid, titulo: "Otro título", publicado: false });
    expect(second.status).toBe(200);

    const rows = await db.execute<{ title: string; updated_by_email: string }>(
      sql`SELECT title, updated_by_email FROM challenge_days WHERE event_id = ${EVENT}`,
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]).toEqual({ title: "Otro título", updated_by_email: OWNER.email });

    const body = await (await GET(getReq())).json();
    expect(body.days[1]).toMatchObject({
      titulo: "Otro título",
      publicado: false,
      visible: false,
    });
    expect(body.counts.published).toBe(0);
  });
});
