// Stub for the `server-only` package, used by vitest via the alias in
// vitest.config.ts. The real package throws at import time outside a
// Next server context — fine in production, but breaks vitest which
// loads server-only modules (e.g. lib/links-server.ts) directly to
// exercise their exports.
export {};
