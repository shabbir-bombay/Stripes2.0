"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { api } from "@/components/api";
import { Button, ButtonLink } from "@/components/Button";
import type { MapPin } from "@/components/CampusMap";
import { Icon } from "@/components/Icon";
import { MapScreen } from "@/components/MapScreen";
import { changeTime } from "@/components/serviceStatus";
import { Stepper } from "@/components/Stepper";
import type { CreateRideRequest, Ride, ServiceStatus, Stop } from "@/lib/types";

/** One screen: pickup and drop-off as a route, riders, and Request ride. `?pickup=&dropoff=` fills it in ("Ride again"). */
export default function RequestRide() {
  const router = useRouter();
  const [stops, setStops] = useState<Stop[]>();
  const [service, setService] = useState<ServiceStatus>();
  const [loadError, setLoadError] = useState<string>();
  const [request, setRequest] = useState<CreateRideRequest>({ pickupId: "", dropoffId: "", partySize: 1 });
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api<Stop[]>("/api/stops"), api<ServiceStatus>("/api/service-status"), api<Ride | null>("/api/rides/active")])
      .then(([stops, service, ride]) => {
        // One ride at a time: a student who already has one goes to it instead.
        if (ride) return router.replace("/student/ride");
        const params = new URLSearchParams(window.location.search);
        const known = (id: string | null) => (id && stops.some((stop) => stop.id === id) ? id : "");
        setRequest((current) => ({ ...current, pickupId: known(params.get("pickup")), dropoffId: known(params.get("dropoff")) }));
        setStops(stops);
        setService(service);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [router]);

  const set = (change: Partial<CreateRideRequest>) => {
    setRequest((current) => ({ ...current, ...change }));
    setError(undefined);
  };

  const pickup = stops?.find((stop) => stop.id === request.pickupId);
  const dropoff = stops?.find((stop) => stop.id === request.dropoffId);
  const pins: MapPin[] = [];
  if (pickup) pins.push({ id: "pickup", kind: "pickup", lat: pickup.lat, lng: pickup.lng, label: "Pickup" });
  if (dropoff) pins.push({ id: "dropoff", kind: "dropoff", lat: dropoff.lat, lng: dropoff.lng, label: "Drop-off" });
  if (pins.length === 0 && stops) {
    for (const stop of stops) pins.push({ id: stop.id, kind: "campus-stop", lat: stop.lat, lng: stop.lng, label: stop.name, showLabel: false });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (request.pickupId === request.dropoffId) return setError("Pick a drop-off that isn't your pickup.");
    setBusy(true);
    setError(undefined);
    try {
      await api<Ride>("/api/rides", "POST", request);
      router.push("/student/ride");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const screen = (children: ReactNode) => (
    <MapScreen pins={pins} label="Map of your pickup and drop-off">
      <h1 className="sheet-title">Request a ride</h1>
      {children}
    </MapScreen>
  );

  if (loadError) return screen(<p role="alert" className="form-error">{loadError}</p>);
  if (!stops || !service) return screen(<p role="status">Loading stops…</p>);
  if (!service.open) {
    return screen(
      <>
        <div role="status" className="banner closed">
          <p className="banner-title">Stripes is closed</p>
          <p>{service.nextChange ? `It opens ${changeTime(service.nextChange)}.` : "No rides can be requested right now."}</p>
        </div>
        <ButtonLink href="/student" variant="tonal">Back</ButtonLink>
      </>,
    );
  }

  return screen(
    <form className="stack" onSubmit={submit}>
      <div className="picker" role="group" aria-label="Route">
        <StopRow label="Pickup" mark="pickup" value={request.pickupId} stops={stops} onChange={(pickupId) => set({ pickupId })} />
        <StopRow label="Drop-off" mark="dropoff" value={request.dropoffId} stops={stops} onChange={(dropoffId) => set({ dropoffId })} />
        <button
          type="button"
          className="swap"
          aria-label="Swap pickup and drop-off"
          onClick={() => set({ pickupId: request.dropoffId, dropoffId: request.pickupId })}
        >
          <Icon name="swap" small />
        </button>
      </div>
      <Stepper
        label="Riders"
        hint={`Including you · up to ${service.maxPartySize}`}
        value={Math.min(request.partySize, service.maxPartySize)}
        min={1}
        max={service.maxPartySize}
        onChange={(partySize) => set({ partySize })}
      />
      {error && <p role="alert" className="form-error">{error}</p>}
      <Button type="submit" size="big" disabled={busy}>{busy ? "Requesting…" : "Request ride"}</Button>
      <p className="small center-text">You can cancel any time before pickup.</p>
    </form>,
  );
}

function StopRow({ label, mark, value, stops, onChange }: {
  label: string;
  mark: "pickup" | "dropoff";
  value: string;
  stops: Stop[];
  onChange: (id: string) => void;
}) {
  const id = useId();
  return (
    <div className="pick">
      <span className="route-marks" aria-hidden="true">
        <span className={mark === "pickup" ? "mark-pickup" : "mark-dropoff"} />
      </span>
      <div>
        <label htmlFor={id}>{label}</label>
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} required>
          <option value="">Choose a stop</option>
          {stops.map((stop) => (
            <option key={stop.id} value={stop.id}>
              {stop.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
