import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "./password.ts";

test("a password matches its own hash only", async () => {
  const stored = await hashPassword("correct horse");
  assert.equal(await verifyPassword("correct horse", stored), true);
  assert.equal(await verifyPassword("wrong horse", stored), false);
});

test("the same password hashes differently each time", async () => {
  assert.notEqual(await hashPassword("same"), await hashPassword("same"));
});

test("a malformed stored hash never matches", async () => {
  assert.equal(await verifyPassword("anything", ""), false);
  assert.equal(await verifyPassword("anything", "abc:def"), false);
});
