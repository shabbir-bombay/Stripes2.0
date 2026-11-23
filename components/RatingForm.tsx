"use client";

import { useState, type FormEvent } from "react";
import { api } from "./api";
import { Button } from "./Button";
import { Field } from "./Field";
import { Icon } from "./Icon";
import type { FeedbackRequest, Ride } from "@/lib/types";

/** Five stars and an optional comment, for a completed ride. `onSkip` adds a Skip button beside Send. */
export function RatingForm({ ride, onRated, onSkip, legend }: { ride: Ride; onRated: (ride: Ride) => void; onSkip?: () => void; legend: string }) {
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

  const send = <Button type="submit" disabled={busy || !rating}>{busy ? "Sending…" : "Send rating"}</Button>;
  return (
    <form className="stack" onSubmit={submit}>
      <fieldset className="stars" disabled={busy}>
        <legend className="sr-only">{legend}</legend>
        {([1, 2, 3, 4, 5] as const).map((value) => (
          <label key={value} className={rating && value <= rating ? "star on" : "star"}>
            <input type="radio" name={`rating-${ride.id}`} checked={rating === value} onChange={() => setRating(value)} aria-label={`${value} out of 5`} />
            <span>
              <Icon name={rating && value <= rating ? "starFilled" : "star"} />
            </span>
          </label>
        ))}
      </fieldset>
      <Field label="Comment (optional)" placeholder="Add a comment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} disabled={busy} />
      {error && <p role="alert" className="form-error">{error}</p>}
      {onSkip ? (
        <div className="row-buttons">
          <Button type="button" variant="tonal" onClick={onSkip} disabled={busy}>Skip</Button>
          {send}
        </div>
      ) : (
        send
      )}
    </form>
  );
}
