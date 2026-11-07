"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/components/api";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { usePolling } from "@/components/usePolling";
import type { Cart, CartInput } from "@/lib/types";

const SEATS_HINT = "Including the driver's seat, 2 to 20";

export default function CartsPage() {
  const { data: carts, error, refresh } = usePolling<Cart[]>("/api/carts", 15_000);

  return (
    <main className="page stack">
      <h1>Carts</h1>
      <AddCart reload={refresh} />
      {error && <p role="alert" className="form-error">{error}</p>}
      {!carts && !error && <p role="status">Loading carts…</p>}
      {carts?.length === 0 && <p className="muted">No carts yet. Add one above.</p>}
      {carts?.map((cart) => <CartCard key={cart.id} cart={cart} reload={refresh} />)}
    </main>
  );
}

function AddCart({ reload }: { reload: () => Promise<void> }) {
  const [number, setNumber] = useState("");
  const [seats, setSeats] = useState("4");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function add(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await api<Cart>("/api/admin/carts", "POST", { number, seats: Number(seats) } satisfies CartInput);
      setNumber("");
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card stack" onSubmit={add}>
      <h2>Add a cart</h2>
      <Field label="Cart number" value={number} onChange={(e) => setNumber(e.target.value)} maxLength={10} required />
      <Field label="Seats" hint={SEATS_HINT} type="number" inputMode="numeric" min={2} max={20} value={seats} onChange={(e) => setSeats(e.target.value)} required />
      {error && <p role="alert" className="form-error">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? "Adding…" : "Add cart"}</Button>
    </form>
  );
}

function CartCard({ cart, reload }: { cart: Cart; reload: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [number, setNumber] = useState(cart.number);
  const [seats, setSeats] = useState(String(cart.seats));
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function save(update: Partial<CartInput>) {
    setBusy(true);
    setError(undefined);
    try {
      await api<Cart>(`/api/admin/carts/${cart.id}`, "PATCH", update);
      await reload();
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  function startEditing() {
    setNumber(cart.number);
    setSeats(String(cart.seats));
    setError(undefined);
    setEditing(true);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    save({ number, seats: Number(seats) });
  }

  return (
    <article className="card stack">
      <p className="banner-title">
        Cart {cart.number} {!cart.active && <span className="tag danger">Out of service</span>}
      </p>
      <p className="muted">
        {cart.seats} seats{cart.inUseBy ? ` · on shift with ${cart.inUseBy}` : ""}
      </p>
      {error && <p role="alert" className="form-error">{error}</p>}
      {cart.inUseBy ? (
        <p className="field-hint">You can edit this cart once the shift ends.</p>
      ) : editing ? (
        <form className="stack" onSubmit={submit}>
          <Field label="Cart number" value={number} onChange={(e) => setNumber(e.target.value)} maxLength={10} required />
          <Field label="Seats" hint={SEATS_HINT} type="number" inputMode="numeric" min={2} max={20} value={seats} onChange={(e) => setSeats(e.target.value)} required />
          <div className="ride-actions">
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(false)} disabled={busy}>Back</Button>
          </div>
        </form>
      ) : (
        <div className="ride-actions">
          <Button variant="secondary" onClick={startEditing} disabled={busy}>Edit</Button>
          <Button variant="secondary" onClick={() => save({ active: !cart.active })} disabled={busy}>
            {cart.active ? "Take out of service" : "Put back in service"}
          </Button>
        </div>
      )}
    </article>
  );
}
