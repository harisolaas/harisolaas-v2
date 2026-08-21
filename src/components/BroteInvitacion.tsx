import Image from "next/image";
import type { CSSProperties } from "react";
import type { BroteDict, BroteInvitacionDict } from "@/dictionaries/types";
import { isSalesOpen } from "@/data/brote";
import {
  instagramUrl,
  resolveInvitationPrice,
  type BroteInvitation,
} from "@/lib/brote-invitations";
import BroteInvitacionCta from "./BroteInvitacionCta";

/**
 * Per-collaborator invitation landing.
 *
 * A server component with no runtime state — the brief is explicit that this
 * page has to paint in one go, so there is no framer-motion, no scroll
 * reveal, no client hooks. The single client island is the CTA, which has to
 * POST for a MercadoPago preference before redirecting.
 *
 * Sizing uses container query units (`cqw`) against the root's
 * `container-type: inline-size`, not `vw`. That is the brief's choice and it
 * means the page renders identically embedded in a 400px frame and opened
 * full width — worth having, since most traffic arrives inside Instagram's
 * in-app browser.
 */

/* Same vintage eco-editorial palette as BroteLanding — 2 colours + tints. */
const PAPER = "#EAE3D2";
const FOREST = "#3E5226";
const FOREST_60 = "#78855E";
const FOREST_30 = "#BBC2A9";
const FOREST_10 = "#E0E1D2";
const BODY = "#5C6B45";

const archivoExp: CSSProperties = {
  fontFamily: "var(--font-brote-archivo), sans-serif",
  fontStretch: "125%",
  fontWeight: 900,
};
const archivoData: CSSProperties = {
  fontFamily: "var(--font-brote-archivo), sans-serif",
  fontStretch: "110%",
  fontWeight: 900,
};
const serif: CSSProperties = {
  fontFamily: "var(--font-brote-serif), serif",
  fontWeight: 400,
};
const mono: CSSProperties = { fontFamily: "var(--font-brote-mono), monospace" };

const label: CSSProperties = {
  ...mono,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.25em",
  textTransform: "uppercase",
  color: FOREST_60,
};

/** Vertical dotted divider — the brief's recurring section break. */
function DottedDivider({ style }: { style?: CSSProperties }) {
  return (
    <div
      aria-hidden
      style={{
        width: 2,
        height: "clamp(28px,8cqw,44px)",
        backgroundImage: `radial-gradient(${FOREST} 40%, transparent 44%)`,
        backgroundSize: "6px 6px",
        backgroundPosition: "center",
        ...style,
      }}
    />
  );
}

/**
 * The @handle pill under the name.
 *
 * Renders nothing without an account — the returning-community page has
 * nobody to link to, and an empty bordered pill would read as a bug. Same
 * behaviour as an absent role line: the block closes up instead of leaving a
 * hole.
 */
function InstagramChip({
  url,
  handle,
}: {
  url: string | null;
  handle?: string;
}) {
  if (!url) return null;
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="brote-inv-chip"
        style={{
          ...mono,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          textDecoration: "none",
          color: FOREST_60,
          border: `1px solid ${FOREST_30}`,
          padding: "9px 15px",
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden
        >
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" />
        </svg>
        {handle}
      </a>
    </div>
  );
}

const ILLUSTRATIONS = [
  "/brote/ilustraciones/brote-arbol-riso.png",
  "/brote/ilustraciones/brote-lata-riso.png",
  "/brote/ilustraciones/brote-ticket-riso-reverse.png",
  "/brote/ilustraciones/brote-arbol-riso-reverse.png",
];

interface Props {
  dict: BroteInvitacionDict;
  /**
   * Quantity-modal copy. Lives in the shared BROTE dictionary rather than
   * the invitation one — the same modal serves the landing and these pages,
   * and duplicating the strings is how the two drift apart.
   */
  quantityDict: BroteDict["quantity"];
  locale: string;
  invitation: BroteInvitation;
}

export default function BroteInvitacion({
  dict,
  quantityDict,
  locale,
  invitation,
}: Props) {
  const copy = dict.collaborators[invitation.slug];
  const price = resolveInvitationPrice(invitation);
  // The page is `force-dynamic`, so this is evaluated per request: the day
  // after the party every invitation stops selling without a redeploy.
  const salesOpen = isSalesOpen();
  const closedNotice = (
    <p
      style={{
        ...serif,
        fontSize: "clamp(17px,4.6cqw,21px)",
        lineHeight: 1.4,
        textAlign: "center",
        margin: 0,
      }}
    >
      {dict.price.closed}
    </p>
  );
  const igUrl = instagramUrl(invitation);
  // "Te invita" reads wrong when nobody is inviting you — the returning
  // community page overrides it with its own line.
  const kicker = copy?.kicker ?? dict.kicker;

  const priceLabel =
    price.badge === "discount" ? dict.price.invitedLabel : dict.price.ticketLabel;
  const badgeText =
    price.badge === "discount"
      ? dict.price.discountBadge
      : price.badge === "earlybird"
        ? dict.price.earlyBirdBadge
        : null;
  const priceNote =
    price.badge === "discount"
      ? dict.price.noteDiscount
      : price.badge === "earlybird"
        ? dict.price.noteEarlyBird
        : dict.price.noteRegular;

  return (
    <div
      style={{
        background: PAPER,
        color: FOREST,
        position: "relative",
        overflowX: "hidden",
        minHeight: "100%",
        containerType: "inline-size",
      }}
    >
      {/* Grain. Inline SVG data-URI rather than an asset request. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 50,
          opacity: 0.05,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div
        style={{
          maxWidth: 560,
          margin: "0 auto",
          padding: "0 clamp(20px,6cqw,32px)",
        }}
      >
        {/* ═══ 1 · Invitation ═══ */}
        <header style={{ paddingTop: "clamp(18px,5cqw,28px)" }}>
          <div
            style={{
              ...mono,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.4em",
              textTransform: "uppercase",
            }}
          >
            <span>{dict.rule.left}</span>
            <span
              aria-hidden
              style={{
                flex: 1,
                margin: "0 12px",
                borderBottom: `1px dotted ${FOREST_60}`,
                transform: "translateY(-4px)",
              }}
            />
            {/* -0.4em pulls back the trailing letter-space so the text sits
                flush with the right edge instead of floating off it. */}
            <span style={{ marginRight: "-0.4em" }}>{dict.rule.right}</span>
          </div>

          <p
            style={{
              ...mono,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.35em",
              textTransform: "uppercase",
              color: FOREST_60,
              textAlign: "center",
              margin: "clamp(28px,8cqw,44px) 0 0",
            }}
          >
            {kicker}
          </p>

          <h1
            style={{
              ...serif,
              fontSize: "clamp(52px,15cqw,84px)",
              lineHeight: 0.96,
              textAlign: "center",
              margin: "12px 0 clamp(18px,5cqw,24px)",
              textWrap: "balance",
            }}
          >
            {invitation.name}
          </h1>

          <InstagramChip url={igUrl} handle={invitation.handle} />

          {copy?.roleLine ? (
            <p
              style={{
                ...serif,
                fontStyle: "italic",
                fontSize: "clamp(20px,5.6cqw,26px)",
                lineHeight: 1.35,
                textAlign: "center",
                color: BODY,
                margin: "clamp(22px,6cqw,30px) auto 0",
                maxWidth: "26ch",
                textWrap: "pretty",
              }}
            >
              {copy.roleLine}
            </p>
          ) : null}

          <DottedDivider style={{ margin: "clamp(26px,7cqw,36px) auto 0" }} />
        </header>

        {/* ═══ 2 · What BROTE is ═══ */}
        <section
          style={{ paddingTop: "clamp(26px,7cqw,36px)", textAlign: "center" }}
        >
          <h2
            style={{
              ...archivoExp,
              fontSize: "clamp(48px,16cqw,88px)",
              lineHeight: 0.9,
              letterSpacing: "0.01em",
              textTransform: "uppercase",
              margin: "0 0 clamp(14px,4cqw,20px)",
            }}
          >
            {dict.about.wordmark}
          </h2>
          <p
            style={{
              ...mono,
              fontSize: 14,
              lineHeight: 1.9,
              margin: "0 auto",
              maxWidth: "34ch",
              textWrap: "pretty",
            }}
          >
            {dict.about.paragraphs[0]}
          </p>
          <p
            style={{
              ...mono,
              fontSize: 14,
              lineHeight: 1.9,
              margin: "14px auto 0",
              maxWidth: "34ch",
              color: BODY,
              textWrap: "pretty",
            }}
          >
            {dict.about.paragraphs[1]}
          </p>

          <div
            style={{
              marginTop: "clamp(26px,7cqw,36px)",
              borderTop: `1.5px solid ${FOREST}`,
              borderBottom: `1.5px solid ${FOREST}`,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
              }}
            >
              {dict.about.facts.map((fact, i) => (
                <div
                  key={fact.label}
                  style={{
                    padding: "clamp(14px,4cqw,20px) 6px",
                    textAlign: "center",
                    borderRight:
                      i < dict.about.facts.length - 1
                        ? `1px solid ${FOREST}`
                        : undefined,
                  }}
                >
                  <div style={label}>{fact.label}</div>
                  <div
                    style={{
                      ...archivoData,
                      fontSize: "clamp(19px,5.4cqw,26px)",
                      lineHeight: 1.15,
                      // Without this "20 AGO" breaks across two lines on a
                      // narrow phone and the strip loses its rhythm.
                      whiteSpace: "nowrap",
                    }}
                  >
                    {fact.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ 3 · Price ═══ */}
        <section
          id="entrada"
          style={{
            paddingTop: "clamp(34px,9cqw,52px)",
            textAlign: "center",
            scrollMarginTop: 16,
          }}
        >
          <div
            style={{
              background: FOREST,
              color: PAPER,
              border: `1.5px solid ${FOREST}`,
              // Hard shadow, no blur — the identity's one shadow.
              boxShadow: "12px 12px 0 rgba(62,82,38,0.16)",
              padding: "clamp(26px,7cqw,40px) clamp(20px,6cqw,32px)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                marginBottom: "clamp(16px,5cqw,24px)",
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  ...mono,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.28em",
                  textTransform: "uppercase",
                }}
              >
                {priceLabel}
              </span>
              {badgeText && (
                <span
                  style={{
                    ...mono,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    background: PAPER,
                    color: FOREST,
                    padding: "3px 8px",
                  }}
                >
                  {badgeText}
                </span>
              )}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "center",
                gap: "clamp(12px,4cqw,22px)",
                flexWrap: "wrap",
              }}
            >
              {price.compareAtDisplay && (
                <div
                  style={{
                    ...serif,
                    position: "relative",
                    fontSize: "clamp(26px,7cqw,36px)",
                    lineHeight: 1,
                    opacity: 0.5,
                  }}
                >
                  {price.compareAtDisplay}
                  {/* Tilted strike, same gesture as the main landing. */}
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: "-6%",
                      right: "-6%",
                      top: "50%",
                      height: 2,
                      background: "currentColor",
                      transform: "rotate(-9deg)",
                    }}
                  />
                </div>
              )}
              <div
                style={{
                  ...serif,
                  fontSize: "clamp(54px,16cqw,86px)",
                  lineHeight: 0.9,
                }}
              >
                {price.priceDisplay}
              </div>
            </div>

            <p
              style={{
                ...mono,
                fontSize: 13,
                lineHeight: 1.75,
                margin: "14px auto 0",
                maxWidth: "30ch",
                opacity: 0.85,
              }}
            >
              {priceNote}
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                marginTop: "clamp(20px,6cqw,28px)",
              }}
            >
              <div style={{ width: "100%" }}>
                {salesOpen ? (
                  <BroteInvitacionCta
                    dict={{ cta: dict.price.cta, loading: dict.price.loading, error: dict.price.error, closed: dict.price.closed }}
                    quantityDict={quantityDict}
                    unitPrice={price.priceRaw}
                    locale={locale}
                    invite={invitation.slug}
                    variant="onGreen"
                  />
                ) : (
                  closedNotice
                )}
              </div>
              <span
                style={{
                  ...mono,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  opacity: 0.7,
                }}
              >
                {dict.price.paymentMethods}
              </span>
            </div>
          </div>
        </section>

        {/* ═══ 4 · What's included ═══ */}
        <section style={{ paddingTop: "clamp(34px,9cqw,52px)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              marginBottom: "clamp(16px,5cqw,24px)",
            }}
          >
            <span
              style={{
                ...mono,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                color: FOREST_60,
              }}
            >
              {dict.includes.eyebrow}
            </span>
            <span
              aria-hidden
              style={{
                flex: 1,
                borderBottom: `1px dotted ${FOREST_30}`,
                transform: "translateY(-4px)",
              }}
            />
          </div>

          <div style={{ border: `1.5px solid ${FOREST}` }}>
            {dict.includes.items.map((item, i) => {
              // The last row inverts: it closes the block and balances the
              // green price card above it.
              const inverted = i === dict.includes.items.length - 1;
              return (
                <div
                  key={item.title}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "clamp(14px,4cqw,20px)",
                    padding: inverted
                      ? "clamp(18px,5cqw,24px)"
                      : "clamp(16px,4.5cqw,22px)",
                    borderBottom: inverted ? undefined : `1px solid ${FOREST}`,
                    background: inverted ? FOREST : undefined,
                    color: inverted ? PAPER : undefined,
                  }}
                >
                  <Image
                    src={ILLUSTRATIONS[i]}
                    alt=""
                    width={144}
                    height={144}
                    style={{
                      width: "clamp(56px,16cqw,72px)",
                      height: "auto",
                      flex: "none",
                    }}
                  />
                  <div>
                    <h3
                      style={{
                        ...serif,
                        fontSize: "clamp(21px,5.6cqw,26px)",
                        lineHeight: 1.12,
                        margin: "0 0 5px",
                      }}
                    >
                      {item.title}
                    </h3>
                    <p
                      style={{
                        ...mono,
                        fontSize: 13,
                        lineHeight: 1.7,
                        margin: 0,
                        color: inverted ? undefined : BODY,
                        opacity: inverted ? 0.9 : undefined,
                      }}
                    >
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ═══ 5 · Closing ═══ */}
        <section
          style={{ paddingTop: "clamp(34px,9cqw,52px)", textAlign: "center" }}
        >
          <DottedDivider
            style={{ margin: "0 auto clamp(24px,7cqw,34px)" }}
          />
          <h2
            style={{
              ...serif,
              fontSize: "clamp(40px,12cqw,60px)",
              lineHeight: 1.02,
              margin: "0 0 clamp(8px,3cqw,12px)",
            }}
          >
            {dict.closing.heading}
          </h2>
          {copy?.closingLine ? (
            <p
              style={{
                ...mono,
                fontSize: 14,
                lineHeight: 1.9,
                margin: "0 auto",
                maxWidth: "30ch",
                color: BODY,
                textWrap: "pretty",
              }}
            >
              {copy.closingLine}
            </p>
          ) : null}
          {/* Always present, so the rhythm doesn't change when the closing
              line is missing. */}
          <div style={{ height: "clamp(22px,6cqw,30px)" }} />
          {salesOpen ? (
            <BroteInvitacionCta
              dict={{ cta: dict.price.cta, loading: dict.price.loading, error: dict.price.error, closed: dict.price.closed }}
              quantityDict={quantityDict}
              unitPrice={price.priceRaw}
              locale={locale}
              invite={invitation.slug}
              variant="onPaper"
            />
          ) : (
            closedNotice
          )}
        </section>

        <footer
          style={{
            ...mono,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.35em",
            textTransform: "uppercase",
            padding: "clamp(28px,8cqw,40px) 0 32px",
            color: FOREST_60,
          }}
        >
          <span>{dict.footer.left}</span>
          <span
            aria-hidden
            style={{
              flex: 1,
              margin: "0 12px",
              borderBottom: `1px dotted ${FOREST_30}`,
              transform: "translateY(-3px)",
            }}
          />
          <span>{dict.footer.right}</span>
        </footer>
      </div>

      {/* Hover/focus for the Instagram chip. Inline styles can't express
          either, and the brief calls for both explicitly. */}
      <style>{`
        .brote-inv-chip:hover {
          color: ${FOREST};
          border-color: ${FOREST};
          background: ${FOREST_10};
        }
        .brote-inv-chip:focus-visible {
          outline: 2px solid ${FOREST};
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}
