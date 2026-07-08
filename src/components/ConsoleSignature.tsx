"use client";

import { useEffect } from "react";

const SIGNATURE = String.raw`
 _   _            _
| | | | __ _ _ __(_)
| |_| |/ _' | '__| |
|  _  | (_| | |  | |
|_| |_|\__,_|_|  |_|
`;

/** Greets the engineers who open DevTools. Logs once per page load. */
export default function ConsoleSignature() {
  useEffect(() => {
    console.info(
      `%c${SIGNATURE}`,
      "color:#C4704B;font-family:monospace;font-size:12px;line-height:1.2"
    );
    console.info(
      "%cHand-built with Next.js — no template, no page builder.\n" +
        "The cursor, the shader behind the hero and the scroll choreography " +
        "are all hand-written. Curious how? Let's talk: dev@harisolaas.com",
      "color:#2D4A3E;font-size:12px;line-height:1.6"
    );
  }, []);

  return null;
}
