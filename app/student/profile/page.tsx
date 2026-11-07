"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/components/api";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { campusDateTime } from "@/components/time";
import { usePolling } from "@/components/usePolling";
import type { Me, PenaltyPoint, UpdateMeRequest } from "@/lib/types";

export default function ProfilePage() {
  const { data: points, error } = usePolling<PenaltyPoint[]>("/api/me/penalty-points", 15_000);

  return (
    <main className="page stack">
      <h1>Profile</h1>
      <NameForm />
      <section className="stack" aria-labelledby="points-heading">
        <h2 id="points-heading">Penalty points{points ? `: ${points.length}` : ""}</h2>
        {error && <p role="alert" className="form-error">{error}</p>}
        {!points && !error && <p role="status">Loading your points…</p>}
        {points?.length === 0 && <p className="muted">You don't have any penalty points.</p>}
        {points?.map((point) => (
          <article key={point.id} className="card stack">
            <p className="note-text">{point.reason}</p>
            <p className="field-hint">{campusDateTime(point.createdAt)} · from {point.requestedBy}</p>
          </article>
        ))}
        {points && points.length > 0 && <p className="field-hint">If a point looks wrong, talk to a Stripes admin.</p>}
      </section>
    </main>
  );
}

function NameForm() {
  const router = useRouter();
  const [me, setMe] = useState<Me>();
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Me>("/api/me")
      .then((loaded) => {
        setMe(loaded);
        setName(loaded.name);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    setSaved(false);
    try {
      const updated = await api<Me>("/api/me", "PATCH", { name } satisfies UpdateMeRequest);
      setMe(updated);
      setName(updated.name);
      setSaved(true);
      // The header's name comes from the server.
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card stack" onSubmit={save}>
      {me && <p className="muted">{me.email}</p>}
      <Field
        label="Your name"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setSaved(false);
        }}
        maxLength={80}
        autoComplete="name"
        error={error}
        hint={saved ? "Saved." : undefined}
        disabled={!me}
        required
      />
      <Button type="submit" disabled={busy || !me}>{busy ? "Saving…" : "Save"}</Button>
    </form>
  );
}
