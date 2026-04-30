import { WabaClientError } from "./types";

// Pinned Graph API version. Bumping this is a breaking change — read
// the WABA changelog and check the templates / messages API surface
// for behavior changes before updating.
export const WABA_GRAPH_VERSION = "v25.0";

export const WABA_GRAPH_BASE_URL = `https://graph.facebook.com/${WABA_GRAPH_VERSION}`;

/**
 * Configuration required to talk to Meta's Graph API on the WABA side.
 * Read lazily so a missing env var doesn't crash unrelated code paths
 * at import time — only the WABA-touching routes need this resolved.
 */
export interface WabaConfig {
  phoneNumberId: string;
  businessAccountId: string;
  apiToken: string;
  appSecret: string; // for inbound webhook HMAC verification
  webhookVerifyToken: string; // for the GET handshake on /api/waba/webhook
}

export function readWabaConfig(): WabaConfig {
  const phoneNumberId = process.env.WABA_PHONE_NUMBER_ID;
  const businessAccountId = process.env.WABA_BUSINESS_ACCOUNT_ID;
  const apiToken = process.env.WABA_API_TOKEN;
  const appSecret = process.env.WABA_APP_SECRET;
  const webhookVerifyToken = process.env.WABA_WEBHOOK_VERIFY_TOKEN;

  const missing: string[] = [];
  if (!phoneNumberId) missing.push("WABA_PHONE_NUMBER_ID");
  if (!businessAccountId) missing.push("WABA_BUSINESS_ACCOUNT_ID");
  if (!apiToken) missing.push("WABA_API_TOKEN");
  if (!appSecret) missing.push("WABA_APP_SECRET");
  if (!webhookVerifyToken) missing.push("WABA_WEBHOOK_VERIFY_TOKEN");

  if (missing.length > 0) {
    throw new WabaClientError(
      `WABA is not configured. Missing env: ${missing.join(", ")}`,
      null,
      null,
      null,
      { missing },
    );
  }

  return {
    phoneNumberId: phoneNumberId!,
    businessAccountId: businessAccountId!,
    apiToken: apiToken!,
    appSecret: appSecret!,
    webhookVerifyToken: webhookVerifyToken!,
  };
}

/**
 * Read the webhook verify token + app secret without requiring the
 * messaging-side credentials. The webhook route can boot in
 * environments where the send credentials haven't been provisioned
 * yet, so we avoid forcing the full readWabaConfig() check there.
 */
export function readWabaWebhookSecrets(): {
  appSecret: string;
  webhookVerifyToken: string;
} {
  const appSecret = process.env.WABA_APP_SECRET;
  const webhookVerifyToken = process.env.WABA_WEBHOOK_VERIFY_TOKEN;
  const missing: string[] = [];
  if (!appSecret) missing.push("WABA_APP_SECRET");
  if (!webhookVerifyToken) missing.push("WABA_WEBHOOK_VERIFY_TOKEN");
  if (missing.length > 0) {
    throw new WabaClientError(
      `WABA webhook is not configured. Missing env: ${missing.join(", ")}`,
      null,
      null,
      null,
      { missing },
    );
  }
  return { appSecret: appSecret!, webhookVerifyToken: webhookVerifyToken! };
}
