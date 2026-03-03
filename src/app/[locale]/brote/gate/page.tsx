"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";

interface TicketInfo {
  id: string;
  type: "ticket" | "donation";
  buyerName: string;
  status: "valid" | "used";
}

function GateContent() {
  const searchParams = useSearchParams();
  const ticketParam = searchParams.get("ticket") || "";

  const [ticketId, setTicketId] = useState(ticketParam);
  const [ticket, setTicket] = useState<TicketInfo | null>(null);
  const [status, setStatus] = useState<
    "idle" | "loading" | "valid" | "used" | "not_found" | "marked"
  >("idle");
  const [usedAt, setUsedAt] = useState<string | null>(null);

  const checkTicket = useCallback(
    async (id: string) => {
      if (!id) return;
      setStatus("loading");
      try {
        const res = await fetch("/api/brote/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticketId: id, action: "check" }),
        });
        const data = await res.json();
        if (data.error === "not_found") {
          setStatus("not_found");
          setTicket(null);
        } else if (data.ticket) {
          setTicket(data.ticket);
          setStatus(data.ticket.status === "valid" ? "valid" : "used");
        }
      } catch {
        setStatus("not_found");
      }
    },
    [],
  );

  useEffect(() => {
    if (ticketParam) {
      checkTicket(ticketParam);
    }
  }, [ticketParam, checkTicket]);

  const markUsed = async () => {
    if (!ticket) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/brote/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: ticket.id, action: "use" }),
      });
      const data = await res.json();
      if (data.valid) {
        setStatus("marked");
      } else if (data.error === "already_used") {
        setStatus("used");
        setUsedAt(data.usedAt);
      }
    } catch {
      setStatus("not_found");
    }
  };

  const bg =
    status === "valid"
      ? "bg-green-600"
      : status === "used"
        ? "bg-red-600"
        : status === "marked"
          ? "bg-green-700"
          : "bg-[#2D4A3E]";

  return (
    <main
      className={`flex min-h-[100svh] flex-col items-center justify-center px-6 py-12 text-center transition-colors duration-300 ${bg}`}
    >
      <h1 className="mb-8 text-3xl font-bold text-white">BROTE — Gate</h1>

      {/* Manual input */}
      {status === "idle" || status === "not_found" ? (
        <div className="w-full max-w-sm">
          <input
            type="text"
            placeholder="Ticket ID (e.g. BROTE-XXXXXXXX)"
            value={ticketId}
            onChange={(e) => setTicketId(e.target.value.toUpperCase())}
            className="w-full rounded-lg border-2 border-white/30 bg-white/10 px-4 py-3 text-center text-lg text-white placeholder-white/40 focus:border-white/60 focus:outline-none"
          />
          <button
            onClick={() => checkTicket(ticketId)}
            className="mt-4 w-full rounded-lg bg-white px-6 py-3 text-lg font-semibold text-[#2D4A3E]"
          >
            Verificar
          </button>
          {status === "not_found" && (
            <p className="mt-4 text-lg text-white/80">
              Ticket no encontrado.
            </p>
          )}
        </div>
      ) : status === "loading" ? (
        <p className="text-xl text-white">Verificando...</p>
      ) : status === "valid" && ticket ? (
        <div className="w-full max-w-sm">
          <div className="mb-6 text-6xl">✅</div>
          <p className="text-2xl font-bold text-white">VALIDO</p>
          <div className="mt-4 rounded-lg bg-white/20 p-4 text-left text-white">
            <p>
              <strong>Nombre:</strong> {ticket.buyerName}
            </p>
            <p>
              <strong>Tipo:</strong>{" "}
              {ticket.type === "ticket" ? "Entrada" : "Donacion"}
            </p>
            <p>
              <strong>ID:</strong> {ticket.id}
            </p>
          </div>
          <button
            onClick={markUsed}
            className="mt-6 w-full rounded-lg bg-white px-6 py-3 text-lg font-semibold text-green-700"
          >
            Marcar como usado
          </button>
          <button
            onClick={() => {
              setStatus("idle");
              setTicket(null);
              setTicketId("");
            }}
            className="mt-3 w-full rounded-lg border border-white/30 px-6 py-3 text-sm text-white/70"
          >
            Verificar otro
          </button>
        </div>
      ) : status === "used" && ticket ? (
        <div className="w-full max-w-sm">
          <div className="mb-6 text-6xl">❌</div>
          <p className="text-2xl font-bold text-white">YA USADO</p>
          <div className="mt-4 rounded-lg bg-white/20 p-4 text-left text-white">
            <p>
              <strong>Nombre:</strong> {ticket.buyerName}
            </p>
            <p>
              <strong>ID:</strong> {ticket.id}
            </p>
            {usedAt && (
              <p>
                <strong>Usado:</strong>{" "}
                {new Date(usedAt).toLocaleString("es-AR")}
              </p>
            )}
          </div>
          <button
            onClick={() => {
              setStatus("idle");
              setTicket(null);
              setTicketId("");
            }}
            className="mt-6 w-full rounded-lg bg-white px-6 py-3 text-lg font-semibold text-red-700"
          >
            Verificar otro
          </button>
        </div>
      ) : status === "marked" ? (
        <div className="w-full max-w-sm">
          <div className="mb-6 text-6xl">🎉</div>
          <p className="text-2xl font-bold text-white">INGRESO REGISTRADO</p>
          <p className="mt-2 text-white/80">
            {ticket?.buyerName} puede pasar.
          </p>
          <button
            onClick={() => {
              setStatus("idle");
              setTicket(null);
              setTicketId("");
            }}
            className="mt-6 w-full rounded-lg bg-white px-6 py-3 text-lg font-semibold text-green-700"
          >
            Verificar otro
          </button>
        </div>
      ) : null}
    </main>
  );
}

export default function GatePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[100svh] items-center justify-center bg-[#2D4A3E]">
          <p className="text-xl text-white">Cargando...</p>
        </main>
      }
    >
      <GateContent />
    </Suspense>
  );
}
