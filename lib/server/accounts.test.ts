import assert from "node:assert/strict";
import test from "node:test";
import { parseName, parseUserUpdate, planUserDelete, planUserUpdate, type UserTarget } from "./accounts.ts";

const student: UserTarget = { id: "s1", name: "Sam", role: "student", suspended: false, callSign: null, onShift: false, ridesAsStudent: 0, ridesAsDriver: 0 };
const driver: UserTarget = { ...student, id: "d1", name: "Dana", role: "driver", callSign: "Tiger 1" };
const admin: UserTarget = { ...student, id: "a1", name: "Alex", role: "admin" };

test("a name is trimmed and has a length limit", () => {
  assert.deepEqual(parseName("  Sam  "), { ok: true, value: "Sam" });
  for (const bad of ["", "   ", "x".repeat(81), 5, null, undefined]) assert.equal(parseName(bad).ok, false, String(bad));
});

test("an update needs something valid to change", () => {
  assert.deepEqual(parseUserUpdate({ role: "driver", callSign: " Tiger 9 ", suspended: true }), {
    ok: true,
    value: { role: "driver", callSign: "Tiger 9", suspended: true },
  });
  for (const bad of [null, {}, { role: "owner" }, { suspended: "yes" }, { callSign: "  " }, { callSign: "x".repeat(31) }, { callSign: 3 }]) {
    assert.equal(parseUserUpdate(bad).ok, false, JSON.stringify(bad));
  }
});

test("an admin can't lock themselves out", () => {
  for (const update of [{ role: "student" as const }, { suspended: true }]) {
    const plan = planUserUpdate(admin, "a1", update);
    assert.equal(plan.ok, false);
    assert.equal(!plan.ok && plan.status, 409);
  }
  assert.equal(planUserUpdate(admin, "a1", { role: "admin" }).ok, true);
  assert.equal(planUserUpdate(admin, "a1", { suspended: false }).ok, true);
});

test("the first promotion to driver needs a call sign; a returning driver keeps theirs", () => {
  assert.deepEqual(planUserUpdate(student, "a1", { role: "driver" }), { ok: false, status: 400, error: "Give this driver a call sign." });
  assert.deepEqual(planUserUpdate(student, "a1", { role: "driver", callSign: "Tiger 9" }), {
    ok: true,
    user: { role: "driver" },
    callSign: "Tiger 9",
    endShift: false,
  });
  const former = { ...student, callSign: "Tiger 4" };
  assert.deepEqual(planUserUpdate(former, "a1", { role: "driver" }), { ok: true, user: { role: "driver" }, endShift: false });
});

test("only drivers have a call sign", () => {
  assert.equal(planUserUpdate(student, "a1", { callSign: "Tiger 9" }).ok, false);
  assert.equal(planUserUpdate(driver, "a1", { role: "student", callSign: "Tiger 9" }).ok, false);
  assert.deepEqual(planUserUpdate(driver, "a1", { callSign: "Tiger 9" }), { ok: true, user: {}, callSign: "Tiger 9", endShift: false });
});

test("access isn't taken away during a live ride", () => {
  for (const update of [{ suspended: true }, { role: "driver" as const, callSign: "T" }]) {
    const plan = planUserUpdate({ ...student, ridesAsStudent: 1 }, "a1", update);
    assert.deepEqual(plan, { ok: false, status: 409, error: "Sam has a ride that isn't over. Cancel it first." });
  }
  for (const update of [{ suspended: true }, { role: "student" as const }]) {
    const plan = planUserUpdate({ ...driver, onShift: true, ridesAsDriver: 2 }, "a1", update);
    assert.deepEqual(plan, { ok: false, status: 409, error: "Dana is holding a ride. Reassign or cancel it first." });
  }
});

test("a driver with no rides comes off shift when losing access, so the cart is freed", () => {
  const onShift = { ...driver, onShift: true };
  assert.deepEqual(planUserUpdate(onShift, "a1", { suspended: true }), { ok: true, user: { suspended: true }, endShift: true });
  assert.deepEqual(planUserUpdate(onShift, "a1", { role: "student" }), { ok: true, user: { role: "student" }, endShift: true });
  assert.deepEqual(planUserUpdate(onShift, "a1", { callSign: "Tiger 7" }), { ok: true, user: {}, callSign: "Tiger 7", endShift: false });
  assert.deepEqual(planUserUpdate(driver, "a1", { suspended: true }), { ok: true, user: { suspended: true }, endShift: false });
});

test("reinstating someone is always allowed", () => {
  const suspended = { ...student, suspended: true, ridesAsStudent: 1 };
  assert.deepEqual(planUserUpdate(suspended, "a1", { suspended: false }), { ok: true, user: { suspended: false }, endShift: false });
  // Already suspended, so sending true again takes nothing away.
  assert.equal(planUserUpdate(suspended, "a1", { suspended: true }).ok, true);
});

test("an admin can't delete their own account", () => {
  const plan = planUserDelete(admin, "a1");
  assert.equal(plan.ok, false);
  assert.equal(!plan.ok && plan.status, 409);
  assert.deepEqual(planUserDelete(admin, "a2"), { ok: true });
});

test("an account in a live ride can't be deleted", () => {
  const asStudent = planUserDelete({ ...student, ridesAsStudent: 1 }, "a1");
  assert.equal(!asStudent.ok && asStudent.status, 409);
  const asDriver = planUserDelete({ ...driver, ridesAsDriver: 1 }, "a1");
  assert.equal(!asDriver.ok && asDriver.status, 409);
});

test("anyone else can be deleted, including a driver on shift with no ride", () => {
  for (const target of [student, { ...student, suspended: true }, { ...driver, onShift: true }, admin]) {
    assert.deepEqual(planUserDelete(target, "someone-else"), { ok: true }, target.name);
  }
});
