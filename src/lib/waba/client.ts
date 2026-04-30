import { WabaClientError } from "./types";
import { WABA_GRAPH_BASE_URL, readWabaConfig, type WabaConfig } from "./config";

// Low-level Graph HTTP wrapper. Higher-level send / template-management
// helpers live in `send.ts` and `template-api.ts` and call into this.

interface GraphFetchOptions {
  method: "GET" | "POST" | "DELETE";
  path: string; // path beneath the version prefix, e.g. "/{phoneNumberId}/messages"
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  config?: WabaConfig; // injectable for tests / pre-resolved configs
}

export async function graphFetch<T = unknown>(
  opts: GraphFetchOptions,
): Promise<T> {
  const config = opts.config ?? readWabaConfig();
  const url = buildUrl(opts.path, opts.query);

  const init: RequestInit = {
    method: opts.method,
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      ...(opts.body !== undefined && { "Content-Type": "application/json" }),
    },
  };
  if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new WabaClientError(
      `Graph fetch failed: ${message}`,
      null,
      null,
      null,
      err,
    );
  }

  // Meta uses application/json across the board; even errors come
  // back as JSON.
  let payload: unknown = null;
  const text = await res.text();
  if (text.length > 0) {
    try {
      payload = JSON.parse(text);
    } catch {
      // Treat unparseable responses as a hard failure regardless of
      // status code — better than silently returning {} and letting
      // a downstream destructure crash with no context.
      throw new WabaClientError(
        `Graph response was not valid JSON (${res.status}): ${text.slice(0, 200)}`,
        res.status,
        null,
        null,
        text,
      );
    }
  }

  if (!res.ok) {
    const errObj = (payload as { error?: GraphErrorBody } | null)?.error;
    throw new WabaClientError(
      errObj?.message
        ? `Graph ${res.status}: ${errObj.message}`
        : `Graph ${res.status} (no error body)`,
      res.status,
      errObj?.code != null ? String(errObj.code) : null,
      errObj?.error_subcode != null ? String(errObj.error_subcode) : null,
      payload,
    );
  }

  return payload as T;
}

interface GraphErrorBody {
  message: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
}

function buildUrl(
  path: string,
  query?: Record<string, string | number | undefined>,
): string {
  const base = `${WABA_GRAPH_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return base;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined) continue;
    params.set(k, String(v));
  }
  const qs = params.toString();
  return qs.length === 0 ? base : `${base}?${qs}`;
}
