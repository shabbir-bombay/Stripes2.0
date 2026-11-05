import type { BoardDriver, Cart, Shift } from "../types";
import { db } from "./db";
import type { Prisma } from "./generated/prisma/client";
import { storedPosition } from "./position";
import { HELD } from "./ride-status";
import { queueOrder, rideInclude, toStaffRide } from "./rides";

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

/** Every driver on shift, by cart number, with the rides they hold (oldest first). */
export async function boardDrivers(): Promise<BoardDriver[]> {
  const profiles = await db.driverProfile.findMany({
    where: { cartId: { not: null } },
    include: {
      user: { select: { name: true } },
      cart: { include: cartInclude },
      rides: { where: { status: { in: HELD } }, include: rideInclude, orderBy: queueOrder },
    },
  });
  return profiles
    .filter((profile) => profile.cart)
    .sort((a, b) => a.cart!.number.localeCompare(b.cart!.number, "en", { numeric: true }))
    .map((profile) => ({
      id: profile.userId,
      name: profile.user.name,
      callSign: profile.callSign,
      cart: toCart(profile.cart!),
      position: storedPosition(profile),
      rides: profile.rides.map((row) => toStaffRide(row)),
    }));
}
