"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/components/api";
import { Button } from "@/components/Button";
import { Field, SelectField } from "@/components/Field";
import { usePolling } from "@/components/usePolling";
import type { Role, UpdateUserRequest, User } from "@/lib/types";

const ROLE_LABEL: Record<Role, string> = { student: "Student", driver: "Driver", admin: "Admin" };
const LIMIT = 100;

export default function UsersPage() {
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const url = `/api/admin/users?role=${role}&q=${encodeURIComponent(q)}`;
  const { data: users, error, refresh } = usePolling<User[]>(url, 15_000);

  function find(event: FormEvent) {
    event.preventDefault();
    setQ(search.trim());
  }

  return (
    <main className="page stack">
      <h1>Users</h1>
      <form className="card stack" onSubmit={find} role="search">
        <Field label="Search" hint="Name, email or call sign" value={search} onChange={(e) => setSearch(e.target.value)} />
        <SelectField label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Everyone</option>
          {Object.entries(ROLE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}s</option>
          ))}
        </SelectField>
        <Button type="submit">Search</Button>
      </form>
      {error && <p role="alert" className="form-error">{error}</p>}
      {!users && !error && <p role="status">Loading users…</p>}
      {users?.length === 0 && <p className="muted">Nobody matches.</p>}
      {users?.length === LIMIT && <p className="field-hint">Showing the first {LIMIT}. Search to narrow it down.</p>}
      {users?.map((user) => <UserCard key={user.id} user={user} reload={refresh} />)}
    </main>
  );
}

function UserCard({ user, reload }: { user: User; reload: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function save(update: UpdateUserRequest) {
    setBusy(true);
    setError(undefined);
    try {
      await api(`/api/admin/users/${user.id}`, "PATCH", update);
      await reload();
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="card stack">
      <div>
        <p className="banner-title">
          {user.name} {user.suspended && <span className="tag danger">Suspended</span>}
        </p>
        <p className="muted">{user.email}</p>
      </div>
      <dl className="summary">
        <dt>Role</dt>
        <dd>{ROLE_LABEL[user.role]}</dd>
        {user.callSign && (
          <>
            <dt>Call sign</dt>
            <dd>{user.callSign}</dd>
          </>
        )}
        {user.role === "student" && (
          <>
            <dt>Penalty points</dt>
            <dd>{user.penaltyPoints}</dd>
          </>
        )}
      </dl>
      {editing && <UserEditor user={user} busy={busy} save={save} cancel={() => setEditing(false)} />}
      {error && <p role="alert" className="form-error">{error}</p>}
      {!editing && (
        <div className="ride-actions">
          <Button variant="secondary" onClick={() => { setError(undefined); setEditing(true); }} disabled={busy}>Edit</Button>
          <Button variant="secondary" onClick={() => save({ suspended: !user.suspended })} disabled={busy}>
            {user.suspended ? "Reinstate" : "Suspend"}
          </Button>
        </div>
      )}
    </article>
  );
}

function UserEditor({ user, busy, save, cancel }: { user: User; busy: boolean; save: (update: UpdateUserRequest) => void; cancel: () => void }) {
  const [role, setRole] = useState(user.role);
  const [callSign, setCallSign] = useState(user.callSign ?? "");

  function submit(event: FormEvent) {
    event.preventDefault();
    const update: UpdateUserRequest = {};
    if (role !== user.role) update.role = role;
    // Left empty, a returning driver keeps their old call sign; the server asks for one if they never had one.
    if (role === "driver" && callSign.trim() && callSign.trim() !== user.callSign) update.callSign = callSign;
    if (Object.keys(update).length === 0) cancel();
    else save(update);
  }

  return (
    <form className="stack" onSubmit={submit}>
      <SelectField label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
        {Object.entries(ROLE_LABEL).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </SelectField>
      {role === "driver" && (
        <Field label="Call sign" hint="The only name students see, e.g. Tiger 3" value={callSign} onChange={(e) => setCallSign(e.target.value)} maxLength={30} />
      )}
      <div className="ride-actions">
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        <Button type="button" variant="secondary" onClick={cancel} disabled={busy}>Back</Button>
      </div>
    </form>
  );
}
