import assert from "node:assert/strict";
import test from "node:test";
import { MAX_PARTY_SIZE, partyLimit } from "./party.ts";

test("a party is at most 3, however big the carts are", () => {
  assert.equal(MAX_PARTY_SIZE, 3);
  assert.equal(partyLimit(6), 3);
  assert.equal(partyLimit(20), 3);
  assert.equal(partyLimit(4), 3);
});

test("a smaller cart lowers the limit to its seats less the driver's", () => {
  assert.equal(partyLimit(3), 2);
  assert.equal(partyLimit(2), 1);
});

test("with no active cart a request can still hold the student", () => {
  assert.equal(partyLimit(null), 1);
});
