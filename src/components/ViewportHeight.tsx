"use client";

import { useEffect } from "react";

export default function ViewportHeight() {
  useEffect(() => {
    const h = window.innerHeight;
    document.documentElement.style.setProperty("--app-height", `${h}px`);
    document.documentElement.style.setProperty(
      "--app-height-half",
      `${h / 2}px`,
    );
  }, []);

  return null;
}
