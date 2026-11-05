"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/components/api";
import { Button } from "@/components/Button";
import type { MapPin } from "@/components/CampusMap";
import { Field, SelectField } from "@/components/Field";
import { LazyCampusMap } from "@/components/LazyCampusMap";
import { RideCard } from "@/components/RideCard";
import { ServiceSwitch } from "@/components/ServiceSwitch";
import { usePolling } from "@/components/usePolling";
import { isFresh } from "@/lib/server/position";
import type { AdminBoard, BoardDriver, RideStatus, StaffRide } from "@/lib/types";

type Reload = () => Promise<void>;

/** A driver may still be reassigned, unassigned or canceled on these; once riding, the ride is the driver's to finish. */
const MOVABLE: RideStatus[] = ["requested", "assigned", "en_route", "arrived"];

export default function AdminHome() {
  const { data: board, error, refresh } = usePolling<AdminBoard>("/api/admin/board");
  const free = board?.drivers.filter((driver) => driver.rides.length === 0) ?? [];
  const busy = board?.drivers.filter((driver) => driver.rides.length > 0) ?? [];

  return (
    <main className="page wide stack">
      <h1>Service board</h1>
      <ServiceSwitch />
      {!board ? (
        <p role="status" className={error ? "form-error" : undefined}>{error ?? "Loading the board…"}</p>
      ) : (
        <>
          {error && <p role="alert" className="form-error">{error}</p>}
          <LazyCampusMap pins={boardPins(board)} label="Map of drivers and waiting pickups" />
          <div className="board">
            <section className="stack" aria-labelledby="waiting-heading">
              <h2 id="waiting-heading">Waiting ({board.waiting.length})</h2>
              {board.waiting.length === 0 && <p className="muted">No rides waiting.</p>}
              {board.waiting.map((ride) => (
                <RideCard key={ride.id} ride={ride}>
                  <RideControls ride={ride} drivers={board.drivers} reload={refresh} />
                </RideCard>
              ))}
            </section>
            <section className="stack" aria-labelledby="free-heading">
              <h2 id="free-heading">Drivers ({free.length})</h2>
              {board.drivers.length === 0 && <p className="muted">No drivers on shift.</p>}
              {board.drivers.length > 0 && free.length === 0 && <p className="muted">Every driver has a ride.</p>}
              {free.map((driver) => (
                <article key={driver.id} className="card">
                  <DriverName driver={driver} />
                  <p className="muted">Free</p>
                </article>
              ))}
            </section>
            <section className="stack" aria-labelledby="route-heading">
              <h2 id="route-heading">On a route ({busy.length})</h2>
              {busy.length === 0 && <p className="muted">No driver has a ride.</p>}
              {busy.map((driver) => (
                <div key={driver.id} className="stack driver-group">
                  <DriverName driver={driver} />
                  {driver.rides.map((ride) => (
                    <RideCard key={ride.id} ride={ride}>
                      {MOVABLE.includes(ride.status) && <RideControls ride={ride} drivers={board.drivers} reload={refresh} />}
                    </RideCard>
                  ))}
                </div>
              ))}
            </section>
          </div>
        </>
      )}
    </main>
  );
}

/** Every driver with a known position, and every stop with riders waiting (one pin per stop). */
function boardPins(board: AdminBoard): MapPin[] {
  const pins: MapPin[] = [];
  for (const { id, callSign, position } of board.drivers) {
    if (!position) continue;
    const live = isFresh(position);
    pins.push({
      id,
      kind: live ? "cart" : "stale",
      lat: position.lat,
      lng: position.lng,
      label: live ? callSign : `${callSign}: no recent location`,
    });
  }
  for (const { pickup } of board.waiting) {
    const waiting = board.waiting.filter((ride) => ride.pickup.id === pickup.id).length;
    if (pins.some((pin) => pin.id === pickup.id)) continue;
    pins.push({ id: pickup.id, kind: "stop", lat: pickup.lat, lng: pickup.lng, label: `${pickup.name}: ${waiting} waiting` });
  }
  return pins;
}

function DriverName({ driver }: { driver: BoardDriver }) {
  return (
    <p className="banner-title">
      {driver.callSign} · Cart {driver.cart.number} <span className="muted-inline">({driver.name}, {driver.cart.seats} seats)</span>
    </p>
  );
}

/** Assign or reassign, unassign and cancel. Only drivers whose cart fits the party are offered. */
function RideControls({ ride, drivers, reload }: { ride: StaffRide; drivers: BoardDriver[]; reload: Reload }) {
  const held = ride.status !== "requested";
  const choices = drivers.filter((driver) => ride.partySize <= driver.cart.seats - 1 && driver.callSign !== ride.driver?.callSign);
  const [driverId, setDriverId] = useState("");
  const [canceling, setCanceling] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function act(action: string, body?: object) {
    setBusy(true);
    setError(undefined);
    try {
      await api(`/api/admin/rides/${ride.id}/${action}`, "POST", body);
      setDriverId("");
      setCanceling(false);
      await reload();
    } catch (e) {
      setError((e as Error).message);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  if (canceling) {
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
        <Button type="button" variant="secondary" onClick={() => setCanceling(false)} disabled={busy}>Back</Button>
      </form>
    );
  }

  function assign(event: FormEvent) {
    event.preventDefault();
    act("assign", { driverId });
  }

  return (
    <div className="stack">
      <form className="stack" onSubmit={assign}>
        <SelectField
          label={held ? "Give to another driver" : "Assign to"}
          value={driverId}
          onChange={(e) => setDriverId(e.target.value)}
          hint={choices.length === 0 ? (drivers.length === 0 ? "No drivers on shift." : "No other cart fits this party.") : undefined}
          required
        >
          <option value="">Choose a driver</option>
          {choices.map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.callSign}, Cart {driver.cart.number}
              {driver.rides.length > 0 ? ` (has ${driver.rides.length})` : " (free)"}
            </option>
          ))}
        </SelectField>
        <Button type="submit" disabled={busy || !driverId}>{busy ? "Saving…" : held ? "Reassign" : "Assign"}</Button>
      </form>
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="ride-actions">
        {held && (
          <Button variant="secondary" onClick={() => act("unassign")} disabled={busy}>Unassign</Button>
        )}
        <Button variant="secondary" onClick={() => setCanceling(true)} disabled={busy}>Cancel ride</Button>
      </div>
    </div>
  );
}
