"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { api } from "@/components/api";
import { Button, ButtonLink } from "@/components/Button";
import { SelectField } from "@/components/Field";
import { RideSummary } from "@/components/RideSummary";
import { ServiceBanner } from "@/components/ServiceBanner";
import { Stepper } from "@/components/Stepper";
import type { CreateRideRequest, Ride, ServiceStatus, Stop } from "@/lib/types";

type Step = "choose" | "confirm";

export default function RequestRide() {
  const router = useRouter();
  const [stops, setStops] = useState<Stop[]>();
  const [service, setService] = useState<ServiceStatus>();
  const [loadError, setLoadError] = useState<string>();
  const [step, setStep] = useState<Step>("choose");
  const [request, setRequest] = useState<CreateRideRequest>({ pickupId: "", dropoffId: "", partySize: 1 });
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api<Stop[]>("/api/stops"), api<ServiceStatus>("/api/service-status"), api<Ride | null>("/api/rides/active")])
      .then(([stops, service, ride]) => {
        // One ride at a time: a student who already has one goes to it instead.
        if (ride) return router.replace("/student/ride");
        setStops(stops);
        setService(service);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [router]);

  if (loadError) return <Page><p role="alert" className="form-error">{loadError}</p></Page>;
  if (!stops || !service) return <Page><p role="status">Loading stops…</p></Page>;
  if (!service.open) {
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
      await api<Ride>("/api/rides", "POST", request);
      router.push("/student/ride");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (step === "confirm") {
    return (
      <Page>
        <p className="lead">Check your ride, then send the request.</p>
        <RideSummary pickup={stopName(request.pickupId)} dropoff={stopName(request.dropoffId)} partySize={request.partySize} />
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
