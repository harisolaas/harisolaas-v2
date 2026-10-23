// Meta Pixel base code. Server component.
//
// The `fbq` stub is inlined in the HTML, so it exists before any client
// effect runs: components can call `window.fbq(...)` on mount and the calls
// queue until fbevents.js loads — no polling for the SDK (BroteLanding's
// pattern). PageView goes out from the stub itself, once per page load.
//
// Renders nothing without NEXT_PUBLIC_META_PIXEL_ID (local dev, previews).
import Script from "next/script";

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export default function MetaPixel() {
  if (!PIXEL_ID) return null;

  const stub = `!function(f){if(f.fbq)return;var n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];}(window);
fbq('init',${JSON.stringify(PIXEL_ID)});fbq('track','PageView');`;

  return (
    <>
      <script
        id="meta-pixel-init"
        // The ID is JSON-encoded, so an env value can't break out of the string.
        dangerouslySetInnerHTML={{ __html: stub }}
      />
      <Script
        id="meta-pixel-sdk"
        src="https://connect.facebook.net/en_US/fbevents.js"
        strategy="afterInteractive"
      />
    </>
  );
}
