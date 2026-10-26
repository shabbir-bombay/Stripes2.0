"use client";

import { useEffect, useState } from "react";

/**
 * Loads a GET endpoint now, then every `ms` while the tab is visible. Polling pauses in a hidden tab
 * and loads again as soon as the tab comes back. Pass `null` as the URL to stop.
 * `data` keeps the last good response; `error` says why the latest try failed.
 */
export function usePolling<T>(url: string | null, ms = 4000) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let loading = false;

    async function load() {
      clearTimeout(timer);
      if (loading || document.hidden) return;
      loading = true;
      try {
        const response = await fetch(url!, { cache: "no-store", signal: controller.signal });
        const body = await response.json().catch(() => ({ error: "Something went wrong. Retrying…" }));
        if (!response.ok) throw new Error(body.error);
        setData(body);
        setError(undefined);
      } catch (e) {
        if (controller.signal.aborted) return;
        setError(e instanceof TypeError ? "Can't reach Stripes. Retrying…" : (e as Error).message);
      } finally {
        loading = false;
      }
      if (!document.hidden) timer = setTimeout(load, ms);
    }

    const onVisibilityChange = () => (document.hidden ? clearTimeout(timer) : load());
    document.addEventListener("visibilitychange", onVisibilityChange);
    load();
    return () => {
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [url, ms]);

  return { data, error };
}
