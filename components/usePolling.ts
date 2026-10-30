"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Loads a GET endpoint now, then every `ms` while the tab is visible. Polling pauses in a hidden tab
 * and loads again as soon as the tab comes back. Pass `null` as the URL to stop.
 * `data` keeps the last good response; `error` says why the latest try failed.
 * `refresh()` loads again at once, e.g. right after the user changed something; it resolves once the new data is in.
 */
export function usePolling<T>(url: string | null, ms = 4000) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const loadNow = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Loads run one after another, never at once, so a refresh never loses to an older response.
    let queue = Promise.resolve();

    async function fetchOnce() {
      if (controller.signal.aborted || document.hidden) return;
      try {
        const response = await fetch(url!, { cache: "no-store", signal: controller.signal });
        const body = await response.json().catch(() => ({ error: "Something went wrong. Retrying…" }));
        if (!response.ok) throw new Error(body.error);
        setData(body);
        setError(undefined);
      } catch (e) {
        if (controller.signal.aborted) return;
        setError(e instanceof TypeError ? "Can't reach Stripes. Retrying…" : (e as Error).message);
      }
    }

    function load() {
      clearTimeout(timer);
      queue = queue.then(fetchOnce).then(() => {
        clearTimeout(timer);
        if (!document.hidden && !controller.signal.aborted) timer = setTimeout(load, ms);
      });
      return queue;
    }

    loadNow.current = load;
    const onVisibilityChange = () => (document.hidden ? clearTimeout(timer) : load());
    document.addEventListener("visibilitychange", onVisibilityChange);
    load();
    return () => {
      controller.abort();
      clearTimeout(timer);
      loadNow.current = async () => {};
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [url, ms]);

  const refresh = useCallback(() => loadNow.current(), []);
  return { data, error, refresh };
}
