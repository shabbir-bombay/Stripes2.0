"use client";

import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/components/api";
import { Button, ButtonLink } from "@/components/Button";
import type { MapPin } from "@/components/CampusMap";
import { LazyCampusMap } from "@/components/LazyCampusMap";
import { RideSummary } from "@/components/RideSummary";
import { usePolling } from "@/components/usePolling";
import type { Position, Ride, RideStatus } from "@/lib/types";

const CANCELABLE: RideStatus[] = ["requested", "assigned", "en_route", "arrived"];
const TRACKABLE: RideStatus[] = ["assigned", "en_route", "arrived"];

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
        {hadRide && <ButtonLink href="/student/history">See it and rate it</ButtonLink>}
        <ButtonLink href="/student" variant={hadRide ? "secondary" : "primary"}>Back</ButtonLink>
      </Page>
    );
  }

  const { title, text } = describe(ride);
  return (
    <Page>
      <div role="status" className="banner open">
        <p className="banner-title">{title}</p>
        <p>{text}</p>
        {ride.eta && <p>Your cart should reach you in about {ride.eta.minMinutes}–{ride.eta.maxMinutes} min.</p>}
        {error && <p className="field-error">{error}</p>}
      </div>
      {ride.driver && ride.status !== "in_progress" && (
        <p className="card look-for">
          Look for <strong>Cart {ride.driver.cartNumber}</strong>
          <span className="muted-inline"> · driver {ride.driver.callSign}</span>
        </p>
      )}
      {ride.driver && TRACKABLE.includes(ride.status) && <CartMap key={ride.id} ride={ride} cartNumber={ride.driver.cartNumber} />}
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

/** The pickup, and the cart while its position is fresh. */
function CartMap({ ride, cartNumber }: { ride: Ride; cartNumber: string }) {
  const { data: position } = usePolling<Position | null>(`/api/rides/${ride.id}/driver-position`);
  const { lat, lng } = ride.pickup;
  const pins: MapPin[] = [{ id: "pickup", kind: "stop", lat, lng, label: "Pickup" }];
  if (position) pins.push({ id: "cart", kind: "cart", lat: position.lat, lng: position.lng, label: `Cart ${cartNumber}` });

  return (
    <>
      <LazyCampusMap pins={pins} label={`Map of your pickup at ${ride.pickup.name} and your cart`} />
      {!position && <p className="muted">Your cart will show on the map once its location comes in.</p>}
    </>
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
