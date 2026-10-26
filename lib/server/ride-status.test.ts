import assert from "node:assert/strict";
import test from "node:test";
import type { RideStatus } from "../types.ts";
import { canMove, planMove, STUDENT_CANCEL_REASON, type Actor } from "./ride-status.ts";

const STATUSES: RideStatus[] = ["requested", "assigned", "en_route", "arrived", "in_progress", "completed", "canceled", "no_show"];
const ACTORS: Actor[] = ["student", "driver", "admin"];
const now = new Date("2026-10-21T19:00:00Z");

// The status table in API.md, copied out by hand: "from > to: who".
const ALLOWED = new Set([
  "requested > assigned: driver",
  "requested > assigned: admin",
  "assigned > en_route: driver",
  "assigned > arrived: driver",
  "en_route > arrived: driver",
  "arrived > in_progress: driver",
  "in_progress > completed: driver",
  "arrived > no_show: driver",
  ...["assigned", "en_route", "arrived"].map((from) => `${from} > requested: admin`),
  ...["requested", "assigned", "en_route", "arrived"].flatMap((from) => ACTORS.map((by) => `${from} > canceled: ${by}`)),
]);

// Enough for any allowed move to succeed.
const extras = { driverId: "driver-1", reason: "Cart broke down", now };

test("every move in the status table is allowed, and nothing else", () => {
  for (const from of STATUSES)
    for (const to of STATUSES)
      for (const by of ACTORS) {
        const key = `${from} > ${to}: ${by}`;
        assert.equal(canMove(from, to, by), ALLOWED.has(key), key);
        assert.equal(planMove(from, { to, by, ...extras }).ok, ALLOWED.has(key), key);
      }
});

test("a move the actor may never make is 403; a move from the wrong status is 409", () => {
  assert.deepEqual(planMove("requested", { to: "assigned", by: "student", ...extras }), {
    ok: false,
    status: 403,
    error: "You can't make this change to a ride.",
  });
  const unassign = planMove("arrived", { to: "requested", by: "driver" });
  assert.equal(!unassign.ok && unassign.status, 403);
  const late = planMove("in_progress", { to: "canceled", by: "student" });
  assert.equal(!late.ok && late.status, 409);
  assert.equal(!late.ok && late.error, "This ride is already under way.");
});

test("final statuses never change", () => {
  for (const from of ["completed", "canceled", "no_show"] as const)
    for (const to of STATUSES)
      for (const by of ACTORS) {
        const plan = planMove(from, { to, by, ...extras });
        assert.equal(plan.ok, false, `${from} > ${to}: ${by}`);
      }
  const plan = planMove("no_show", { to: "canceled", by: "admin", ...extras });
  assert.equal(!plan.ok && plan.error, "This ride is already marked as a no-show.");
});

test("assigning sets the driver and the time, and needs a driver", () => {
  assert.deepEqual(planMove("requested", { to: "assigned", by: "admin", driverId: "d1", now }), {
    ok: true,
    patch: { driverId: "d1", assignedAt: now },
  });
  const plan = planMove("requested", { to: "assigned", by: "driver", now });
  assert.equal(!plan.ok && plan.status, 400);
});

test("unassigning clears the driver and the times that came with it", () => {
  assert.deepEqual(planMove("arrived", { to: "requested", by: "admin", now }), {
    ok: true,
    patch: { driverId: null, assignedAt: null, arrivedAt: null },
  });
});

test("each step records its time", () => {
  assert.deepEqual(planMove("en_route", { to: "arrived", by: "driver", now }), { ok: true, patch: { arrivedAt: now } });
  assert.deepEqual(planMove("arrived", { to: "in_progress", by: "driver", now }), { ok: true, patch: { startedAt: now } });
  assert.deepEqual(planMove("in_progress", { to: "completed", by: "driver", now }), { ok: true, patch: { endedAt: now } });
  assert.deepEqual(planMove("arrived", { to: "no_show", by: "driver", now }), { ok: true, patch: { endedAt: now } });
  assert.deepEqual(planMove("assigned", { to: "en_route", by: "driver", now }), { ok: true, patch: {} });
});

test("a student may cancel without a reason; drivers and admins must give one", () => {
  assert.deepEqual(planMove("requested", { to: "canceled", by: "student", now }), {
    ok: true,
    patch: { endedAt: now, cancelReason: STUDENT_CANCEL_REASON },
  });
  for (const by of ["driver", "admin"] as const) {
    for (const reason of [undefined, "", "   "]) {
      const plan = planMove("assigned", { to: "canceled", by, reason, now });
      assert.equal(!plan.ok && plan.status, 400, `${by} ${JSON.stringify(reason)}`);
    }
  }
  assert.deepEqual(planMove("assigned", { to: "canceled", by: "admin", reason: "  Weather  ", now }), {
    ok: true,
    patch: { endedAt: now, cancelReason: "Weather" },
  });
});

test("a cancel reason is at most 200 characters", () => {
  assert.equal(planMove("requested", { to: "canceled", by: "admin", reason: "x".repeat(200), now }).ok, true);
  const plan = planMove("requested", { to: "canceled", by: "admin", reason: "x".repeat(201), now });
  assert.equal(!plan.ok && plan.status, 400);
});
