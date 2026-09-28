import { fillTokens } from "@/data/brote";
import { DESAFIO_TOTAL_DAYS } from "@/data/desafio";
import type { DesafioDay } from "@/lib/desafio";
import type { DesafioDict } from "@/dictionaries/types";
import {
  canOpenDay,
  doneMessage,
  type DesafioRoute,
  type DoneMessage,
} from "@/lib/desafio-progress";
import Celebration from "./Celebration";
import Icon from "./Icon";
import VideoEmbed from "./VideoEmbed";

const DONE_MESSAGE_KEY: Record<DoneMessage, keyof DesafioDict["day"]> = {
  all: "doneAll",
  lastMissing: "doneLastMissing",
  nextOpen: "doneNextOpen",
  nextSoon: "doneNextSoon",
  nextDone: "doneNextDone",
};

export default function DesafioDayView({
  dict,
  day,
  dias,
  done,
  allDone,
  burstId,
  go,
  onToggle,
}: {
  dict: DesafioDict;
  /** Published, or done-then-unpublished (no content: header + panel only). */
  day: DesafioDay;
  dias: DesafioDay[];
  done: number[];
  allDone: boolean;
  /** Set when this day was just marked here: plays (and keys) the burst. */
  burstId: number | null;
  go: (route: DesafioRoute) => void;
  onToggle: () => void;
}) {
  const t = dict.day;
  const n = day.dia;
  const nStr = String(n);
  const isDone = done.includes(n);
  const prevN = n - 1;
  const nextN = n + 1;
  const content = day.publicado ? day : null;
  const hasIntro = Boolean(content && (content.intro || content.introVideo));
  const hasReflection = Boolean(content && (content.reflexion || content.reflexionVideo));
  const nextMessage = fillTokens(t[DONE_MESSAGE_KEY[doneMessage(n, dias, done)]], {
    next: String(nextN),
  });

  return (
    <main className="desafio-main">
      <div className="desafio-topbar">
        <button
          type="button"
          className="btn btn-ghost desafio-back"
          onClick={() => go({ screen: "inicio" })}
        >
          <Icon name="chevron-left" size={18} />
          {t.backToDays}
        </button>
        <span className="desafio-muted-14">
          {fillTokens(t.doneCount, { n: String(done.length) })}
        </span>
      </div>

      <header style={{ marginTop: 22 }}>
        <span className="desafio-kicker">{fillTokens(t.kicker, { n: nStr })}</span>
        <h1 className="desafio-day-h1">
          {content ? content.titulo : fillTokens(dict.dayLabel, { n: nStr })}
        </h1>
      </header>

      {content && hasIntro && (
        <section
          aria-labelledby="desafio-intro-label"
          className="desafio-stack"
          style={{ marginTop: 28 }}
        >
          <h2 id="desafio-intro-label" className="desafio-label">
            {t.introLabel}
          </h2>
          <VideoEmbed url={content.introVideo} title={dict.a11y.introVideo} variant="plain" />
          {content.intro && <p className="desafio-intro-text">{content.intro}</p>}
        </section>
      )}

      {content && (
        <section aria-label={t.meditationKicker} className="desafio-med">
          <VideoEmbed
            url={content.meditacionVideo}
            title={content.meditacion || t.meditationKicker}
            variant="med"
          />
          <div style={{ padding: "18px 10px 0" }}>
            <span className="desafio-kicker">{t.meditationKicker}</span>
            {content.meditacion && (
              <h2 className="desafio-med-h2">
                {content.meditacion}
              </h2>
            )}
            <div className="desafio-tags">
              {content.duracion && (
                <span className="tag tag-accent-2" style={{ gap: 6 }}>
                  <Icon name="clock" size={13} />
                  {content.duracion}
                </span>
              )}
              <span className="tag tag-neutral">{t.teacherTag}</span>
            </div>
          </div>
        </section>
      )}

      {content && hasReflection && (
        <section
          aria-labelledby="desafio-ref-label"
          className="desafio-stack"
          style={{ marginTop: 36 }}
        >
          <h2 id="desafio-ref-label" className="desafio-label">
            {t.reflectionLabel}
          </h2>
          <VideoEmbed
            url={content.reflexionVideo}
            title={dict.a11y.reflectionVideo}
            variant="plain"
          />
          {content.reflexion && (
            <p className="desafio-reflection-text">{content.reflexion}</p>
          )}
        </section>
      )}

      <section style={{ marginTop: 40 }} aria-live="polite">
        {isDone ? (
          <div className="desafio-done">
            <Celebration key={burstId ?? "static"} animate={burstId !== null} />
            <h2 className="desafio-done-h2">{t.doneTitle}</h2>
            <p className="desafio-done-text">{nextMessage}</p>
            {allDone && (
              <button
                type="button"
                className="btn btn-primary desafio-cta-48"
                onClick={() => go({ screen: "cierre" })}
              >
                {dict.seeClosing}
              </button>
            )}
            <button type="button" className="desafio-unmark" onClick={onToggle}>
              {fillTokens(t.unmark, { n: nStr })}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-block desafio-mark"
            onClick={onToggle}
          >
            {fillTokens(t.markDone, { n: nStr })}
          </button>
        )}
      </section>

      <nav aria-label={dict.a11y.dayNav} className="desafio-daynav">
        <div>
          {prevN >= 1 && canOpenDay(prevN, dias, done) && (
            <button
              type="button"
              className="btn btn-secondary desafio-daynav-btn"
              style={{ justifyContent: "flex-start" }}
              onClick={() => go({ screen: "dia", n: prevN })}
            >
              <Icon name="chevron-left" size={18} />
              {fillTokens(dict.dayLabel, { n: String(prevN) })}
            </button>
          )}
        </div>
        <div>
          {nextN <= DESAFIO_TOTAL_DAYS &&
            (canOpenDay(nextN, dias, done) ? (
              <button
                type="button"
                className="btn btn-secondary desafio-daynav-btn"
                style={{ justifyContent: "flex-end" }}
                onClick={() => go({ screen: "dia", n: nextN })}
              >
                {fillTokens(dict.dayLabel, { n: String(nextN) })}
                <Icon name="chevron-right" size={18} />
              </button>
            ) : (
              <div className="desafio-daynav-soon">
                <span style={{ fontSize: 14, fontWeight: 600 }}>
                  {fillTokens(dict.dayLabel, { n: String(nextN) })}
                </span>
                <span style={{ fontSize: 12 }}>{dict.soon}</span>
              </div>
            ))}
        </div>
      </nav>
    </main>
  );
}
