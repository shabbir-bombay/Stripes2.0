"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Button, ButtonLink } from "@/components/Button";
import { SelectField } from "@/components/Field";
import { ServiceBanner } from "@/components/ServiceBanner";
import { Stepper } from "@/components/Stepper";
import { rides } from "@/lib/mocks";
import type { ApiError, CreateRideRequest, Ride, ServiceStatus, Stop } from "@/lib/types";

type Step = "choose" | "confirm" | "done";

export default function RequestRide() {
  const [stops, setStops] = useState<Stop[]>();
  const [service, setService] = useState<ServiceStatus>();
  const [loadError, setLoadError] = useState<string>();
  const [step, setStep] = useState<Step>("choose");
  const [request, setRequest] = useState<CreateRideRequest>({ pickupId: "", dropoffId: "", partySize: 1 });
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [ride, setRide] = useState<Ride>();

  useEffect(() => {
    Promise.all([getJson<Stop[]>("/api/stops"), getJson<ServiceStatus>("/api/service-status")])
      .then(([stops, service]) => {
        setStops(stops);
        setService(service);
      })
      .catch((e) => setLoadError(e instanceof TypeError ? "Couldn't reach Stripes. Check your connection and try again." : e.message));
  }, []);

  if (loadError) return <Page><p role="alert" className="form-error">{loadError}</p></Page>;
  if (!stops || !service) return <Page><p role="status">Loading stops…</p></Page>;
  if (!service.open && step !== "done") {
    return (
      <Page>
        <ServiceBanner service={service} />
        <ButtonLink href="/student" variant="secondary">Back</ButtonLink>
      </Page>
    );
  }

  const stopName = (id: string) => stops.find((stop) => stop.id === id)?.name ?? "";
  const set = (change: Partial<CreateRideRequest>) => {
    setRequest({ ...request, ...change });
    setError(undefined);
  };

  function review(event: FormEvent) {
    event.preventDefault();
    if (request.pickupId === request.dropoffId) return setError("Pick a drop-off that isn't your pickup.");
    setError(undefined);
    setStep("confirm");
  }

  async function confirm() {
    setBusy(true);
    setError(undefined);
    try {
      setRide(await requestRide(request, stops!));
      setStep("done");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (step === "done" && ride) {
    return (
      <Page>
        <div role="status" className="banner open">
          <p className="banner-title">Ride requested</p>
          <p>{ride.queuePosition === 1 ? "You're next in line." : `You're number ${ride.queuePosition} in line.`}</p>
        </div>
        <Summary pickup={ride.pickup.name} dropoff={ride.dropoff.name} partySize={ride.partySize} />
        <ButtonLink href="/student" variant="secondary">Done</ButtonLink>
      </Page>
    );
  }

  if (step === "confirm") {
    return (
      <Page>
        <p className="lead">Check your ride, then send the request.</p>
        <Summary pickup={stopName(request.pickupId)} dropoff={stopName(request.dropoffId)} partySize={request.partySize} />
        {error && <p role="alert" className="form-error">{error}</p>}
        <Button onClick={confirm} disabled={busy}>{busy ? "Requesting…" : "Request ride"}</Button>
        <Button variant="secondary" onClick={() => setStep("choose")} disabled={busy}>Change</Button>
      </Page>
    );
  }

  return (
    <Page>
      <form className="stack" onSubmit={review}>
        <SelectField label="Pickup" value={request.pickupId} onChange={(e) => set({ pickupId: e.target.value })} required>
          <StopOptions stops={stops} />
        </SelectField>
        <SelectField
          label="Drop-off"
          value={request.dropoffId}
          onChange={(e) => set({ dropoffId: e.target.value })}
          error={error}
          required
        >
          <StopOptions stops={stops} />
        </SelectField>
        <Stepper
          label="Riders"
          value={Math.min(request.partySize, service.maxPartySize)}
          min={1}
          max={service.maxPartySize}
          onChange={(partySize) => set({ partySize })}
        />
        <Button type="submit">Next</Button>
        <ButtonLink href="/student" variant="secondary">Cancel</ButtonLink>
      </form>
    </Page>
  );
}

function Page({ children }: { children: ReactNode }) {
  return (
    <main className="page stack">
      <h1>Request a ride</h1>
      {children}
    </main>
  );
}

function StopOptions({ stops }: { stops: Stop[] }) {
  return (
    <>
      <option value="">Choose a stop</option>
      {stops.map((stop) => (
        <option key={stop.id} value={stop.id}>
          {stop.name}
        </option>
      ))}
    </>
  );
}

function Summary({ pickup, dropoff, partySize }: { pickup: string; dropoff: string; partySize: number }) {
  return (
    <dl className="card summary">
      <dt>Pickup</dt>
      <dd>{pickup}</dd>
      <dt>Drop-off</dt>
      <dd>{dropoff}</dd>
      <dt>Riders</dt>
      <dd>{partySize}</dd>
    </dl>
  );
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const body: T | ApiError = await response.json().catch(() => ({ error: "Something went wrong. Try again." }));
  if (!response.ok) throw new Error((body as ApiError).error);
  return body as T;
}

// Stands in for POST /api/rides until that endpoint exists: answers like the server would, from the mocks.
async function requestRide(request: CreateRideRequest, stops: Stop[]): Promise<Ride> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  const stop = (id: string) => stops.find((s) => s.id === id)!;
  return { ...rides.requested, pickup: stop(request.pickupId), dropoff: stop(request.dropoffId), partySize: request.partySize };
}
