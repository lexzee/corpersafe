"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (public/sw.js) in production only — a
 * caching SW under `next dev` is a debugging nightmare. Also makes the app
 * installable ("Add to Home Screen") alongside app/manifest.ts.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker.register("/sw.js").catch((e) => {
      console.warn("Service worker registration failed:", e);
    });
  }, []);

  return null;
}
