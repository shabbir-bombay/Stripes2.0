import assert from "node:assert/strict";
import test from "node:test";
import { cartEditBlocked, parseCartEdit, parseNewCart } from "./cart-rules.ts";

test("a new cart needs a number and seats", () => {
  assert.deepEqual(parseNewCart({ number: " 3 ", seats: 4 }), { ok: true, value: { number: "3", seats: 4 } });
  assert.deepEqual(parseNewCart({ number: "3", seats: 4, active: false }), { ok: true, value: { number: "3", seats: 4, active: false } });
  for (const bad of [null, {}, { number: "3" }, { seats: 4 }, { number: "", seats: 4 }, { number: "12345678901", seats: 4 }]) {
    assert.equal(parseNewCart(bad).ok, false, JSON.stringify(bad));
  }
});

test("seats match the database rule, 2 to 20 whole seats", () => {
  for (const seats of [2, 20]) assert.equal(parseNewCart({ number: "3", seats }).ok, true, String(seats));
  for (const seats of [1, 21, 2.5, "4", null]) assert.equal(parseNewCart({ number: "3", seats }).ok, false, String(seats));
});

test("an edit takes any field but needs at least one", () => {
  assert.deepEqual(parseCartEdit({ active: false }), { ok: true, value: { active: false } });
  assert.deepEqual(parseCartEdit({ seats: 6 }), { ok: true, value: { seats: 6 } });
  for (const bad of [null, {}, { active: "no" }, { seats: 99 }, { number: "  " }]) {
    assert.equal(parseCartEdit(bad).ok, false, JSON.stringify(bad));
  }
});

test("a cart on shift can't be edited", () => {
  assert.equal(cartEditBlocked({ number: "1", inUseBy: null }), null);
  assert.equal(cartEditBlocked({ number: "1", inUseBy: "Tiger 1" }), "Cart 1 is on shift with Tiger 1. Edit it once the shift ends.");
});
