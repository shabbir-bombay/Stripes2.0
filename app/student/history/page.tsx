"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "@/components/api";
import { Button, ButtonLink } from "@/components/Button";
import { Field } from "@/components/Field";
import { campusDateTime } from "@/components/time";
import type { FeedbackRequest, HistoryPage, Ride, RideStatus } from "@/lib/types";

const OUTCOME: Partial<Record<RideStatus, string>> = { completed: "Completed", canceled: "Canceled", no_show: "No-show" };

export default function HistoryPageView() {
  const [rides, setRides] = useState<Ride[]>();
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (cursor: string | null) => {
    setBusy(true);
    setError(undefined);
    try {
      const page = await api<HistoryPage>(`/api/rides/history${cursor ? `?cursor=${cursor}` : ""}`);
      setRides((current) => (cursor ? [...(current ?? []), ...page.rides] : page.rides));
      setNext(page.nextCursor);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load(null);
  }, [load]);

  function rated(ride: Ride) {
    setRides((current) => current?.map((other) => (other.id === ride.id ? ride : other)));
  }

  return (
    <main className="page stack">
      <h1>Your rides</h1>
      {!rides && !error && <p role="status">Loading your rides…</p>}
      {rides?.length === 0 && (
        <>
          <p className="muted">Your finished rides will show up here.</p>
          <ButtonLink href="/student" variant="secondary">Back to Ride</ButtonLink>
        </>
      )}
      {rides?.map((ride) => <HistoryCard key={ride.id} ride={ride} onRated={rated} />)}
      {error && <p role="alert" className="form-error">{error}</p>}
      {next && <Button variant="secondary" onClick={() => load(next)} disabled={busy}>{busy ? "Loading…" : "Show older rides"}</Button>}
    </main>
  );
}

function HistoryCard({ ride, onRated }: { ride: Ride; onRated: (ride: Ride) => void }) {
  return (
    <article className="card ride-card">
      <p className="ride-status">{OUTCOME[ride.status]} · {campusDateTime(ride.requestedAt)}</p>
      <dl className="summary">
        <dt>From</dt>
        <dd>{ride.pickup.name}</dd>
        <dt>To</dt>
        <dd>{ride.dropoff.name}</dd>
        <dt>Riders</dt>
        <dd>{ride.partySize}</dd>
        {ride.driver && (
          <>
            <dt>Driver</dt>
            <dd>{ride.driver.callSign}{ride.driver.cartNumber && `, Cart ${ride.driver.cartNumber}`}</dd>
          </>
        )}
        {ride.cancelReason && (
          <>
            <dt>Reason</dt>
            <dd>{ride.cancelReason}</dd>
          </>
        )}
      </dl>
      {ride.status === "completed" &&
        (ride.rating ? <p className="muted">You rated this ride {ride.rating} out of 5.</p> : <RatingForm ride={ride} onRated={onRated} />)}
    </article>
  );
}

function RatingForm({ ride, onRated }: { ride: Ride; onRated: (ride: Ride) => void }) {
  const [rating, setRating] = useState<FeedbackRequest["rating"]>();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      onRated(await api<Ride>(`/api/rides/${ride.id}/feedback`, "POST", { rating: rating!, comment } satisfies FeedbackRequest));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <fieldset className="segmented" disabled={busy}>
        <legend>How was this ride? (1 is poor, 5 is great)</legend>
        {([1, 2, 3, 4, 5] as const).map((value) => (
          <label key={value} className="segment">
            <input type="radio" name={`rating-${ride.id}`} checked={rating === value} onChange={() => setRating(value)} aria-label={`${value} out of 5`} />
            <span>{value}</span>
          </label>
        ))}
      </fieldset>
      <Field label="Comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} disabled={busy} />
      {error && <p role="alert" className="form-error">{error}</p>}
      <Button type="submit" disabled={busy || !rating}>{busy ? "Sending…" : "Send rating"}</Button>
    </form>
  );
}
