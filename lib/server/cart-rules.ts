import type { CartInput } from "../types";

// The rules for adding and editing carts, as pure functions.

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function parseFields(body: Record<string, unknown>): Parsed<Partial<CartInput>> {
  const { number, seats, active } = body;
  const cart: Partial<CartInput> = {};
  if (number !== undefined) {
    const text = typeof number === "string" ? number.trim() : "";
    if (!text || text.length > 10) return { ok: false, error: "Enter a cart number (up to 10 characters)." };
    cart.number = text;
  }
  if (seats !== undefined) {
    if (!Number.isInteger(seats) || (seats as number) < 2 || (seats as number) > 20) {
      return { ok: false, error: "Seats must be from 2 to 20, including the driver's." };
    }
    cart.seats = seats as number;
  }
  if (active !== undefined) {
    if (typeof active !== "boolean") return { ok: false, error: "Active must be true or false." };
    cart.active = active;
  }
  return { ok: true, value: cart };
}

/** A new cart: number and seats are required. */
export function parseNewCart(body: Record<string, unknown> | null): Parsed<CartInput> {
  const parsed = parseFields(body ?? {});
  if (!parsed.ok) return parsed;
  const { number, seats, active } = parsed.value;
  if (number === undefined) return { ok: false, error: "Enter a cart number (up to 10 characters)." };
  if (seats === undefined) return { ok: false, error: "Seats must be from 2 to 20, including the driver's." };
  return { ok: true, value: { number, seats, ...(active !== undefined && { active }) } };
}

/** An edit: any of the fields, at least one. */
export function parseCartEdit(body: Record<string, unknown> | null): Parsed<Partial<CartInput>> {
  const parsed = parseFields(body ?? {});
  if (parsed.ok && Object.keys(parsed.value).length === 0) return { ok: false, error: "Nothing to change." };
  return parsed;
}

/**
 * A cart on shift can't be edited. Fewer seats could strand a party already on board, and a new number would
 * contradict the "Look for Cart N" a student is reading. Returns why not, or null if the edit may go ahead.
 */
export function cartEditBlocked(cart: { number: string; inUseBy: string | null }) {
  return cart.inUseBy ? `Cart ${cart.number} is on shift with ${cart.inUseBy}. Edit it once the shift ends.` : null;
}
