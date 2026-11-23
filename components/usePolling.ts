"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Loads a GET endpoint now, then every `ms` while the tab is visible. Polling pauses in a hidden tab
 * and loads again as soon as the tab comes back. Pass `null` as the URL to stop.
 * `data` keeps the last good response; `error` says why the latest try failed.
 * `refresh()` loads again at once, e.g. right after the user changed something; it resolves once the new data is in.
 */
export function usePolling<T>(url: string | null, ms = 4000) {
  // Each answer is kept with the URL it came from. A different URL is a different thing, so the old one's
  // answer is never shown, not even for the one render before the new load starts.
  const [loaded, setLoaded] = useState<{ url: string; data?: T; error?: string }>();
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
        const body = await response.json().catch(() => undefined);
        // Stopped part-way (the URL changed): this answer belongs to nothing on screen.
        if (controller.signal.aborted) return;
        if (!response.ok || body === undefined) throw new Error(body?.error ?? "Something went wrong. Retrying…");
        setLoaded({ url: url!, data: body });
      } catch (e) {
        if (controller.signal.aborted) return;
        const error = e instanceof TypeError ? "Can't reach Stripes. Retrying…" : (e as Error).message;
        // A failed try keeps the last good answer from this URL on screen, with the reason beside it.
        setLoaded((previous) => ({ url: url!, data: previous?.url === url ? previous.data : undefined, error }));
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
  const current = url && loaded?.url === url ? loaded : undefined;
  return { data: current?.data, error: current?.error, refresh };
}
