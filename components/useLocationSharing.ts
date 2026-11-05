"use client";

import { useEffect, useState } from "react";
import type { PositionReport } from "@/lib/types";
import { api } from "./api";

/** How often the driver's position is posted. API.md asks for every 5–10 s. */
const POST_EVERY_MS = 7000;

function describe(error: GeolocationPositionError) {
  if (error.code !== error.PERMISSION_DENIED) return "Can't find your location right now. Still trying…";
  return window.isSecureContext
    ? "Location is off. Allow location for this site so riders can see your cart."
    : "Location only works over a secure (HTTPS) connection.";
}

/**
 * While mounted, follows the phone's GPS and posts the newest fix to the server.
 * Browsers pause GPS in a hidden tab, so sharing stops there too and picks up when the tab comes back.
 * Returns whether the last post worked and, if something is wrong, a message to show the driver.
 */
export function useLocationSharing() {
  const [sharing, setSharing] = useState(false);
  const [problem, setProblem] = useState<string>();

  useEffect(() => {
    if (!navigator.geolocation) {
      setProblem("This browser can't share your location.");
      return;
    }

    let stopped = false;
    let posting = false;
    let asking = false;
    let latest: GeolocationPosition | undefined;
    let lastSentFix = 0;
    let lastPostAt = 0;

    async function post() {
      if (stopped || posting || document.hidden || !latest || latest.timestamp <= lastSentFix) return;
      const { coords, timestamp } = latest;
      posting = true;
      lastSentFix = timestamp;
      lastPostAt = Date.now();
      const report: PositionReport = {
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: coords.accuracy,
        at: new Date(timestamp).toISOString(),
      };
      try {
        await api("/api/driver/position", "POST", report);
        if (!stopped) {
          setSharing(true);
          setProblem(undefined);
        }
      } catch (e) {
        if (!stopped) {
          setSharing(false);
          setProblem((e as Error).message);
        }
      } finally {
        posting = false;
      }
    }

    function onFix(fix: GeolocationPosition) {
      latest = fix;
      // A second early, so a fix arriving just after the timer's tick isn't held back until the next one.
      if (Date.now() - lastPostAt >= POST_EVERY_MS - 1000) post();
    }

    function onError(error: GeolocationPositionError) {
      if (stopped) return;
      setSharing(false);
      setProblem(describe(error));
    }

    const options = { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 };
    const watch = navigator.geolocation.watchPosition(onFix, onError, options);
    const timer = setInterval(() => {
      if (document.hidden) return;
      if (latest && latest.timestamp > lastSentFix) {
        post();
      } else if (!asking) {
        // A parked cart's phone may report nothing new, and its last fix would go stale: ask directly.
        asking = true;
        navigator.geolocation.getCurrentPosition(
          (fix) => {
            asking = false;
            onFix(fix);
          },
          (error) => {
            asking = false;
            onError(error);
          },
          options,
        );
      }
    }, POST_EVERY_MS);

    return () => {
      stopped = true;
      navigator.geolocation.clearWatch(watch);
      clearInterval(timer);
    };
  }, []);

  return { sharing, problem };
}
