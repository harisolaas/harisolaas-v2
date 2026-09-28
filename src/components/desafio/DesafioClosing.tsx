import { Fragment } from "react";
import { DESAFIO_TOTAL_DAYS, type DesafioConfig } from "@/data/desafio";
import type { DesafioDict } from "@/dictionaries/types";
import type { DesafioRoute } from "@/lib/desafio-progress";
import Icon from "./Icon";

export default function DesafioClosing({
  dict,
  config,
  go,
}: {
  dict: DesafioDict;
  config: DesafioConfig;
  go: (route: DesafioRoute) => void;
}) {
  const t = dict.closing;
  return (
    <main className="desafio-main">
      <div
        className="desafio-blob"
        style={{
          right: -70,
          top: 40,
          width: 220,
          height: 220,
          background: "var(--color-accent-2-200)",
        }}
      />
      <div
        className="desafio-blob"
        style={{
          right: 90,
          top: 170,
          width: 90,
          height: 90,
          background: "var(--color-accent-200)",
        }}
      />
      <div style={{ position: "relative" }}>
        <button
          type="button"
          className="btn btn-ghost desafio-back"
          onClick={() => go({ screen: "inicio" })}
        >
          <Icon name="chevron-left" size={18} />
          {dict.day.backToDays}
        </button>
        <div style={{ marginTop: 150 }}>
          <span className="desafio-kicker">{t.kicker}</span>
          <h1 className="desafio-closing-h1">
            {t.titleLines.map((line, i) => (
              <Fragment key={i}>
                {i > 0 && <br />}
                {line}
              </Fragment>
            ))}
          </h1>
          <p className="desafio-closing-text">{t.text}</p>
          <div className="desafio-dots" style={{ marginTop: 22 }} aria-hidden="true">
            {Array.from({ length: DESAFIO_TOTAL_DAYS }, (_, i) => (
              <span key={i} className="desafio-dot desafio-dot--done" />
            ))}
          </div>
        </div>
        <section className="desafio-patch">
          <span className="tag tag-accent">{t.comingSoonTag}</span>
          <h2 className="desafio-patch-h2">{config.cierre.titulo}</h2>
          <p className="desafio-patch-text">{config.cierre.texto}</p>
        </section>
      </div>
    </main>
  );
}
