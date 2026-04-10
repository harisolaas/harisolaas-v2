"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginForm() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">(
    "idle",
  );

  const handleSubmit = async () => {
    if (!email.trim() || status === "loading") return;
    setStatus("loading");
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.ok) {
        setStatus("sent");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-center font-serif text-3xl text-forest">
          BROTE Admin
        </h1>

        {urlError === "invalid" && status === "idle" && (
          <p className="mt-4 text-center text-sm text-terracotta">
            El link expiró o ya fue usado. Pedí uno nuevo.
          </p>
        )}

        {status === "sent" ? (
          <div className="mt-8 text-center">
            <p className="text-5xl">📬</p>
            <p className="mt-4 text-base text-charcoal/70">
              Revisá tu email. Te mandamos un link para entrar.
            </p>
            <p className="mt-2 text-sm text-charcoal/40">
              Expira en 10 minutos.
            </p>
          </div>
        ) : (
          <div className="mt-8 flex flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Tu email"
              className="w-full rounded-full border border-sage/30 bg-white px-5 py-3 text-sm text-charcoal placeholder-charcoal/30 outline-none transition-colors focus:border-forest/40"
            />
            <button
              onClick={handleSubmit}
              disabled={!email.trim() || status === "loading"}
              className="w-full rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream transition-colors hover:bg-forest/90 disabled:opacity-50"
            >
              {status === "loading" ? "Enviando..." : "Enviar link mágico"}
            </button>
            {status === "error" && (
              <p className="text-center text-sm text-terracotta">
                Algo salió mal. Intentá de nuevo.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
