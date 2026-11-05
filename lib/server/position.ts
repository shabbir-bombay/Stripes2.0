import type { EtaRange, Position, RideStatus } from "../types";

// Driver positions and the ETA, as pure functions. The routes in app/api read and write the database.

/** Past this, a position is no longer live: reports this old are refused and the ETA stops. */
export const POSITION_STALE_SECONDS = 30;
/** Phone clocks run a little ahead of the server, so a fix may be this far in the future. */
export const POSITION_FUTURE_SECONDS = 10;

export const CART_SPEED_MPS = 2.2;
/** Added to the travel time, for loading riders and the stops along the way. */
export const ETA_BUFFER_SECONDS = 90;
/** The ETA is shown as this much either side of the estimate. */
export const ETA_RANGE_SECONDS = 120;

const EARTH_RADIUS_METERS = 6_371_000;

/** The ride has a driver who hasn't picked the student up yet, so the student may see where the cart is. */
export const TRACKABLE: RideStatus[] = ["assigned", "en_route", "arrived"];

const isNumberIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

export type ParsedReport = { ok: true; lat: number; lng: number; at: Date } | { ok: false; error: string };

/** Checks a `PositionReport` body. A fix a little in the future is kept, with its time moved back to `now`. */
export function parsePositionReport(body: Record<string, unknown> | null, now = new Date()): ParsedReport {
  const { lat, lng, accuracy, at } = body ?? {};
  if (!isNumberIn(lat, -90, 90) || !isNumberIn(lng, -180, 180)) return { ok: false, error: "Send a valid lat and lng." };
  if (!isNumberIn(accuracy, 0, Number.MAX_VALUE)) return { ok: false, error: "Send a valid accuracy." };

  const taken = typeof at === "string" ? Date.parse(at) : NaN;
  if (Number.isNaN(taken)) return { ok: false, error: "Send the time of the fix." };
  const age = (now.getTime() - taken) / 1000;
  if (age > POSITION_STALE_SECONDS) return { ok: false, error: "This location is too old." };
  if (age < -POSITION_FUTURE_SECONDS) return { ok: false, error: "This location is dated in the future. Check the phone's clock." };

  return { ok: true, lat, lng, at: new Date(Math.min(taken, now.getTime())) };
}

/** A driver's saved position, or null if they have none. */
export function storedPosition(driver: { lat: number | null; lng: number | null; positionAt: Date | null }): Position | null {
  if (driver.lat === null || driver.lng === null || !driver.positionAt) return null;
  return { lat: driver.lat, lng: driver.lng, at: driver.positionAt.toISOString() };
}

export function isFresh(position: Position, now = new Date()) {
  return now.getTime() - Date.parse(position.at) <= POSITION_STALE_SECONDS * 1000;
}

/** Straight-line distance over the earth's surface (haversine). */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

/** Distance ÷ speed + a buffer, as a range in whole minutes. The range never starts below 1 minute. */
export function etaRange(meters: number): EtaRange {
  const estimate = meters / CART_SPEED_MPS + ETA_BUFFER_SECONDS;
  return {
    minMinutes: Math.max(1, Math.round((estimate - ETA_RANGE_SECONDS) / 60)),
    maxMinutes: Math.round((estimate + ETA_RANGE_SECONDS) / 60),
  };
}

/** The time until pickup. Null unless a driver is still heading there and their position is fresh. */
export function etaToPickup(
  status: RideStatus,
  driverPosition: Position | null,
  pickup: { lat: number; lng: number },
  now = new Date(),
): EtaRange | null {
  if (status !== "assigned" && status !== "en_route") return null;
  if (!driverPosition || !isFresh(driverPosition, now)) return null;
  return etaRange(distanceMeters(driverPosition, pickup));
}
