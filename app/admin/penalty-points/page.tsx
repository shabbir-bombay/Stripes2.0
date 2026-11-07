"use client";

import { useState } from "react";
import { api } from "@/components/api";
import { Button } from "@/components/Button";
import { campusDateTime } from "@/components/time";
import { usePolling } from "@/components/usePolling";
import type { PenaltyPoint, PenaltyPointStatus } from "@/lib/types";

const TABS: { status: PenaltyPointStatus; label: string; empty: string }[] = [
  { status: "pending", label: "Waiting", empty: "No requests waiting for you." },
  { status: "approved", label: "Approved", empty: "No approved points." },
  { status: "rejected", label: "Rejected", empty: "No rejected requests." },
];

export default function PenaltyPointsPage() {
  const [status, setStatus] = useState<PenaltyPointStatus>("pending");
  const { data: points, error, refresh } = usePolling<PenaltyPoint[]>(`/api/admin/penalty-points?status=${status}`, 10_000);
  // The last response can still be from the tab just left, so only show what matches this one.
  const shown = points?.filter((point) => point.status === status);
  const tab = TABS.find((option) => option.status === status)!;

  return (
    <main className="page stack">
      <h1>Penalty points</h1>
      <p className="muted">A driver's request doesn't count until you approve it. Students only see approved points.</p>
      <fieldset className="segmented">
        <legend>Show</legend>
        {TABS.map((option) => (
          <label key={option.status} className="segment">
            <input type="radio" name="penalty-status" checked={status === option.status} onChange={() => setStatus(option.status)} />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
      {error && <p role="alert" className="form-error">{error}</p>}
      {!points && !error && <p role="status">Loading…</p>}
      {shown?.length === 0 && <p className="muted">{tab.empty}</p>}
      {shown?.map((point) => <PointCard key={point.id} point={point} reload={refresh} />)}
    </main>
  );
}

function PointCard({ point, reload }: { point: PenaltyPoint; reload: () => Promise<void> }) {
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function decide(action: "approve" | "reject") {
    setBusy(true);
    setError(undefined);
    try {
      await api(`/api/admin/penalty-points/${point.id}/${action}`, "POST");
    } catch (e) {
      setError((e as Error).message);
    }
    await reload();
    setBusy(false);
  }

  return (
    <article className="card stack">
      <p className="banner-title">{point.student.name}</p>
      <p className="note-text">{point.reason}</p>
      <p className="field-hint">From {point.requestedBy} · {campusDateTime(point.createdAt)}</p>
      {error && <p role="alert" className="form-error">{error}</p>}
      {point.status === "pending" && (
        <div className="ride-actions">
          <Button onClick={() => decide("approve")} disabled={busy}>Approve</Button>
          <Button variant="secondary" onClick={() => decide("reject")} disabled={busy}>Reject</Button>
        </div>
      )}
    </article>
  );
}
