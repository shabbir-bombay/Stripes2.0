"use client";

import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/components/api";
import { Button, ButtonLink } from "@/components/Button";
import { RideSummary } from "@/components/RideSummary";
import { usePolling } from "@/components/usePolling";
import type { Ride, RideStatus } from "@/lib/types";

const CANCELABLE: RideStatus[] = ["requested", "assigned", "en_route", "arrived"];

export default function RidePage() {
  const [canceled, setCanceled] = useState<Ride>();
  const { data: ride, error } = usePolling<Ride | null>(canceled ? null : "/api/rides/active");
  const [hadRide, setHadRide] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string>();

  useEffect(() => {
    if (ride) setHadRide(true);
  }, [ride]);

  async function cancel() {
    setBusy(true);
    setCancelError(undefined);
    try {
      setCanceled(await api<Ride>(`/api/rides/${ride!.id}/cancel`, "POST", {}));
    } catch (e) {
      setCancelError((e as Error).message);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  if (canceled) {
    return (
      <Page>
        <div role="status" className="banner closed">
          <p className="banner-title">Ride canceled</p>
          <p>You can request another ride whenever you need one.</p>
        </div>
        <ButtonLink href="/student">Done</ButtonLink>
      </Page>
    );
  }

  if (ride === undefined) {
    return (
      <Page>
        <p role="status" className={error ? "form-error" : undefined}>{error ?? "Loading your ride…"}</p>
      </Page>
    );
  }

  if (ride === null) {
    return (
      <Page>
        <p role="status" className="lead">{hadRide ? "Your ride is over." : "You don't have a ride right now."}</p>
        <ButtonLink href="/student">Back</ButtonLink>
      </Page>
    );
  }

  const { title, text } = describe(ride);
  return (
    <Page>
      <div role="status" className="banner open">
        <p className="banner-title">{title}</p>
        <p>{text}</p>
        {error && <p className="field-error">{error}</p>}
      </div>
      <RideSummary pickup={ride.pickup.name} dropoff={ride.dropoff.name} partySize={ride.partySize} />
      {cancelError && <p role="alert" className="form-error">{cancelError}</p>}
      {CANCELABLE.includes(ride.status) &&
        (confirming ? (
          <div className="card stack">
            <p className="banner-title">Cancel this ride?</p>
            <Button variant="danger" onClick={cancel} disabled={busy}>{busy ? "Canceling…" : "Yes, cancel it"}</Button>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>Keep my ride</Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setConfirming(true)}>Cancel ride</Button>
        ))}
    </Page>
  );
}

function Page({ children }: { children: ReactNode }) {
  return (
    <main className="page stack">
      <h1>Your ride</h1>
      {children}
    </main>
  );
}

function describe(ride: Ride): { title: string; text: string } {
  switch (ride.status) {
    case "requested":
      return {
        title: "Waiting for a cart",
        text: ride.queuePosition === 1 ? "You're next in line." : `You're number ${ride.queuePosition} in line.`,
      };
    case "assigned":
      return { title: "A driver has your ride", text: `Wait at ${ride.pickup.name}.` };
    case "en_route":
      return { title: "Your cart is on the way", text: `Wait at ${ride.pickup.name}.` };
    case "arrived":
      return { title: "Your cart is here", text: `It's waiting at ${ride.pickup.name}.` };
    case "in_progress":
      return { title: "On your way", text: `Heading to ${ride.dropoff.name}.` };
    default:
      return { title: "Your ride is over", text: "" };
  }
}
