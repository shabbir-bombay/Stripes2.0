import assert from "node:assert/strict";
import test from "node:test";
import { parseReason, PENALTY_DECISIONS, toPenaltyPoint } from "./penalty.ts";

const row = {
  id: "p1",
  studentId: "s1",
  rideId: "r1",
  reason: "Late to pickup",
  status: "approved" as const,
  requestedById: "d1",
  decidedById: "a1",
  decidedAt: new Date("2026-11-13T20:00:00Z"),
  createdAt: new Date("2026-11-13T19:00:00Z"),
  student: { id: "s1", name: "Sam Student" },
  requestedBy: { name: "Dana Driver", role: "driver" as const, driver: { callSign: "Tiger 1" } },
};

test("a reason is required, trimmed and limited to 200 characters", () => {
  assert.deepEqual(parseReason("  Late  "), { ok: true, reason: "Late" });
  assert.equal(parseReason("x".repeat(200)).ok, true);
  for (const bad of ["", "   ", "x".repeat(201), 5, null, undefined]) assert.equal(parseReason(bad).ok, false, String(bad));
});

test("staff see who asked by name", () => {
  assert.deepEqual(toPenaltyPoint(row, "staff"), {
    id: "p1",
    student: { id: "s1", name: "Sam Student" },
    rideId: "r1",
    reason: "Late to pickup",
    status: "approved",
    requestedBy: "Dana Driver",
    createdAt: "2026-11-13T19:00:00.000Z",
  });
});

test("a student sees a call sign, never a staff name", () => {
  assert.equal(toPenaltyPoint(row, "student").requestedBy, "Tiger 1");
  const byAdmin = { ...row, requestedBy: { name: "Alex Admin", role: "admin" as const, driver: null } };
  assert.equal(toPenaltyPoint(byAdmin, "student").requestedBy, "An admin");
  // A driver who has no profile any more still doesn't show their name.
  const noProfile = { ...row, requestedBy: { name: "Dana Driver", role: "student" as const, driver: null } };
  assert.equal(toPenaltyPoint(noProfile, "student").requestedBy, "A driver");
});

test("the two decisions set the two final statuses", () => {
  assert.deepEqual(PENALTY_DECISIONS, { approve: "approved", reject: "rejected" });
});
