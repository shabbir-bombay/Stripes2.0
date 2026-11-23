"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ActionSheet } from "@/components/ActionSheet";
import { api } from "@/components/api";
import { Button } from "@/components/Button";
import type { MapPin } from "@/components/CampusMap";
import { Field, SelectField } from "@/components/Field";
import { Icon } from "@/components/Icon";
import { MapScreen } from "@/components/MapScreen";
import { useMe } from "@/components/me";
import { CartPlate, clockTime, firstName, minutesSince, riders, RouteStops } from "@/components/RideParts";
import { SignOutButton } from "@/components/SignOutButton";
import { useLocationSharing } from "@/components/useLocationSharing";
import { usePolling } from "@/components/usePolling";
import { distanceMeters } from "@/lib/server/position";
import type { Cart, DriverQueue, PenaltyPointRequest, RideStatus, Shift, StaffRide, Stop } from "@/lib/types";

type Reload = () => Promise<void>;
type Point = { lat: number; lng: number } | null;

export default function DriverHome() {
  const { data: queue, error, refresh } = usePolling<DriverQueue>("/api/driver/queue");
  // Kept here, above every screen: a no-show ride leaves the list at once (it may have been the last one held),
  // and this is the moment a driver asks for a point.
  const [noShow, setNoShow] = useState<StaffRide>();
  const offer = noShow && (
    <div className="request-card">
      <p className="strong">{noShow.student.name} was marked as a no-show</p>
      <p className="small">Do you want to ask an admin for a penalty point?</p>
      <PenaltyForm key={noShow.id} ride={noShow} initialReason="Didn't show up" onDone={() => setNoShow(undefined)} cancelLabel="No thanks" />
    </div>
  );

  if (!queue) {
    return (
      <main className="page">
        <p role="status" className={error ? "form-error" : undefined}>{error ?? "Loading your shift…"}</p>
      </main>
    );
  }
  if (queue.shift) return <OnShift shift={queue.shift} queue={queue} error={error} reload={refresh} offer={offer} onNoShow={setNoShow} />;
  // Rides held after a shift ended (a rare race) still need finishing; the actions work without a shift.
  if (queue.mine.length > 0) return <HeldOffShift rides={queue.mine} reload={refresh} offer={offer} onNoShow={setNoShow} />;
  return <StartShift reload={refresh} offer={offer} />;
}

function StartShift({ reload, offer }: { reload: Reload; offer: ReactNode }) {
  const { name } = useMe();
  const [carts, setCarts] = useState<Cart[]>();
  const [cartId, setCartId] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const loadCarts = () =>
    api<Cart[]>("/api/carts")
      .then((carts) => setCarts(carts.filter((cart) => cart.active)))
      .catch((e: Error) => setError(e.message));
  useEffect(() => {
    loadCarts();
  }, []);

  async function start(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await api<Shift>("/api/driver/shift", "POST", { cartId });
      await reload();
    } catch (e) {
      setError((e as Error).message);
      await loadCarts();
      setBusy(false);
    }
  }

  const chosen = carts?.find((cart) => cart.id === cartId);
  return (
    <main className="page stack">
      <div>
        <h1 className="page-title">Start your shift</h1>
        <p className="sub">{name ? `Hi ${firstName(name)}. ` : ""}Pick the cart you&apos;re driving.</p>
      </div>
      {offer}
      <form className="stack" onSubmit={start}>
        <fieldset className="cart-tiles" disabled={busy}>
          <legend className="sr-only">Cart</legend>
          {!carts && !error && <p role="status">Loading carts…</p>}
          {carts?.length === 0 && <p className="muted">No carts are in service. Ask an admin to add one.</p>}
          {carts?.map((cart) => (
            <label key={cart.id} className="cart-tile">
              <input
                type="radio"
                name="cart"
                value={cart.id}
                checked={cartId === cart.id}
                disabled={!!cart.inUseBy}
                onChange={() => setCartId(cart.id)}
              />
              <span aria-hidden="true">
                <CartPlate number={cart.number} size="compact" />
              </span>
              <span>
                <span className="strong block">Cart {cart.number}</span>
                <span className="small block">
                  {cart.seats} seats · {cart.inUseBy ? `${cart.inUseBy} has it` : `up to ${cart.seats - 1} riders`}
                </span>
              </span>
              <span className="radio-mark" aria-hidden="true" />
            </label>
          ))}
        </fieldset>
        {error && <p role="alert" className="form-error">{error}</p>}
        <Button type="submit" size="big" disabled={busy || !chosen}>
          {busy ? "Starting…" : chosen ? `Start shift with Cart ${chosen.number}` : "Start shift"}
        </Button>
        <p className="field-hint center-text">Starting shares your location with riders and admins until you end the shift.</p>
      </form>
      <SignOutButton variant="quiet" className="sign-out" />
    </main>
  );
}

/** The ride to show first: riders on board come first, so the drop-off stays next even if an older ride is held. */
function currentRide(mine: StaffRide[]) {
  return mine.find((held) => held.status === "in_progress") ?? mine[0];
}

/** Straight-line distance, "0.4 km", or nothing without a position. */
function away(from: Point, to: { lat: number; lng: number }) {
  if (!from) return null;
  const meters = distanceMeters(from, to);
  return meters < 100 ? "Under 0.1 km" : `${(meters / 1000).toFixed(1)} km`;
}

/** Mounted only while on shift, so location sharing starts and stops with the shift. */
function OnShift({ shift, queue, error, reload, offer, onNoShow }: {
  shift: Shift;
  queue: DriverQueue;
  error?: string;
  reload: Reload;
  offer: ReactNode;
  onNoShow: (ride: StaffRide) => void;
}) {
  const location = useLocationSharing();
  const [stops, setStops] = useState<Stop[]>([]);
  // Kept here, not on the ride's card: a ride someone else claimed first leaves the list, card and all.
  const [claimError, setClaimError] = useState<string>();
  const [justCompleted, setJustCompleted] = useState(false);
  const [endError, setEndError] = useState<string>();
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    api<Stop[]>("/api/stops").then(setStops).catch(() => {});
  }, []);

  const current = currentRide(queue.mine);
  const others = queue.mine.filter((ride) => ride !== current);

  useEffect(() => {
    if (current) setJustCompleted(false);
  }, [current]);

  const pins: MapPin[] = [];
  if (current) {
    const stop = current.status === "in_progress" ? current.dropoff : current.pickup;
    const kind = current.status === "in_progress" ? "dropoff" : "pickup";
    pins.push({ id: `${kind}-${stop.id}`, kind, lat: stop.lat, lng: stop.lng, label: kind === "pickup" ? "Pickup" : "Drop-off" });
  } else if (queue.waiting[0]) {
    const { pickup } = queue.waiting[0];
    pins.push({ id: `pickup-${pickup.id}`, kind: "pickup", lat: pickup.lat, lng: pickup.lng, label: "Pickup" });
  } else {
    for (const stop of stops) pins.push({ id: stop.id, kind: "campus-stop", lat: stop.lat, lng: stop.lng, label: stop.name, showLabel: false });
  }
  if (location.position) pins.push({ id: "me", kind: "vehicle", ...location.position, label: "You", showLabel: false });

  async function endShift() {
    setEnding(true);
    setEndError(undefined);
    try {
      await api("/api/driver/shift", "DELETE");
      await reload();
    } catch (e) {
      setEndError((e as Error).message);
      setEnding(false);
    }
  }

  const problem = location.problem;
  const chip = problem?.kind === "paused" ? "Location paused" : problem ? "Location off" : `On shift · Cart ${shift.cart.number}`;
  const dot = problem?.kind === "paused" ? "warn" : problem || !location.sharing ? "off" : "";

  return (
    <MapScreen
      pins={pins}
      label={current ? `Map of your next stop and your cart` : "Map of your cart"}
      top={
        <>
          <p role="status" className="chip">
            <span className={`dot ${dot}`} aria-hidden="true" />
            {chip}
            {!problem && <span className="sr-only">{location.sharing ? ". Sharing your location" : ". Finding your location"}</span>}
          </p>
          {queue.mine.length === 0 && (
            <button type="button" className="chip" onClick={endShift} disabled={ending}>
              {ending ? "Ending…" : "End shift"}
            </button>
          )}
        </>
      }
    >
      {error && <p role="alert" className="form-error">{error}</p>}
      {endError && <p role="alert" className="form-error">{endError}</p>}
      {offer}
      {justCompleted && !current && <p role="status" className="ok-banner"><Icon name="check" />Ride complete. Nice work.</p>}

      {current && (
        // Keyed to the ride: when another ride becomes the current one, nothing open on this card (a cancel form, the menu) carries over.
        <TaskCard key={current.id} ride={current} position={location.position} reload={reload} onNoShow={onNoShow} onCompleted={() => setJustCompleted(true)} main />
      )}
      {others.length > 0 && (
        <>
          <h2 className="section-label">Also yours</h2>
          {others.map((ride) => (
            <div key={ride.id} className="request-card">
              <TaskCard ride={ride} position={location.position} reload={reload} onNoShow={onNoShow} onCompleted={() => setJustCompleted(true)} />
            </div>
          ))}
        </>
      )}

      {queue.waiting.length > 0 ? (
        <>
          {current ? (
            <h2 className="section-label">Waiting ({queue.waiting.length})</h2>
          ) : (
            <div className="split">
              <h1 className="sheet-title">{queue.waiting.length === 1 ? "1 ride waiting" : `${queue.waiting.length} rides waiting`}</h1>
              <p className="small">You have none yet</p>
            </div>
          )}
          {claimError && <p role="alert" className="form-error">{claimError}</p>}
          {queue.waiting.map((ride) => (
            <WaitingCard key={ride.id} ride={ride} cart={shift.cart} position={location.position} main={!current} reload={reload} onResult={setClaimError} />
          ))}
        </>
      ) : (
        !current && (
          <div>
            <h1 className="sheet-title">No rides waiting</h1>
            <p className="sub">New requests show up here on their own. Keep this screen open.</p>
          </div>
        )
      )}

      {problem?.kind === "paused" && <p className="warn-chip"><Icon name="location" small />{problem.text}</p>}
      {problem?.kind === "error" && <p role="alert" className="form-error">{problem.text}</p>}
      <p className="small">On shift with Cart {shift.cart.number} since {clockTime(shift.startedAt)}</p>
    </MapScreen>
  );
}

function HeldOffShift({ rides, reload, offer, onNoShow }: { rides: StaffRide[]; reload: Reload; offer: ReactNode; onNoShow: (ride: StaffRide) => void }) {
  return (
    <main className="page stack">
      <h1 className="page-title">Finish your rides</h1>
      <p className="sub">Your shift has ended, but you still hold these rides.</p>
      {offer}
      {rides.map((ride) => (
        <div key={ride.id} className="request-card">
          <TaskCard ride={ride} position={null} reload={reload} onNoShow={onNoShow} onCompleted={() => {}} />
        </div>
      ))}
    </main>
  );
}

/** A waiting request: place in line, how long it's waited, the route, who, how far, and Claim. */
function WaitingCard({ ride, cart, position, main, reload, onResult }: {
  ride: StaffRide;
  cart: Cart;
  position: Point;
  main: boolean;
  reload: Reload;
  onResult: (error?: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const fits = ride.partySize <= cart.seats - 1;
  const distance = away(position, ride.pickup);

  async function claim() {
    setBusy(true);
    onResult(undefined);
    try {
      await api(`/api/driver/rides/${ride.id}/claim`, "POST");
    } catch (e) {
      onResult(`Couldn't claim the ride from ${ride.pickup.name}: ${(e as Error).message}`);
    }
    await reload();
    setBusy(false);
  }

  return (
    <article className="request-card" aria-label={`Ride from ${ride.pickup.name} to ${ride.dropoff.name}`}>
      <div className="split">
        <span className="pill accent">#{ride.queuePosition} in line</span>
        <span className="meta"><span><Icon name="clock" small />Waiting {minutesSince(ride.requestedAt)} min</span></span>
      </div>
      <RouteStops pickup={ride.pickup.name} dropoff={ride.dropoff.name} />
      <p className="meta">
        <span><Icon name="people" small />{riders(ride.partySize)} · {ride.student.name}</span>
        {distance && <span><Icon name="pin" small />{distance} away</span>}
      </p>
      {!fits && <p className="field-hint">Too many riders for Cart {cart.number}.</p>}
      <Button size={main ? "big" : undefined} variant={main ? "primary" : "tonal"} onClick={claim} disabled={busy || !fits}>
        {busy ? "Claiming…" : "Claim ride"}
      </Button>
    </article>
  );
}

/** Seconds since `iso`, ticking, as "1:12". */
function useWaitClock(iso: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!iso) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [iso]);
  if (!iso) return null;
  const seconds = Math.max(0, Math.floor((now - Date.parse(iso)) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

const CANCELABLE: RideStatus[] = ["assigned", "en_route", "arrived"];

/**
 * A ride the driver holds: the task in large type, one main button for the usual next step,
 * the secondary beside it, and the rare actions behind "…".
 */
function TaskCard({ ride, position, reload, onNoShow, onCompleted, main = false }: {
  ride: StaffRide;
  position: Point;
  reload: Reload;
  onNoShow: (ride: StaffRide) => void;
  onCompleted: () => void;
  main?: boolean;
}) {
  const [confirm, setConfirm] = useState<"no-show" | "cancel" | "penalty">();
  const [menu, setMenu] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const waited = useWaitClock(ride.status === "arrived" ? ride.arrivedAt : null);

  async function act(action: string, body?: object) {
    setBusy(true);
    setError(undefined);
    try {
      await api(`/api/driver/rides/${ride.id}/${action}`, "POST", body);
      if (action === "no-show") onNoShow(ride);
      if (action === "complete") onCompleted();
      setConfirm(undefined);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const name = firstName(ride.student.name);
  const riding = ride.status === "in_progress";
  const stop = riding ? ride.dropoff : ride.pickup;
  const title = riding ? `Drop off ${name}` : ride.status === "arrived" ? `Waiting for ${name}` : `Pick up ${name}`;
  const distance = away(position, stop);
  const Heading = main ? "h1" : "h2";

  const more = (
    <button type="button" className="icon-button" aria-label="More actions" aria-haspopup="dialog" onClick={() => setMenu(true)} disabled={busy}>
      <Icon name="more" />
    </button>
  );

  let actions: ReactNode;
  if (confirm === "penalty") {
    actions = <PenaltyForm ride={ride} onDone={() => setConfirm(undefined)} autoFocus />;
  } else if (confirm === "no-show") {
    actions = (
      <div className="stack">
        <p className="strong">Mark {ride.student.name} as a no-show?</p>
        {error && <p role="alert" className="form-error">{error}</p>}
        <div className="row-buttons">
          <Button variant="tonal" onClick={() => setConfirm(undefined)} disabled={busy}>Back</Button>
          <Button variant="danger" onClick={() => act("no-show")} disabled={busy}>{busy ? "Saving…" : "Yes, no-show"}</Button>
        </div>
      </div>
    );
  } else if (confirm === "cancel") {
    actions = (
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          act("cancel", { reason });
        }}
      >
        {/* Opened from the "…" menu, whose button is gone now: focus lands here, not at the top of the page. */}
        <Field label="Why cancel?" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} error={error} required autoFocus />
        <div className="row-buttons">
          <Button type="button" variant="tonal" onClick={() => setConfirm(undefined)} disabled={busy}>Back</Button>
          <Button type="submit" variant="danger" disabled={busy}>{busy ? "Canceling…" : "Cancel ride"}</Button>
        </div>
      </form>
    );
  } else {
    const size = main ? "big" : undefined;
    actions = (
      <>
        {error && <p role="alert" className="form-error">{error}</p>}
        {ride.status === "assigned" && (
          <>
            <Button size={size} onClick={() => act("en-route")} disabled={busy}><Icon name="navigate" />I&apos;m on my way</Button>
            <div className="row-buttons">
              <Button variant="tonal" onClick={() => act("arrived")} disabled={busy}>I&apos;ve arrived</Button>
              {more}
            </div>
          </>
        )}
        {ride.status === "en_route" && (
          <div className="row-buttons">
            <Button size={size} onClick={() => act("arrived")} disabled={busy}>I&apos;ve arrived</Button>
            {more}
          </div>
        )}
        {ride.status === "arrived" && (
          <>
            <Button size={size} onClick={() => act("start")} disabled={busy}>Start ride</Button>
            <div className="row-buttons">
              <Button variant="tonal" onClick={() => setConfirm("no-show")} disabled={busy}>Rider didn&apos;t show</Button>
              {more}
            </div>
          </>
        )}
        {riding && (
          <>
            <Button size={size} onClick={() => act("complete")} disabled={busy}><Icon name="check" />Complete ride</Button>
            <Button variant="quiet" onClick={() => setConfirm("penalty")} disabled={busy}>Request penalty point</Button>
          </>
        )}
      </>
    );
  }

  return (
    <>
      <div className={waited ? "split top" : undefined}>
        <div>
          <Heading className={main ? "task" : "task compact"}>{title}</Heading>
          <p className="task-stop">{stop.name}</p>
        </div>
        {waited && (
          <div className="end" role="timer" aria-label={`Waiting ${waited}`}>
            <p className="big-num num wait-clock">{waited}</p>
            <p className="small">waiting</p>
          </div>
        )}
      </div>
      <p className="meta">
        {!riding && ride.status !== "arrived" && (distance || ride.eta) && (
          <span>
            <Icon name="pin" small />
            {[distance, ride.eta && `about ${ride.eta.minMinutes}–${ride.eta.maxMinutes} min`].filter(Boolean).join(" · ")}
          </span>
        )}
        {riding && distance && <span><Icon name="pin" small />{distance}</span>}
        {!riding && <span><Icon name="people" small />{riders(ride.partySize)}</span>}
        <span>{riding ? `Picked up at ${ride.pickup.name}` : `Then to ${ride.dropoff.name}`}</span>
      </p>
      {actions}
      <ActionSheet
        open={menu}
        title={`${ride.student.name} · ${ride.pickup.name}`}
        onClose={() => setMenu(false)}
        actions={[
          { label: "Request penalty point", onSelect: () => setConfirm("penalty") },
          ...(CANCELABLE.includes(ride.status) ? [{ label: "Cancel ride", destructive: true, onSelect: () => setConfirm("cancel") }] : []),
        ]}
      />
    </>
  );
}

/** The spec's reasons a driver can pick from. "Other" asks them to type it. */
const PENALTY_REASONS = [
  "Late to pickup",
  "Didn't show up",
  "Rude or abusive to the driver",
  "Unsafe behavior in the cart",
  "Damage to the cart",
  "Wrong pickup location given",
];
const OTHER = "Other";

/** Asks an admin for a penalty point on this ride. */
function PenaltyForm({ ride, initialReason = PENALTY_REASONS[0], onDone, cancelLabel = "Back", autoFocus = false }: {
  ride: StaffRide;
  initialReason?: string;
  onDone: (sent: boolean) => void;
  cancelLabel?: string;
  autoFocus?: boolean;
}) {
  const [choice, setChoice] = useState(initialReason);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await api(`/api/driver/rides/${ride.id}/penalty-point`, "POST", { reason: choice === OTHER ? typed : choice } satisfies PenaltyPointRequest);
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="stack">
        <p role="status">Sent. An admin will decide, and {ride.student.name} only sees it if it&apos;s approved.</p>
        <Button variant="tonal" onClick={() => onDone(true)}>Done</Button>
      </div>
    );
  }

  return (
    <form className="stack" onSubmit={submit}>
      <SelectField label="Reason" value={choice} onChange={(e) => setChoice(e.target.value)} autoFocus={autoFocus}>
        {PENALTY_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
        <option value={OTHER}>{OTHER}</option>
      </SelectField>
      {choice === OTHER && <Field label="What happened?" value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={200} required />}
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="row-buttons">
        <Button type="button" variant="tonal" onClick={() => onDone(false)} disabled={busy}>{cancelLabel}</Button>
        <Button type="submit" disabled={busy}>{busy ? "Sending…" : "Request penalty point"}</Button>
      </div>
    </form>
  );
}
