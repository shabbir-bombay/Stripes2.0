import assert from "node:assert/strict";
import test from "node:test";
import { parseFeedback } from "./feedback.ts";

test("a rating is a whole number from 1 to 5", () => {
  for (const rating of [1, 2, 3, 4, 5]) assert.deepEqual(parseFeedback({ rating }), { ok: true, rating, comment: null });
  for (const rating of [0, 6, 2.5, "5", null, undefined]) assert.equal(parseFeedback({ rating }).ok, false, String(rating));
  assert.equal(parseFeedback(null).ok, false);
});

test("a comment is optional, trimmed, and blank counts as none", () => {
  assert.deepEqual(parseFeedback({ rating: 4, comment: "  Nice driver  " }), { ok: true, rating: 4, comment: "Nice driver" });
  for (const comment of ["", "   ", null]) assert.deepEqual(parseFeedback({ rating: 4, comment }), { ok: true, rating: 4, comment: null });
  assert.equal(parseFeedback({ rating: 4, comment: "x".repeat(500) }).ok, true);
  assert.equal(parseFeedback({ rating: 4, comment: "x".repeat(501) }).ok, false);
  assert.equal(parseFeedback({ rating: 4, comment: 5 }).ok, false);
});
