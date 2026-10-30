"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { api } from "@/components/api";
import { Button } from "@/components/Button";
import { Field, SelectField } from "@/components/Field";
import { RideCard } from "@/components/RideCard";
import { usePolling } from "@/components/usePolling";
import type { Cart, DriverQueue, RideStatus, Shift, StaffRide } from "@/lib/types";

type Reload = () => Promise<void>;

export default function DriverHome() {
  const { data: queue, error, refresh } = usePolling<DriverQueue>("/api/driver/queue");
  // Kept here, not on the ride's card: a ride someone else claimed first leaves the list, card and all.
  const [claimError, setClaimError] = useState<string>();

  if (!queue) {
    return (
      <Page>
        <p role="status" className={error ? "form-error" : undefined}>{error ?? "Loading your shift…"}</p>
      </Page>
    );
  }

  return (
    <Page>
      {error && <p role="alert" className="form-error">{error}</p>}
      {queue.shift ? <ShiftCard shift={queue.shift} reload={refresh} /> : <StartShift reload={refresh} />}
      {(queue.shift || queue.mine.length > 0) && (
        <section className="stack" aria-labelledby="mine-heading">
          <h2 id="mine-heading">Your rides</h2>
          {queue.mine.length === 0 && <p className="muted">None yet. Claim a waiting ride below.</p>}
          {queue.mine.map((ride) => (
            <RideCard key={ride.id} ride={ride}>
              <MyRideActions ride={ride} reload={refresh} />
            </RideCard>
          ))}
        </section>
      )}
      {queue.shift && (
        <section className="stack" aria-labelledby="waiting-heading">
          <h2 id="waiting-heading">Waiting</h2>
          {claimError && <p role="alert" className="form-error">{claimError}</p>}
          {queue.waiting.length === 0 && <p className="muted">No rides waiting.</p>}
          {queue.waiting.map((ride) => (
            <RideCard key={ride.id} ride={ride}>
              <ClaimButton ride={ride} cart={queue.shift!.cart} reload={refresh} onResult={setClaimError} />
            </RideCard>
          ))}
        </section>
      )}
    </Page>
  );
}

function Page({ children }: { children: ReactNode }) {
  return (
    <main className="page stack">
      <h1>Your shift</h1>
      {children}
    </main>
  );
}

function StartShift({ reload }: { reload: Reload }) {
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

  return (
    <form className="card stack" onSubmit={start}>
      <p className="lead">You are off shift. Choose your cart to start.</p>
      <SelectField label="Cart" value={cartId} onChange={(e) => setCartId(e.target.value)} error={error} required disabled={!carts}>
        <option value="">{carts ? "Choose a cart" : "Loading carts…"}</option>
        {carts?.map((cart) => (
          <option key={cart.id} value={cart.id} disabled={!!cart.inUseBy}>
            Cart {cart.number}, {cart.seats} seats{cart.inUseBy ? ` (${cart.inUseBy} has it)` : ""}
          </option>
        ))}
      </SelectField>
      <Button type="submit" disabled={busy || !carts}>{busy ? "Starting…" : "Start shift"}</Button>
    </form>
  );
}

function ShiftCard({ shift, reload }: { shift: Shift; reload: Reload }) {
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const since = new Date(shift.startedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" });

  async function end() {
    setBusy(true);
    setError(undefined);
    try {
      await api("/api/driver/shift", "DELETE");
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card stack">
      <p className="banner-title">
        On shift with Cart {shift.cart.number} since {since}
      </p>
      {error && <p role="alert" className="form-error">{error}</p>}
      <Button variant="secondary" onClick={end} disabled={busy}>{busy ? "Ending…" : "End shift"}</Button>
    </div>
  );
}

/** `onResult` gets the error message when the claim fails, or undefined when it works. */
function ClaimButton({ ride, cart, reload, onResult }: { ride: StaffRide; cart: Cart; reload: Reload; onResult: (error?: string) => void }) {
  const [busy, setBusy] = useState(false);
  const fits = ride.partySize <= cart.seats - 1;

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
    <>
      {!fits && <p className="field-hint">Too many riders for Cart {cart.number}.</p>}
      <Button onClick={claim} disabled={busy || !fits}>{busy ? "Claiming…" : "Claim"}</Button>
    </>
  );
}

/** The next steps for a ride the driver holds, by status. */
const NEXT: Partial<Record<RideStatus, { action: string; label: string }[]>> = {
  assigned: [
    { action: "en-route", label: "On my way" },
    { action: "arrived", label: "Arrived" },
  ],
  en_route: [{ action: "arrived", label: "Arrived" }],
  arrived: [{ action: "start", label: "Start ride" }],
  in_progress: [{ action: "complete", label: "Complete ride" }],
};

const CANCELABLE: RideStatus[] = ["assigned", "en_route", "arrived"];

function MyRideActions({ ride, reload }: { ride: StaffRide; reload: Reload }) {
  const [confirm, setConfirm] = useState<"no-show" | "cancel">();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function act(action: string, body?: object) {
    setBusy(true);
    setError(undefined);
    try {
      await api(`/api/driver/rides/${ride.id}/${action}`, "POST", body);
      setConfirm(undefined);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (confirm === "no-show") {
    return (
      <div className="stack">
        <p className="banner-title">Mark {ride.student.name} as a no-show?</p>
        {error && <p role="alert" className="form-error">{error}</p>}
        <Button variant="danger" onClick={() => act("no-show")} disabled={busy}>{busy ? "Saving…" : "Yes, no-show"}</Button>
        <Button variant="secondary" onClick={() => setConfirm(undefined)} disabled={busy}>Back</Button>
      </div>
    );
  }

  if (confirm === "cancel") {
    return (
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          act("cancel", { reason });
        }}
      >
        <Field label="Why cancel?" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} error={error} required />
        <Button type="submit" variant="danger" disabled={busy}>{busy ? "Canceling…" : "Cancel ride"}</Button>
        <Button type="button" variant="secondary" onClick={() => setConfirm(undefined)} disabled={busy}>Back</Button>
      </form>
    );
  }

  return (
    <div className="stack">
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="ride-actions">
        {NEXT[ride.status]?.map(({ action, label }) => (
          <Button key={action} onClick={() => act(action)} disabled={busy}>{label}</Button>
        ))}
      </div>
      <div className="ride-actions">
        {ride.status === "arrived" && (
          <Button variant="secondary" onClick={() => setConfirm("no-show")} disabled={busy}>No-show</Button>
        )}
        {CANCELABLE.includes(ride.status) && (
          <Button variant="secondary" onClick={() => setConfirm("cancel")} disabled={busy}>Cancel ride</Button>
        )}
      </div>
    </div>
  );
}
