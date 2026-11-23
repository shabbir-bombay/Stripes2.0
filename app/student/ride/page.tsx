"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/components/api";
import { Button, ButtonLink } from "@/components/Button";
import type { MapPin } from "@/components/CampusMap";
import { Icon } from "@/components/Icon";
import { MapScreen } from "@/components/MapScreen";
import { useInbox } from "@/components/notifications";
import { RatingForm } from "@/components/RatingForm";
import { CartPlate, clockTime, minutesSince, riders, RideSteps, RouteStops } from "@/components/RideParts";
import { usePolling } from "@/components/usePolling";
import type { HistoryPage, Position, Ride, RideStatus } from "@/lib/types";

const CANCELABLE: RideStatus[] = ["requested", "assigned", "en_route", "arrived"];
const TRACKABLE: RideStatus[] = ["assigned", "en_route", "arrived"];

export default function RidePage() {
  const router = useRouter();
  const [canceled, setCanceled] = useState<Ride>();
  const { data: ride, error } = usePolling<Ride | null>(canceled ? null : "/api/rides/active");
  // The ride last seen while it was active, so the page can say how it ended.
  const [last, setLast] = useState<Ride>();

  useEffect(() => {
    if (ride) setLast(ride);
    // Nothing to show without a ride: the Ride tab's home asks "Where to?".
    if (ride === null && !last) router.replace("/student");
  }, [ride, last, router]);

  if (canceled) {
    return (
      <MapScreen pins={stopPin(canceled, "pickup")} label={`Map of ${canceled.pickup.name}`}>
        <div role="status">
          <h1 className="sheet-title">Ride canceled</h1>
          <p className="sub">You can request another ride whenever you need one.</p>
        </div>
        <ButtonLink href="/student">Done</ButtonLink>
      </MapScreen>
    );
  }
  if (ride === undefined || (ride === null && !last)) {
    return (
      <MapScreen pins={[]} label="Campus map">
        <p role="status" className={error ? "form-error" : undefined}>{error ?? "Loading your ride…"}</p>
      </MapScreen>
    );
  }
  if (ride === null) return <RideOver ride={last!} />;
  return <ActiveRide ride={ride} error={error} onCanceled={setCanceled} />;
}

function stopPin(ride: Ride, which: "pickup" | "dropoff"): MapPin[] {
  const stop = ride[which];
  return [{ id: which, kind: which, lat: stop.lat, lng: stop.lng, label: which === "pickup" ? "Pickup" : "Drop-off" }];
}

/** What a screen reader hears when the ride moves on: short, and only when it changes. */
function announcement(ride: Ride) {
  switch (ride.status) {
    case "requested":
      return `Finding you a cart. Number ${ride.queuePosition} in line.`;
    case "assigned":
      return "A driver has your ride.";
    case "en_route":
      return "Your cart is on the way.";
    case "arrived":
      return "Your cart is here.";
    case "in_progress":
      return "On your way.";
    default:
      return "";
  }
}

function ActiveRide({ ride, error, onCanceled }: { ride: Ride; error?: string; onCanceled: (ride: Ride) => void }) {
  const { notifications, markRead } = useInbox();
  // The notices about this ride say what this page already shows: mark them read here, so they don't pop up after the ride.
  useEffect(() => {
    const ids = notifications?.filter((note) => !note.read && note.rideId === ride.id).map((note) => note.id) ?? [];
    if (ids.length > 0) markRead(ids).catch(() => {});
  }, [notifications, ride.id, markRead]);

  const tracking = !!ride.driver && TRACKABLE.includes(ride.status);
  const { data: position } = usePolling<Position | null>(tracking ? `/api/rides/${ride.id}/driver-position` : null);
  const cart = ride.driver?.cartNumber;

  const pins = stopPin(ride, "pickup");
  if (ride.status === "in_progress") pins.push(...stopPin(ride, "dropoff"));
  // One cart only, so its pin carries no number.
  if (tracking && position) pins.push({ id: "cart", kind: "vehicle", lat: position.lat, lng: position.lng, label: `Cart ${cart}`, showLabel: false });

  return (
    <MapScreen pins={pins} label={`Map of your pickup at ${ride.pickup.name}${tracking ? " and your cart" : ""}`}>
      <p role="status" className="sr-only">{announcement(ride)}</p>
      <Status ride={ride} />
      <RideSteps status={ride.status} />
      {ride.driver && (ride.status === "assigned" || ride.status === "en_route") && (
        <div className="plate-row">
          {cart && <CartPlate number={cart} />}
          <div>
            <p className="strong">{cart ? `Look for Cart ${cart}` : `Look for ${ride.driver.callSign}`}</p>
            <p className="small">Driver {ride.driver.callSign} · {riders(ride.partySize)}</p>
          </div>
        </div>
      )}
      {ride.status !== "arrived" && <RouteStops pickup={ride.pickup.name} dropoff={ride.dropoff.name} />}
      {ride.status === "in_progress" && ride.driver && (
        <div className="plate-row">
          {cart && <CartPlate number={cart} />}
          <div>
            <p className="strong">{cart ? `You're in Cart ${cart}` : "You're on board"}</p>
            <p className="small">Driver {ride.driver.callSign}</p>
          </div>
        </div>
      )}
      {ride.status === "requested" && (
        <p className="meta">
          <span><Icon name="people" small />{riders(ride.partySize)}</span>
          <span><Icon name="clock" small />Requested {clockTime(ride.requestedAt)}</span>
        </p>
      )}
      {tracking && !position && ride.status !== "arrived" && <p className="small">Your cart will show on the map once its location comes in.</p>}
      {error && <p className="field-error">{error}</p>}
      {CANCELABLE.includes(ride.status) && <CancelRide ride={ride} onCanceled={onCanceled} />}
    </MapScreen>
  );
}

/** The top of the sheet: what's happening now, in the words a student looks for. */
function Status({ ride }: { ride: Ride }) {
  const cart = ride.driver?.cartNumber;
  switch (ride.status) {
    case "requested":
      return (
        <div className="split">
          <div>
            <h1 className="sheet-title">Finding you a cart</h1>
            <p className="sub">Wait near {ride.pickup.name}.</p>
          </div>
          <div className="end">
            <p className="big-num num">#{ride.queuePosition}</p>
            <p className="small">in line</p>
          </div>
        </div>
      );
    case "assigned":
    case "en_route": {
      const who = cart ? `Cart ${cart}` : ride.driver?.callSign ?? "Your cart";
      const text = ride.status === "en_route" ? `${who} is on the way to ${ride.pickup.name}` : `${ride.driver?.callSign ?? "A driver"} has your ride. Wait at ${ride.pickup.name}.`;
      return ride.eta ? (
        <h1 className="eta-title">
          <span className="big-num num">{ride.eta.minMinutes}–{ride.eta.maxMinutes} min</span>
          <span className="sub strong">{text}</span>
        </h1>
      ) : (
        <>
          <h1 className="sheet-title">{ride.status === "en_route" ? "Your cart is on the way" : "A driver has your ride"}</h1>
          <p className="sub">{text}</p>
        </>
      );
    }
    case "arrived": {
      const waited = ride.arrivedAt ? minutesSince(ride.arrivedAt) : 0;
      return (
        <>
          <p className="ok-banner"><Icon name="check" />Your cart is here</p>
          <div className="plate-row bare spaced">
            {cart && <CartPlate number={cart} size="large" />}
            <div>
              <h1 className="sheet-title">Waiting at {ride.pickup.name}</h1>
              <p className="sub">
                {waited === 0 ? "Arrived just now" : `Arrived ${waited} min ago`}
                {ride.driver && ` · Driver ${ride.driver.callSign}`}
              </p>
            </div>
          </div>
        </>
      );
    }
    case "in_progress":
      return (
        <>
          <h1 className="sheet-title">On your way</h1>
          <p className="sub">Heading to {ride.dropoff.name}{cart ? ` in Cart ${cart}` : ""}.</p>
        </>
      );
    default:
      return <h1 className="sheet-title">Your ride is over</h1>;
  }
}

function CancelRide({ ride, onCanceled }: { ride: Ride; onCanceled: (ride: Ride) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function cancel() {
    setBusy(true);
    setError(undefined);
    try {
      onCanceled(await api<Ride>(`/api/rides/${ride.id}/cancel`, "POST", {}));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <>
      {error && <p role="alert" className="form-error">{error}</p>}
      {confirming ? (
        <div className="stack">
          <p className="strong">Cancel this ride?</p>
          <div className="row-buttons">
            <Button variant="tonal" onClick={() => setConfirming(false)} disabled={busy}>Keep my ride</Button>
            <Button variant="danger" onClick={cancel} disabled={busy}>{busy ? "Canceling…" : "Yes, cancel it"}</Button>
          </div>
        </div>
      ) : (
        <Button variant="danger-quiet" onClick={() => setConfirming(true)}>Cancel ride</Button>
      )}
    </>
  );
}

/** After the ride leaves the active list: rate it if it was completed, otherwise say how it ended. */
function RideOver({ ride }: { ride: Ride }) {
  const router = useRouter();
  const [ended, setEnded] = useState<Ride | null>();
  const [rated, setRated] = useState(false);

  useEffect(() => {
    api<HistoryPage>("/api/rides/history")
      .then((page) => setEnded(page.rides.find((past) => past.id === ride.id) ?? null))
      .catch(() => setEnded(null));
  }, [ride.id]);

  const screen = (pins: MapPin[], children: ReactNode) => (
    <MapScreen pins={pins} label="Map of your ride">
      {children}
    </MapScreen>
  );

  if (ended === undefined) return screen(stopPin(ride, "dropoff"), <p role="status">Loading your ride…</p>);
  if (!ended) {
    return screen(
      stopPin(ride, "dropoff"),
      <>
        <h1 className="sheet-title">Your ride is over</h1>
        <ButtonLink href="/student/history">See it in History</ButtonLink>
      </>,
    );
  }
  if (ended.status === "canceled") {
    return screen(
      stopPin(ended, "pickup"),
      <>
        <div role="status">
          <h1 className="sheet-title">Your ride was canceled</h1>
          {ended.cancelReason && <p className="sub">{ended.cancelReason}</p>}
        </div>
        <ButtonLink href="/student">Request another ride</ButtonLink>
      </>,
    );
  }
  if (ended.status === "no_show") {
    return screen(
      stopPin(ended, "pickup"),
      <>
        <div role="status">
          <h1 className="sheet-title">Marked as a no-show</h1>
          <p className="sub">Your cart waited at {ended.pickup.name}. If that&apos;s wrong, talk to a Stripes admin.</p>
        </div>
        <ButtonLink href="/student">Done</ButtonLink>
      </>,
    );
  }
  return screen(
    stopPin(ended, "dropoff"),
    <>
      <p role="status" className="ok-banner"><Icon name="check" />You&apos;ve arrived</p>
      {rated || ended.rating ? (
        <>
          <h1 className="sheet-title">Thanks for rating your ride</h1>
          <ButtonLink href="/student">Done</ButtonLink>
        </>
      ) : (
        <>
          <div>
            <h1 className="sheet-title">How was your ride?</h1>
            <p className="sub">
              {ended.pickup.name} to {ended.dropoff.name}
              {ended.driver && ` with ${ended.driver.callSign}`}
            </p>
          </div>
          <RatingForm ride={ended} legend="Rating, 1 is poor and 5 is great" onRated={() => setRated(true)} onSkip={() => router.push("/student")} />
        </>
      )}
    </>,
  );
}
