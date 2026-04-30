import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  assertFullAccess,
  requireAdminSession,
} from "@/lib/admin-api-auth";
import { isValidWhatsApp, phoneToWaMe } from "@/lib/plant-types";
import { sendBulkWabaTemplate } from "@/lib/waba/bulk-send";
import { extractVariableNames } from "@/lib/waba/hash";
import { getLocalTemplateStatus } from "@/lib/waba/send";
import { getTemplateDefinition } from "@/lib/waba/templates";
import { WabaClientError, WabaTemplateNotApprovedError } from "@/lib/waba/types";

// Ad-hoc broadcast: send an APPROVED template to a defined audience.
//
// Audience is one of:
//   - { eventId }              — every confirmed participation on that event
//   - { personIds: number[] }  — explicit list of people row ids
//
// Variables are STATIC across the broadcast except for `{{name}}`,
// which is pulled per-recipient from `people.name`. Anything else
// the template expects must be supplied in `variables`.
//
// Preview mode returns the resolved audience (size + first 10) plus
// the variables that would be substituted, without sending anything.

const MAX_AUDIENCE = 500;

export async function POST(req: Request) {
  const session = await requireAdminSession(req, { minRole: "editor" });
  if (session instanceof NextResponse) return session;
  const denied = assertFullAccess(session);
  if (denied) return denied;

  let body: BroadcastBody;
  try {
    body = (await req.json()) as BroadcastBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const mode = body.mode === "send" ? "send" : "preview";
  const templateName = (body.templateName ?? "").trim();
  if (!templateName) {
    return NextResponse.json(
      { error: "templateName required" },
      { status: 400 },
    );
  }

  const template = getTemplateDefinition(templateName);
  if (!template) {
    return NextResponse.json(
      {
        error: `Unknown template "${templateName}". Add a definition under src/lib/waba/templates/.`,
      },
      { status: 404 },
    );
  }

  // Variable shape check up front — fail loud before any DB work.
  const expected = extractVariableNames(template);
  const staticVars = (body.variables ?? {}) as Record<string, string>;
  const missing = expected.filter(
    (k) => k !== "name" && !(k in staticVars),
  );
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: `Missing template variables: ${missing.join(", ")}. Pass them in "variables".`,
        expected,
      },
      { status: 400 },
    );
  }

  // Resolve audience.
  const audienceResult = await resolveAudience(body.audience);
  if ("error" in audienceResult) {
    return NextResponse.json({ error: audienceResult.error }, { status: 400 });
  }
  const audience = audienceResult.rows;

  if (audience.length === 0) {
    return NextResponse.json(
      {
        ok: true,
        mode,
        audienceSize: 0,
        warning: "Audience resolved to zero recipients with valid phones.",
      },
      { status: 200 },
    );
  }
  if (audience.length > MAX_AUDIENCE) {
    return NextResponse.json(
      {
        error: `Audience too large (${audience.length} > ${MAX_AUDIENCE}). Narrow with eventId or personIds.`,
      },
      { status: 413 },
    );
  }

  if (mode === "preview") {
    const samplePerson = audience[0];
    return NextResponse.json({
      ok: true,
      mode: "preview",
      template: { name: template.name, language: template.language },
      audienceSize: audience.length,
      audienceSample: audience.slice(0, 10).map((a) => ({
        personId: a.personId,
        name: a.name,
        phone: phoneToWaMe(a.phone),
      })),
      sampleVariables: {
        ...staticVars,
        ...(expected.includes("name") ? { name: samplePerson.name } : {}),
      },
    });
  }

  // Send mode — gate on local template status before fanning out so
  // we don't rack up N per-recipient `template_not_approved` failures
  // when one pre-flight check would do.
  const status = await getLocalTemplateStatus(template.name);
  if (status !== "approved") {
    return NextResponse.json(
      {
        error: `Template "${template.name}" is not approved (status: ${status}). Sync + wait for Meta approval, then retry.`,
      },
      { status: 409 },
    );
  }

  const campaign = (body.campaign ?? `broadcast-${Date.now()}`).slice(0, 80);

  try {
    const result = await sendBulkWabaTemplate({
      audience,
      template,
      getTo: (a) => phoneToWaMe(a.phone),
      getPersonId: (a) => a.personId,
      buildVariables: (a) => ({
        ...staticVars,
        ...(expected.includes("name") ? { name: a.name } : {}),
      }),
      campaign,
      logPrefix: `broadcast-${template.name}`,
    });

    return NextResponse.json({
      ok: true,
      mode: "send",
      campaign,
      audienceSize: audience.length,
      sent: result.sent,
      skipped: result.skipped,
      failed: result.failed.length,
      warnings: result.warnings.length,
      failures: result.failed.slice(0, 20),
    });
  } catch (err) {
    if (err instanceof WabaTemplateNotApprovedError) {
      return NextResponse.json(
        { error: err.message },
        { status: 409 },
      );
    }
    if (err instanceof WabaClientError) {
      return NextResponse.json(
        {
          error: err.message,
          statusCode: err.statusCode,
          metaErrorCode: err.metaErrorCode,
        },
        { status: err.statusCode === 401 ? 502 : 500 },
      );
    }
    console.error("waba broadcast error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

interface BroadcastBody {
  mode?: "preview" | "send";
  templateName?: string;
  variables?: Record<string, string>;
  audience?: { eventId?: string; personIds?: number[] };
  campaign?: string;
}

interface AudienceRow {
  personId: number;
  name: string;
  phone: string;
}

type AudienceResult = { rows: AudienceRow[] } | { error: string };

async function resolveAudience(
  audience: BroadcastBody["audience"],
): Promise<AudienceResult> {
  if (!audience) {
    return { error: "audience required (eventId or personIds)" };
  }

  if (audience.eventId) {
    const rows = await db
      .select({
        personId: schema.people.id,
        name: schema.people.name,
        phone: schema.people.phone,
      })
      .from(schema.participations)
      .innerJoin(
        schema.people,
        eq(schema.people.id, schema.participations.personId),
      )
      .where(
        and(
          eq(schema.participations.eventId, audience.eventId),
          eq(schema.participations.status, "confirmed"),
        ),
      );
    return { rows: filterValidPhones(rows) };
  }

  if (audience.personIds && audience.personIds.length > 0) {
    const ids = audience.personIds.filter(
      (n): n is number => Number.isFinite(n) && n > 0,
    );
    if (ids.length === 0) {
      return { error: "personIds must be a non-empty array of positive numbers" };
    }
    const rows = await db
      .select({
        personId: schema.people.id,
        name: schema.people.name,
        phone: schema.people.phone,
      })
      .from(schema.people)
      .where(inArray(schema.people.id, ids));
    return { rows: filterValidPhones(rows) };
  }

  return { error: "audience must have eventId or personIds" };
}

function filterValidPhones(
  rows: Array<{ personId: number; name: string; phone: string | null }>,
): AudienceRow[] {
  const seen = new Set<number>();
  const out: AudienceRow[] = [];
  for (const r of rows) {
    if (seen.has(r.personId)) continue;
    if (!r.phone || !isValidWhatsApp(r.phone)) continue;
    seen.add(r.personId);
    out.push({ personId: r.personId, name: r.name, phone: r.phone });
  }
  return out;
}
