import { describe, expect, it, vi } from "vitest";
import type { CreateEmailOptions, CreateEmailResponse } from "resend";
import { sendBulkEmails, type BulkEmailSender } from "./bulk-email";

type Recipient = { email: string; name: string; rsvpId: string };

function makeSender(
  impl: (payload: CreateEmailOptions) => CreateEmailResponse | Promise<CreateEmailResponse>,
): BulkEmailSender & { calls: CreateEmailOptions[] } {
  const calls: CreateEmailOptions[] = [];
  return {
    calls,
    emails: {
      async send(payload) {
        calls.push(payload);
        return impl(payload);
      },
    },
  };
}

const ok = (id = "msg"): CreateEmailResponse =>
  ({ data: { id }, error: null, headers: null } as unknown as CreateEmailResponse);

const rateLimited = (): CreateEmailResponse =>
  ({
    data: null,
    error: {
      name: "rate_limit_exceeded",
      message: "Too many requests",
      statusCode: 429,
    },
    headers: null,
  } as unknown as CreateEmailResponse);

describe("sendBulkEmails", () => {
  it("counts a Resend 429 (non-throwing) response as failed, not sent", async () => {
    // This is the regression test for the 2026-04-19 incident.
    const sender = makeSender(() => rateLimited());
    const audience: Recipient[] = [
      { email: "a@x.com", name: "A", rsvpId: "1" },
      { email: "b@x.com", name: "B", rsvpId: "2" },
    ];
    const onSent = vi.fn();

    const result = await sendBulkEmails({
      audience,
      resend: sender,
      getEmail: (r) => r.email,
      build: (r) => ({ from: "x", to: r.email, subject: "s", html: "<p/>" }),
      onSent,
      throttleMs: 0,
    });

    expect(result.sent).toBe(0);
    expect(result.failed).toHaveLength(2);
    expect(result.failed[0]).toMatchObject({
      email: "a@x.com",
      error: { name: "rate_limit_exceeded", statusCode: 429 },
    });
    // Critical: onSent must NOT fire on a rate-limited response —
    // otherwise we'd set the idempotency flag for an email that never went out.
    expect(onSent).not.toHaveBeenCalled();
  });

  it("counts successful sends and invokes onSent for each", async () => {
    const sender = makeSender(() => ok());
    const audience: Recipient[] = [
      { email: "a@x.com", name: "A", rsvpId: "1" },
      { email: "b@x.com", name: "B", rsvpId: "2" },
    ];
    const onSent = vi.fn();

    const result = await sendBulkEmails({
      audience,
      resend: sender,
      getEmail: (r) => r.email,
      build: (r) => ({ from: "x", to: r.email, subject: "s", html: "<p/>" }),
      onSent,
      throttleMs: 0,
    });

    expect(result.sent).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.failed).toHaveLength(0);
    expect(onSent).toHaveBeenCalledTimes(2);
    expect(sender.calls).toHaveLength(2);
  });

  it("skips recipients for whom shouldSkip returns true", async () => {
    const sender = makeSender(() => ok());
    const audience: Recipient[] = [
      { email: "a@x.com", name: "A", rsvpId: "1" },
      { email: "b@x.com", name: "B", rsvpId: "2" },
    ];

    const result = await sendBulkEmails({
      audience,
      resend: sender,
      getEmail: (r) => r.email,
      build: (r) => ({ from: "x", to: r.email, subject: "s", html: "<p/>" }),
      shouldSkip: async (r) => r.rsvpId === "1",
      throttleMs: 0,
    });

    expect(result.skipped).toBe(1);
    expect(result.sent).toBe(1);
    expect(sender.calls).toHaveLength(1);
    expect(sender.calls[0].to).toBe("b@x.com");
  });

  it("captures thrown errors as failures without aborting the loop", async () => {
    let i = 0;
    const sender = makeSender(() => {
      i++;
      if (i === 1) throw new Error("network down");
      return ok();
    });
    const audience: Recipient[] = [
      { email: "a@x.com", name: "A", rsvpId: "1" },
      { email: "b@x.com", name: "B", rsvpId: "2" },
    ];

    const result = await sendBulkEmails({
      audience,
      resend: sender,
      getEmail: (r) => r.email,
      build: (r) => ({ from: "x", to: r.email, subject: "s", html: "<p/>" }),
      throttleMs: 0,
    });

    expect(result.sent).toBe(1);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toMatchObject({
      email: "a@x.com",
      error: { name: "thrown", message: "network down" },
    });
  });

  it("counts a delivered email as sent even when onSent throws", async () => {
    // Regression guard: a Redis hiccup in the idempotency callback must
    // not abort the campaign mid-flight, drop the current send from the
    // tally, or re-raise the error. The email already went out.
    const sender = makeSender(() => ok());
    const audience: Recipient[] = [
      { email: "a@x.com", name: "A", rsvpId: "1" },
      { email: "b@x.com", name: "B", rsvpId: "2" },
    ];
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const result = await sendBulkEmails({
        audience,
        resend: sender,
        getEmail: (r) => r.email,
        build: (r) => ({ from: "x", to: r.email, subject: "s", html: "<p/>" }),
        onSent: () => {
          throw new Error("redis down");
        },
        throttleMs: 0,
      });

      expect(result.sent).toBe(2);
      expect(result.failed).toHaveLength(0);
      expect(sender.calls).toHaveLength(2);
      // Loud log for each failed onSent so the flag corruption is visible.
      expect(
        errorSpy.mock.calls.some((args) =>
          String(args[0]).includes("onSent failed"),
        ),
      ).toBe(true);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("uses logPrefix when logging failures", async () => {
    const sender = makeSender(() => rateLimited());
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await sendBulkEmails({
        audience: [{ email: "a@x.com", name: "A", rsvpId: "1" }],
        resend: sender,
        getEmail: (r) => r.email,
        build: (r) => ({ from: "x", to: r.email, subject: "s", html: "<p/>" }),
        logPrefix: "custom-campaign",
        throttleMs: 0,
      });

      expect(
        errorSpy.mock.calls.some((args) =>
          String(args[0]).startsWith("custom-campaign failed for"),
        ),
      ).toBe(true);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("throttles between sends but not after the last one", async () => {
    vi.useFakeTimers();
    try {
      const sender = makeSender(() => ok());
      const audience: Recipient[] = [
        { email: "a@x.com", name: "A", rsvpId: "1" },
        { email: "b@x.com", name: "B", rsvpId: "2" },
        { email: "c@x.com", name: "C", rsvpId: "3" },
      ];

      const promise = sendBulkEmails({
        audience,
        resend: sender,
        getEmail: (r) => r.email,
        build: (r) => ({ from: "x", to: r.email, subject: "s", html: "<p/>" }),
        throttleMs: 500,
      });

      // Two throttles of 500ms between three sends = 1000ms total.
      await vi.advanceTimersByTimeAsync(1000);
      const result = await promise;

      expect(result.sent).toBe(3);
      expect(sender.calls).toHaveLength(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
