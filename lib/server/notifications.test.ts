import assert from "node:assert/strict";
import test from "node:test";
import { penaltyNotice, rideNotices } from "./notifications.ts";

const waiting = { studentId: "s1", driverId: null, pickupName: "Burns Tower" };
const held = { ...waiting, driverId: "d1" };
const driver = { id: "d1", callSign: "Tiger 1", cartNumber: "3" };

test("a driver's claim tells only the student, with the cart to look for", () => {
  assert.deepEqual(rideNotices(waiting, { to: "assigned", by: "driver", driver }), [
    { userId: "s1", type: "ride_assigned", text: "Tiger 1 has your ride. Look for Cart 3." },
  ]);
});

test("an admin's assign also tells the driver", () => {
  assert.deepEqual(rideNotices(waiting, { to: "assigned", by: "admin", driver }), [
    { userId: "s1", type: "ride_assigned", text: "Tiger 1 has your ride. Look for Cart 3." },
    { userId: "d1", type: "ride_assigned", text: "An admin gave you the ride from Burns Tower." },
  ]);
});

test("a driver with no cart on record leaves the cart out", () => {
  const [notice] = rideNotices(waiting, { to: "assigned", by: "driver", driver: { ...driver, cartNumber: null } });
  assert.equal(notice.text, "Tiger 1 has your ride.");
});

test("arriving tells the student", () => {
  assert.deepEqual(rideNotices(held, { to: "arrived", by: "driver" }), [
    { userId: "s1", type: "driver_arrived", text: "Your cart is at Burns Tower." },
  ]);
});

test("a student's own cancel tells the driver holding the ride, not the student", () => {
  assert.deepEqual(rideNotices(held, { to: "canceled", by: "student", reason: "Canceled by student" }), [
    { userId: "d1", type: "ride_canceled", text: "The student canceled the ride from Burns Tower." },
  ]);
  assert.deepEqual(rideNotices(waiting, { to: "canceled", by: "student", reason: "Canceled by student" }), []);
});

test("a driver's cancel tells the student, with the reason", () => {
  assert.deepEqual(rideNotices(held, { to: "canceled", by: "driver", reason: "Flat tire" }), [
    { userId: "s1", type: "ride_canceled", text: "Your ride from Burns Tower was canceled: Flat tire" },
  ]);
});

test("an admin's cancel tells the student and any driver holding the ride", () => {
  assert.deepEqual(rideNotices(held, { to: "canceled", by: "admin", reason: "Weather" }), [
    { userId: "s1", type: "ride_canceled", text: "Your ride from Burns Tower was canceled: Weather" },
    { userId: "d1", type: "ride_canceled", text: "An admin canceled the ride from Burns Tower: Weather" },
  ]);
  assert.equal(rideNotices(waiting, { to: "canceled", by: "admin", reason: "Weather" }).length, 1);
});

test("other moves tell nobody", () => {
  for (const to of ["requested", "en_route", "in_progress", "completed", "no_show"]) {
    assert.deepEqual(rideNotices(held, { to, by: "driver" }), [], to);
  }
});

test("an approved penalty point tells the student the reason", () => {
  assert.deepEqual(penaltyNotice("s1", "Late to pickup"), {
    userId: "s1",
    type: "penalty_point",
    text: "A penalty point was added to your account: Late to pickup",
  });
});
