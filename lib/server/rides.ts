import type { Ride as RideJson, StaffRide } from "../types";
import { db } from "./db";
import { Prisma } from "./generated/prisma/client";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids come from the URL or the body; Postgres errors on anything that isn't a UUID. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

const stop = { select: { id: true, name: true, lat: true, lng: true } } as const;

/** Everything `toRide` and `toStaffRide` need. */
export const rideInclude = {
  pickup: stop,
  dropoff: stop,
  student: { select: { id: true, name: true } },
  driver: { select: { callSign: true, cart: { select: { number: true } } } },
} satisfies Prisma.RideInclude;

export type RideRow = Prisma.RideGetPayload<{ include: typeof rideInclude }>;

/** First come, first served; the id breaks ties so two rides never share a place. */
export const queueOrder = [{ requestedAt: "asc" }, { id: "asc" }] satisfies Prisma.RideOrderByWithRelationInput[];

const iso = (date: Date | null) => date?.toISOString() ?? null;

export function toRide(row: RideRow, queuePosition: number | null = null): RideJson {
  return {
    id: row.id,
    status: row.status,
    pickup: row.pickup,
    dropoff: row.dropoff,
    partySize: row.partySize,
    requestedAt: row.requestedAt.toISOString(),
    assignedAt: iso(row.assignedAt),
    arrivedAt: iso(row.arrivedAt),
    startedAt: iso(row.startedAt),
    endedAt: iso(row.endedAt),
    cancelReason: row.cancelReason,
    // The cart is the one the driver is on shift with. Drivers can't end a shift while holding a ride.
    driver: row.driver && { callSign: row.driver.callSign, cartNumber: row.driver.cart?.number ?? "" },
    queuePosition: row.status === "requested" ? queuePosition : null,
    // ETA comes with driver positions in week 4, and the rating with feedback in week 5.
    eta: null,
    rating: null,
  };
}

export function toStaffRide(row: RideRow, queuePosition: number | null = null): StaffRide {
  return { ...toRide(row, queuePosition), student: row.student };
}

/** 1 = next in line, for a requested ride; otherwise null. */
export async function queuePosition(row: RideRow) {
  if (row.status !== "requested") return null;
  const ahead = await db.ride.count({
    where: {
      status: "requested",
      OR: [{ requestedAt: { lt: row.requestedAt } }, { requestedAt: row.requestedAt, id: { lt: row.id } }],
    },
  });
  return ahead + 1;
}

/** A ride as its student sees it. */
export async function studentRide(id: string) {
  const row = await db.ride.findUniqueOrThrow({ where: { id }, include: rideInclude });
  return toRide(row, await queuePosition(row));
}

/** A ride as drivers and admins see it. */
export async function staffRide(id: string) {
  const row = await db.ride.findUniqueOrThrow({ where: { id }, include: rideInclude });
  return toStaffRide(row, await queuePosition(row));
}

/** Every requested ride, oldest first, with its place in line. */
export async function waitingRides() {
  const rows = await db.ride.findMany({ where: { status: "requested" }, include: rideInclude, orderBy: queueOrder });
  return rows.map((row, i) => toStaffRide(row, i + 1));
}

/** Whether the error is a unique-index violation, e.g. a second active ride for one student. */
export function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
