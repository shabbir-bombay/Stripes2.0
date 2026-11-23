"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/components/api";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { SignOutButton } from "@/components/SignOutButton";
import { campusDateTime } from "@/components/time";
import { usePolling } from "@/components/usePolling";
import type { Me, PenaltyPoint, UpdateMeRequest } from "@/lib/types";

export default function ProfilePage() {
  const { data: points, error } = usePolling<PenaltyPoint[]>("/api/me/penalty-points", 15_000);
  const [me, setMe] = useState<Me>();
  const [loadError, setLoadError] = useState<string>();

  useEffect(() => {
    api<Me>("/api/me").then(setMe).catch((e: Error) => setLoadError(e.message));
  }, []);

  return (
    <main className="page stack">
      <h1 className="page-title">Profile</h1>
      <NameForm me={me} onSaved={setMe} loadError={loadError} />

      <h2 className="group-label">Account</h2>
      <dl className="key-values">
        <div className="key-value">
          <dt>Email</dt>
          <dd className="muted">{me?.email ?? "…"}</dd>
        </div>
        <div className="key-value">
          <dt>Penalty points</dt>
          <dd className="strong num">{points ? points.length : "…"}</dd>
        </div>
      </dl>
      <p className="field-hint">Drivers can ask for a point after a no-show or a problem on a ride. An admin decides.</p>
      {error && <p role="alert" className="form-error">{error}</p>}
      {points && points.length > 0 && (
        <>
          <ul className="list" aria-label="Your penalty points">
            {points.map((point) => (
              <li key={point.id} className="list-item">
                <div>
                  <p className="list-item-title">{point.reason}</p>
                  <p className="list-item-meta">{campusDateTime(point.createdAt)} · from {point.requestedBy}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="field-hint">If a point looks wrong, talk to a Stripes admin.</p>
        </>
      )}

      <SignOutButton variant="tonal" className="destructive sign-out" />
    </main>
  );
}

function NameForm({ me, onSaved, loadError }: { me?: Me; onSaved: (me: Me) => void; loadError?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (me) setName(me.name);
  }, [me]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    setSaved(false);
    try {
      const updated = await api<Me>("/api/me", "PATCH", { name } satisfies UpdateMeRequest);
      onSaved(updated);
      setName(updated.name);
      setSaved(true);
      // Other pages read the name from the layout, which comes from the server.
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={save}>
      <Field
        label="Your name"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setSaved(false);
        }}
        maxLength={80}
        autoComplete="name"
        error={error ?? loadError}
        hint={saved ? "Saved." : undefined}
        disabled={!me}
        required
      />
      <Button type="submit" variant="tonal" disabled={busy || !me}>{busy ? "Saving…" : "Save name"}</Button>
    </form>
  );
}
