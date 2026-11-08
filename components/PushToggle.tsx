"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import { Button } from "./Button";
import { currentSubscription, keyBytes, pushSupport, stopAlerts } from "./push";
import type { PushKey, PushSubscriptionInput } from "@/lib/types";

type State = "loading" | "hidden" | "no" | "install-first" | "blocked" | "off" | "on";

/** Turns phone alerts on or off for this device. Hidden where the server has no alerts set up (e.g. locally). */
export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [key, setKey] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { publicKey } = await api<PushKey>("/api/push/key");
      if (!publicKey) return setState("hidden");
      setKey(publicKey);
      const support = pushSupport();
      if (support !== "yes") return setState(support);
      if (Notification.permission === "denied") return setState("blocked");
      await navigator.serviceWorker.register("/sw.js");
      const subscription = await currentSubscription();
      // Already on: tell the server again, in case someone else used this phone since.
      if (subscription) await api("/api/push/subscriptions", "POST", subscription.toJSON() as PushSubscriptionInput);
      setState(subscription ? "on" : "off");
    })().catch(() => setState("hidden"));
  }, []);

  async function turnOn() {
    setBusy(true);
    setError(undefined);
    try {
      if ((await Notification.requestPermission()) !== "granted") return setState("blocked");
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key!) });
      await api("/api/push/subscriptions", "POST", subscription.toJSON() as PushSubscriptionInput);
      setState("on");
    } catch (e) {
      setError((e as Error).message || "Couldn't turn on alerts. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    await stopAlerts();
    setState("off");
    setBusy(false);
  }

  if (state === "loading" || state === "hidden") return null;
  return (
    <section className="card stack" aria-labelledby="alerts-title">
      <h2 id="alerts-title">Alerts on this device</h2>
      {state === "on" && <p>On. You&apos;ll get an alert when something changes on your rides, even with the screen locked.</p>}
      {state === "off" && <p>Get an alert when something changes on your rides, even with Stripes closed.</p>}
      {state === "install-first" && (
        <p>On iPhone, add Stripes to your Home Screen first: tap Share, then &ldquo;Add to Home Screen&rdquo;. Open Stripes from there and turn alerts on.</p>
      )}
      {state === "blocked" && <p className="muted">Alerts are blocked for this site. Allow notifications in your browser&apos;s settings, then come back.</p>}
      {state === "no" && <p className="muted">This browser can&apos;t show alerts.</p>}
      {error && <p role="alert" className="form-error">{error}</p>}
      {state === "off" && <Button onClick={turnOn} disabled={busy}>{busy ? "Turning on…" : "Turn on alerts"}</Button>}
      {state === "on" && <Button variant="secondary" onClick={turnOff} disabled={busy}>Turn off alerts</Button>}
    </section>
  );
}
