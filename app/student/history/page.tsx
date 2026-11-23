"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/components/api";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { RatingForm } from "@/components/RatingForm";
import { campusDateTime } from "@/components/time";
import { STUDENT_CANCEL_REASON } from "@/lib/server/ride-status";
import type { HistoryPage, Ride } from "@/lib/types";

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
      <h1 className="page-title">History</h1>
      {!rides && !error && <p role="status">Loading your rides…</p>}
      {rides?.length === 0 && (
        <div className="empty-state">
          <Icon name="history" />
          <h2>No rides yet</h2>
          <p className="sub">Your finished rides will show up here.</p>
        </div>
      )}
      {rides && rides.length > 0 && (
        <ul className="list">
          {rides.map((ride) => <HistoryRow key={ride.id} ride={ride} onRated={rated} />)}
        </ul>
      )}
      {error && <p role="alert" className="form-error">{error}</p>}
      {next && <Button variant="quiet" onClick={() => load(next)} disabled={busy}>{busy ? "Loading…" : "Show older rides"}</Button>}
    </main>
  );
}

/** One short row: where to (what people remember), where from, when and which cart, and a pill for the outcome. */
function HistoryRow({ ride, onRated }: { ride: Ride; onRated: (ride: Ride) => void }) {
  const [rating, setRating] = useState(false);
  const cart = ride.driver?.cartNumber ? ` · Cart ${ride.driver.cartNumber}` : "";

  return (
    <li>
      <div className="list-item">
        <div>
          <p className="list-item-title">{ride.dropoff.name}</p>
          <p className="list-item-meta">From {ride.pickup.name}</p>
          <p className="list-item-meta num">{campusDateTime(ride.requestedAt)}{cart}</p>
          {ride.status === "canceled" && ride.cancelReason && ride.cancelReason !== STUDENT_CANCEL_REASON && (
            <p className="list-item-meta">Canceled: {ride.cancelReason}</p>
          )}
        </div>
        <Outcome ride={ride} rating={rating} onRate={() => setRating(!rating)} />
      </div>
      {rating && ride.status === "completed" && !ride.rating && (
        <div className="row-form">
          <RatingForm ride={ride} legend={`Rate your ride to ${ride.dropoff.name}, 1 is poor and 5 is great`} onRated={onRated} />
        </div>
      )}
    </li>
  );
}

function Outcome({ ride, rating, onRate }: { ride: Ride; rating: boolean; onRate: () => void }) {
  if (ride.status === "completed") {
    if (ride.rating) {
      return (
        <span className="pill">
          <Icon name="starFilled" small />
          <span className="sr-only">You rated it </span>
          {ride.rating}
          <span className="sr-only"> out of 5</span>
        </span>
      );
    }
    return (
      <button type="button" className="pill accent" aria-expanded={rating} onClick={onRate}>
        <Icon name="star" small />
        Rate
      </button>
    );
  }
  if (ride.status === "no_show") return <span className="pill">No-show</span>;
  return <span className="pill">{ride.cancelReason === STUDENT_CANCEL_REASON ? "You canceled" : "Canceled"}</span>;
}
