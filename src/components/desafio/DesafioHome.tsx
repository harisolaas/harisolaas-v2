import { fillTokens } from "@/data/brote";
import type { DesafioConfig } from "@/data/desafio";
import type { DesafioDay } from "@/lib/desafio";
import type { DesafioDict } from "@/dictionaries/types";
import {
  dayStatus,
  firstSoonDay,
  type DesafioRoute,
} from "@/lib/desafio-progress";
import Icon from "./Icon";
import { joinMeta } from "./text";

/**
 * "15 días<br>meditando juntos": the design breaks the H1 after its first two
 * words. `nombre` comes from config, so the break is derived, not hardcoded.
 */
function TitleWithBreak({ text }: { text: string }) {
  const m = /^(\S+\s+\S+)\s+(.+)$/.exec(text);
  if (!m) return <>{text}</>;
  return (
    <>
      {m[1]}
      <br />
      {m[2]}
    </>
  );
}

export default function DesafioHome({
  dict,
  config,
  dias,
  done,
  nextDay,
  allDone,
  go,
}: {
  dict: DesafioDict;
  config: DesafioConfig;
  dias: DesafioDay[];
  done: number[];
  nextDay: number | null;
  allDone: boolean;
  go: (route: DesafioRoute) => void;
}) {
  const t = dict.home;
  const next = nextDay ? dias[nextDay - 1] : null;
  const soonN = firstSoonDay(dias, done);
  const [progressBefore, progressAfter] = t.progress.split("{n}");

  return (
    <main className="desafio-main desafio-main--home">
      <div
        className="desafio-blob"
        style={{
          right: -90,
          top: -110,
          width: 240,
          height: 240,
          background: "var(--color-accent-2-200)",
          zIndex: 0,
        }}
      />
      <div style={{ position: "relative", zIndex: 1 }}>
        <span className="tag tag-neutral">
          {fillTokens(t.guideTag, { guia: config.guia })}
        </span>
        <h1 className="desafio-h1-home">
          <TitleWithBreak text={config.nombre} />
        </h1>
        <p className="desafio-welcome">{config.bienvenida}</p>
      </div>

      <section
        aria-label={dict.a11y.progress}
        style={{ marginTop: 32, position: "relative", zIndex: 1 }}
      >
        <p className="desafio-progress-text">
          {progressBefore}
          <strong className="desafio-progress-num">{done.length}</strong>
          {progressAfter}
        </p>
        <div className="desafio-dots" aria-hidden="true">
          {dias.map((d) => (
            <span
              key={d.dia}
              className={`desafio-dot desafio-dot--${dayStatus(d.dia, dias, done, nextDay)}`}
            />
          ))}
        </div>
      </section>

      {next && next.publicado ? (
        <section className="desafio-card desafio-card--next">
          <div
            className="desafio-blob"
            style={{
              right: -40,
              bottom: -60,
              width: 150,
              height: 150,
              background: "var(--color-accent-200)",
            }}
          />
          <div style={{ position: "relative" }}>
            <span className="desafio-kicker">{t.nextKicker}</span>
            <h2 className="desafio-next-h2">
              {fillTokens(t.nextTitle, {
                n: String(next.dia),
                titulo: next.titulo,
              })}
            </h2>
            {(next.meditacion || next.duracion) && (
              <p className="desafio-next-meta">
                {joinMeta(t.nextMeta, {
                  meditacion: next.meditacion,
                  duracion: next.duracion,
                })}
              </p>
            )}
            <button
              type="button"
              className="btn btn-primary desafio-next-cta"
              onClick={() => go({ screen: "dia", n: next.dia })}
            >
              {fillTokens(t.nextCta, { n: String(next.dia) })}
              <Icon name="arrow-right" size={18} />
            </button>
          </div>
        </section>
      ) : allDone ? (
        <section className="desafio-card desafio-card--sage">
          <h2 className="desafio-card-h2">{t.allDoneTitle}</h2>
          <button
            type="button"
            className="btn btn-primary desafio-cta-48"
            onClick={() => go({ screen: "cierre" })}
          >
            {dict.seeClosing}
          </button>
        </section>
      ) : (
        <section className="desafio-card desafio-card--sage">
          <h2 className="desafio-card-h2">{t.upToDateTitle}</h2>
          {soonN !== null && (
            <p className="desafio-card-text">
              {fillTokens(t.upToDateText, { n: String(soonN) })}
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="desafio-days-heading" style={{ marginTop: 36 }}>
        <h2 id="desafio-days-heading" className="desafio-days-h2">
          {t.daysHeading}
        </h2>
        <div className="desafio-days">
          {dias.map((d) => {
            const status = dayStatus(d.dia, dias, done, nextDay);
            const label = fillTokens(dict.dayLabel, { n: String(d.dia) });
            // Soon days aren't clickable.
            if (status === "soon") {
              return (
                <div key={d.dia} className="desafio-row desafio-row--soon">
                  <span className="desafio-row-circle">
                    <Icon name="lock" size={17} />
                  </span>
                  <span className="desafio-row-text">
                    <span className="desafio-row-title">{label}</span>
                    <span className="desafio-row-sub">{dict.soon}</span>
                  </span>
                </div>
              );
            }
            // A done day that was unpublished afterwards still opens, but
            // has no title to show.
            const title = d.publicado ? `${label} · ${d.titulo}` : label;
            const duracion = d.publicado ? d.duracion : "";
            return (
              <button
                key={d.dia}
                type="button"
                className={`desafio-row desafio-row--${status}`}
                onClick={() => go({ screen: "dia", n: d.dia })}
              >
                <span className="desafio-row-circle">
                  {status === "done" ? <Icon name="check" size={20} /> : d.dia}
                </span>
                <span className="desafio-row-text">
                  <span className="desafio-row-title">{title}</span>
                  <span className="desafio-row-sub">
                    {status === "done"
                      ? t.statusDone
                      : joinMeta(
                          status === "next" ? t.statusNext : t.statusOpen,
                          {
                            duracion,
                          },
                        )}
                  </span>
                </span>
                {status !== "done" && (
                  <Icon
                    name="chevron-right"
                    size={18}
                    className="desafio-chevron"
                  />
                )}
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
