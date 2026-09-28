"use client";

/**
 * Desafío "15 días meditando juntos" — the public page, a pixel port of the
 * Claude Design handoff (design_handoff_desafio_meditacion). Three screens
 * behind hash routes: inicio (""), día ("#/dia/5") and cierre ("#/cierre").
 * Progress lives in localStorage (`desafio15.completados`); the rules live in
 * `@/lib/desafio-progress`.
 */
import { useEffect, useRef, useState } from "react";
import type { DesafioData } from "@/lib/desafio";
import type { DesafioDict } from "@/dictionaries/types";
import {
  findNextDay,
  isAllDone,
  resolveRoute,
  routeKey,
  toggleCompletado,
  type DesafioRoute,
} from "@/lib/desafio-progress";
import DesafioClosing from "./DesafioClosing";
import DesafioDayView from "./DesafioDayView";
import DesafioHome from "./DesafioHome";
import Icon from "./Icon";
import { navigate, replaceRoute, useCompletados, useRequestedRoute } from "./stores";
import "./desafio.css";

export default function DesafioApp({
  data,
  dict,
  fontClassName,
}: {
  data: DesafioData;
  dict: DesafioDict;
  /** next/font variable classes, applied on the root only. */
  fontClassName: string;
}) {
  const { config, dias } = data;
  const [done, setDone] = useCompletados();
  const requested = useRequestedRoute();
  const route = resolveRoute(requested, dias, done);
  const key = routeKey(route);
  const nextDay = findNextDay(dias, done);
  const allDone = isAllDone(done);

  /** Day whose burst should play: set when marked, cleared on navigation. */
  const [burst, setBurst] = useState<{ day: number; id: number } | null>(null);

  const go = (to: DesafioRoute) => {
    setBurst(null);
    navigate(to);
  };

  // A hash that can't be shown (unpublished day, early cierre) is dropped
  // from the URL so a reload or a shared link doesn't keep pointing at it.
  const requestedKey = routeKey(requested);
  useEffect(() => {
    if (requestedKey !== key) replaceRoute(route);
    // `route` is derived from `key`; depending on the key avoids loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedKey, key]);

  // Scroll to the top on every screen change (not on the first render, so a
  // reload keeps the browser's scroll restoration).
  const prevKey = useRef<string | null>(null);
  useEffect(() => {
    if (prevKey.current !== null && prevKey.current !== key) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
    prevKey.current = key;
  }, [key]);

  const day = route.screen === "dia" ? dias[route.n - 1] : null;

  const toggleDay = (n: number) => {
    const wasDone = done.includes(n);
    setDone(toggleCompletado(done, n));
    setBurst(wasDone ? null : { day: n, id: (burst?.id ?? 0) + 1 });
  };

  return (
    <div className={`desafio ${fontClassName}`}>
      {route.screen === "cierre" ? (
        <DesafioClosing dict={dict} config={config} go={go} />
      ) : day ? (
        <DesafioDayView
          key={day.dia}
          dict={dict}
          day={day}
          dias={dias}
          done={done}
          allDone={allDone}
          burstId={burst?.day === day.dia ? burst.id : null}
          go={go}
          onToggle={() => toggleDay(day.dia)}
        />
      ) : (
        <DesafioHome
          dict={dict}
          config={config}
          dias={dias}
          done={done}
          nextDay={nextDay}
          allDone={allDone}
          go={go}
        />
      )}

      <div className="desafio-wa">
        <div className="desafio-wa-inner">
          <a
            href={config.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-block desafio-wa-btn"
          >
            <Icon name="message-circle" size={19} />
            {dict.whatsappCta}
          </a>
        </div>
      </div>
    </div>
  );
}
