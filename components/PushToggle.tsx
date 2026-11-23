"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import { Button } from "./Button";
import { currentSubscription, keyBytes, pushSupport, stopAlerts } from "./push";
import type { PushKey, PushSubscriptionInput } from "@/lib/types";

type State = "loading" | "hidden" | "no" | "install-first" | "blocked" | "off" | "on";

/** Turns phone alerts on or off for this device, as a row at the top of Alerts. Hidden where the server has no alerts set up (e.g. locally). */
export function PushToggle({ offText }: { offText: string }) {
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
  const text = {
    on: "On. You'll get these even with the screen locked.",
    off: offText,
    "install-first": "On iPhone, add Stripes to your Home Screen first: tap Share, then “Add to Home Screen”. Open Stripes from there and turn alerts on.",
    blocked: "Alerts are blocked for this site. Allow notifications in your browser's settings, then come back.",
    no: "This browser can't show alerts.",
  }[state];
  return (
    <section className="list" aria-labelledby="alerts-title">
      <div className="list-item center">
        <div>
          <h2 id="alerts-title" className="list-item-title">Phone alerts</h2>
          <p className="list-item-meta">{text}</p>
          {error && <p role="alert" className="field-error">{error}</p>}
        </div>
        {state === "off" && <Button size="small" onClick={turnOn} disabled={busy}>{busy ? "Turning on…" : "Turn on"}</Button>}
        {state === "on" && <Button size="small" variant="tonal" onClick={turnOff} disabled={busy}>Turn off</Button>}
      </div>
    </section>
  );
}
