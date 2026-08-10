import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The Un Árbol community page is superseded by their collaborator
      // invitation. Two patterns because `redirects()` runs BEFORE the locale
      // middleware in `src/proxy.ts` — the bare path never gets prefixed, so
      // matching only `/:locale/...` would leave `/brote-unarbol` 404ing.
      //
      // `permanent: true` emits 308, not 301.
      {
        source: "/brote-unarbol",
        destination: "/es/brote/invitacion/unarbol",
        permanent: true,
      },
      {
        source: "/:locale(es|en)/brote-unarbol",
        destination: "/:locale/brote/invitacion/unarbol",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
