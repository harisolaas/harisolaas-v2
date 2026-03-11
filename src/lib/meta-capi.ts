interface UserData {
  client_ip_address?: string;
  client_user_agent?: string;
  fbp?: string;
  fbc?: string;
}

interface CustomData {
  currency?: string;
  value?: number;
  content_name?: string;
  content_category?: string;
}

interface MetaEvent {
  event_name: string;
  event_id: string;
  event_source_url: string;
  user_data?: UserData;
  custom_data?: CustomData;
}

const PIXEL_ID = process.env.META_PIXEL_ID;
const TOKEN = process.env.META_CAPI_TOKEN;
const API_VERSION = "v19.0";

/**
 * Send an event to Meta Conversions API.
 * Fails silently — never blocks the purchase/webhook flow.
 */
export async function sendMetaEvent(event: MetaEvent): Promise<void> {
  if (!PIXEL_ID || !TOKEN) {
    console.warn("Meta CAPI: missing PIXEL_ID or TOKEN, skipping event:", event.event_name);
    return;
  }

  const payload = {
    data: [
      {
        event_name: event.event_name,
        event_time: Math.floor(Date.now() / 1000),
        event_id: event.event_id,
        event_source_url: event.event_source_url,
        action_source: "website" as const,
        user_data: event.user_data ?? {},
        custom_data: event.custom_data ?? {},
      },
    ],
  };

  try {
    const url = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${TOKEN}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Meta CAPI error:", res.status, text);
    }
  } catch (err) {
    console.error("Meta CAPI fetch failed:", err);
  }
}
