import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  assertFullAccess,
  requireAdminSession,
} from "@/lib/admin-api-auth";
import {
  resubmitTemplate,
  syncWabaTemplates,
} from "@/lib/waba/sync";
import { deleteTemplate } from "@/lib/waba/template-api";
import { listTemplateDefinitions } from "@/lib/waba/templates";
import { hashTemplateDefinition } from "@/lib/waba/hash";
import { WabaClientError } from "@/lib/waba/types";

// Template lifecycle endpoint.
//
// GET                       — list local + Meta state per template.
// POST {action: "sync"}      — push local changes upstream + pull
//                              Meta-side state (statuses, quality, etc).
// POST {action: "resubmit", name} — force-edit a template after a
//                              rejection or pause is unblocked.
// POST {action: "delete", name}   — DELETE on Meta (30-day name lock!)
//                              and drop the local row.
//
// All actions are global ops (templates aren't scoped to events) and
// require an editor session.

export async function GET(req: Request) {
  const session = await requireAdminSession(req, { minRole: "viewer" });
  if (session instanceof NextResponse) return session;
  const denied = assertFullAccess(session);
  if (denied) return denied;

  const definitions = listTemplateDefinitions();
  const rows = await db.select().from(schema.whatsappTemplates);
  const rowByName = new Map(rows.map((r) => [r.name, r] as const));

  const items = definitions.map((def) => {
    const localHash = hashTemplateDefinition(def);
    const row = rowByName.get(def.name);
    return {
      name: def.name,
      category: def.category,
      language: def.language,
      definitionHash: localHash,
      hashChangedSinceSubmit:
        row?.localDefinitionHash != null && row.localDefinitionHash !== localHash,
      meta: row
        ? {
            metaTemplateId: row.metaTemplateId,
            status: row.status,
            qualityScore: row.qualityScore,
            rejectionReason: row.rejectionReason,
            submittedAt: row.submittedAt,
            lastStatusAt: row.lastStatusAt,
          }
        : null,
      variableNames: row?.variableNames ?? null,
      components: def.components,
    };
  });

  // Surface DB rows whose registry entry was removed so the operator
  // can clean them up — same shape as the orphaned-meta entries from
  // sync, but for the local side.
  const knownNames = new Set(definitions.map((d) => d.name));
  const orphans = rows
    .filter((r) => !knownNames.has(r.name))
    .map((r) => ({
      name: r.name,
      reason: "DB row exists but no local definition. Add one or run a delete action.",
      meta: {
        metaTemplateId: r.metaTemplateId,
        status: r.status,
        category: r.category,
        language: r.language,
      },
    }));

  return NextResponse.json({ ok: true, items, orphans });
}

export async function POST(req: Request) {
  const session = await requireAdminSession(req, { minRole: "editor" });
  if (session instanceof NextResponse) return session;
  const denied = assertFullAccess(session);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const action = body.action as string | undefined;

  try {
    if (action === "sync") {
      const report = await syncWabaTemplates();
      return NextResponse.json({ ok: report.ok, report });
    }

    if (action === "resubmit") {
      const name = (body.name as string | undefined)?.trim();
      if (!name) {
        return NextResponse.json(
          { error: "name required" },
          { status: 400 },
        );
      }
      const entry = await resubmitTemplate(name);
      return NextResponse.json({ ok: !entry.error, entry });
    }

    if (action === "delete") {
      const name = (body.name as string | undefined)?.trim();
      if (!name) {
        return NextResponse.json(
          { error: "name required" },
          { status: 400 },
        );
      }
      // Both sides: Meta first (so a Meta error blocks the local
      // delete and the operator can retry), then the DB row. Mark
      // the row pending_deletion before the network call so a
      // crash mid-flight leaves a clear breadcrumb.
      await db
        .update(schema.whatsappTemplates)
        .set({ status: "pending_deletion", updatedAt: sql`NOW()` })
        .where(eq(schema.whatsappTemplates.name, name));
      try {
        await deleteTemplate(name);
      } catch (err) {
        // Roll the local status back so the next sync can recover.
        await db
          .update(schema.whatsappTemplates)
          .set({ status: "approved", updatedAt: sql`NOW()` })
          .where(eq(schema.whatsappTemplates.name, name));
        throw err;
      }
      await db
        .delete(schema.whatsappTemplates)
        .where(eq(schema.whatsappTemplates.name, name));
      return NextResponse.json({
        ok: true,
        deleted: name,
        note: "Meta locks the name for 30 days. Re-creating immediately will fail.",
      });
    }

    return NextResponse.json(
      { error: "Unknown action. Expected: sync | resubmit | delete." },
      { status: 400 },
    );
  } catch (err) {
    if (err instanceof WabaClientError) {
      return NextResponse.json(
        {
          error: err.message,
          statusCode: err.statusCode,
          metaErrorCode: err.metaErrorCode,
          metaErrorSubcode: err.metaErrorSubcode,
        },
        { status: err.statusCode === 401 ? 502 : 500 },
      );
    }
    console.error("waba/templates POST error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
