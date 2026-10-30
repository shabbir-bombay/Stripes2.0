import type { Cart, Shift } from "../types";
import { db } from "./db";
import type { Prisma } from "./generated/prisma/client";

/** Everything `toCart` needs. */
export const cartInclude = { driver: { select: { callSign: true } } } satisfies Prisma.CartInclude;

type CartRow = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

export function toCart(cart: CartRow): Cart {
  return { id: cart.id, number: cart.number, seats: cart.seats, active: cart.active, inUseBy: cart.driver?.callSign ?? null };
}

/** Every cart, by number (so "10" comes after "9"). */
export async function allCarts() {
  const carts = await db.cart.findMany({ include: cartInclude });
  return carts.sort((a, b) => a.number.localeCompare(b.number, "en", { numeric: true })).map(toCart);
}

/** The driver's current shift, or null when off shift. */
export async function currentShift(userId: string): Promise<Shift | null> {
  const profile = await db.driverProfile.findUnique({
    where: { userId },
    include: { cart: { include: cartInclude } },
  });
  if (!profile?.cart || !profile.shiftStart) return null;
  return { cart: toCart(profile.cart), startedAt: profile.shiftStart.toISOString() };
}
