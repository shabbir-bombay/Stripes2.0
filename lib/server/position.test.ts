import assert from "node:assert/strict";
import test from "node:test";
import type { RideStatus } from "../types.ts";
import { distanceMeters, etaRange, etaToPickup, isFresh, parsePositionReport, storedPosition } from "./position.ts";

const now = new Date("2026-11-04T19:00:00Z");
const secondsAgo = (seconds: number) => new Date(now.getTime() - seconds * 1000).toISOString();
const report = (changes: object = {}) => ({ lat: 37.98, lng: -121.31, accuracy: 12, at: secondsAgo(2), ...changes });

test("a good report is accepted with the time of the fix", () => {
  assert.deepEqual(parsePositionReport(report(), now), { ok: true, lat: 37.98, lng: -121.31, at: new Date(secondsAgo(2)) });
});

test("a missing body or bad coordinates are refused", () => {
  assert.equal(parsePositionReport(null, now).ok, false);
  for (const changes of [{ lat: 91 }, { lat: -91 }, { lng: 181 }, { lng: -181 }, { lat: "37.98" }, { lng: null }, { lat: NaN }, { lng: Infinity }]) {
    assert.equal(parsePositionReport(report(changes), now).ok, false, JSON.stringify(changes));
  }
});

test("the edges of the map are valid coordinates", () => {
  for (const changes of [{ lat: 90 }, { lat: -90 }, { lng: 180 }, { lng: -180 }, { lat: 0, lng: 0 }]) {
    assert.equal(parsePositionReport(report(changes), now).ok, true, JSON.stringify(changes));
  }
});

test("a bad accuracy is refused", () => {
  for (const accuracy of [-1, "12", null, undefined, NaN]) {
    assert.equal(parsePositionReport(report({ accuracy }), now).ok, false, String(accuracy));
  }
  assert.equal(parsePositionReport(report({ accuracy: 0 }), now).ok, true);
});

test("a missing or unreadable time is refused", () => {
  for (const at of [undefined, null, 1730000000, "soon", ""]) {
    assert.equal(parsePositionReport(report({ at }), now).ok, false, String(at));
  }
});

test("a stale fix is refused once it is past 30 seconds", () => {
  assert.equal(parsePositionReport(report({ at: secondsAgo(30) }), now).ok, true);
  const stale = parsePositionReport(report({ at: secondsAgo(31) }), now);
  assert.deepEqual(stale, { ok: false, error: "This location is too old." });
});

test("a fix more than 10 seconds in the future is refused", () => {
  assert.equal(parsePositionReport(report({ at: secondsAgo(-10) }), now).ok, true);
  const future = parsePositionReport(report({ at: secondsAgo(-11) }), now);
  assert.equal(future.ok, false);
});

test("a fix slightly in the future is saved as now, so it can't stay fresh for longer", () => {
  const parsed = parsePositionReport(report({ at: secondsAgo(-5) }), now);
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.at, now);
});

test("a stored position needs all three columns", () => {
  const positionAt = new Date(secondsAgo(1));
  assert.deepEqual(storedPosition({ lat: 1, lng: 2, positionAt }), { lat: 1, lng: 2, at: positionAt.toISOString() });
  assert.equal(storedPosition({ lat: null, lng: 2, positionAt }), null);
  assert.equal(storedPosition({ lat: 1, lng: null, positionAt }), null);
  assert.equal(storedPosition({ lat: 1, lng: 2, positionAt: null }), null);
  assert.deepEqual(storedPosition({ lat: 0, lng: 0, positionAt }), { lat: 0, lng: 0, at: positionAt.toISOString() });
});

test("a position is fresh up to 30 seconds old", () => {
  assert.equal(isFresh({ lat: 0, lng: 0, at: secondsAgo(30) }, now), true);
  assert.equal(isFresh({ lat: 0, lng: 0, at: secondsAgo(31) }, now), false);
});

test("distance is the straight line over the earth", () => {
  assert.equal(distanceMeters({ lat: 37.98, lng: -121.31 }, { lat: 37.98, lng: -121.31 }), 0);
  // One degree of latitude is about 111.2 km.
  assert.ok(Math.abs(distanceMeters({ lat: 37, lng: -121 }, { lat: 38, lng: -121 }) - 111_195) < 10);
  // A degree of longitude shrinks with latitude: about 87.6 km at 38° north.
  assert.ok(Math.abs(distanceMeters({ lat: 38, lng: -121 }, { lat: 38, lng: -120 }) - 87_620) < 50);
  const a = { lat: 37.9799, lng: -121.3121 };
  const b = { lat: 37.9846, lng: -121.3118 };
  assert.equal(distanceMeters(a, b), distanceMeters(b, a));
});

test("the ETA is distance ÷ 2.2 m/s + 90 s, 2 minutes either side", () => {
  // 1100 m is 500 s, plus 90 = 590 s: 470 s to 710 s.
  assert.deepEqual(etaRange(1100), { minMinutes: 8, maxMinutes: 12 });
});

test("the ETA range never starts below a minute, even at the pickup", () => {
  assert.deepEqual(etaRange(0), { minMinutes: 1, maxMinutes: 4 });
});

test("the ETA range always has a width and grows with distance", () => {
  let previous = etaRange(0);
  for (let meters = 100; meters <= 3000; meters += 100) {
    const range = etaRange(meters);
    assert.ok(range.maxMinutes > range.minMinutes, `${meters} m`);
    assert.ok(range.minMinutes >= previous.minMinutes && range.maxMinutes >= previous.maxMinutes, `${meters} m`);
    previous = range;
  }
});

test("there is an ETA only while a driver is heading to the pickup with a fresh position", () => {
  const pickup = { lat: 37.98, lng: -121.31 };
  const fresh = { lat: 37.981, lng: -121.31, at: secondsAgo(5) };
  const expected = etaRange(distanceMeters(fresh, pickup));
  const statuses: RideStatus[] = ["requested", "assigned", "en_route", "arrived", "in_progress", "completed", "canceled", "no_show"];
  for (const status of statuses) {
    const heading = status === "assigned" || status === "en_route";
    assert.deepEqual(etaToPickup(status, fresh, pickup, now), heading ? expected : null, status);
  }
  assert.equal(etaToPickup("en_route", null, pickup, now), null);
  assert.equal(etaToPickup("en_route", { ...fresh, at: secondsAgo(31) }, pickup, now), null);
});
