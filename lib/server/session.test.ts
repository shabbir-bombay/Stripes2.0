import assert from "node:assert/strict";
import test from "node:test";
import { createSessionToken, readSessionToken, SESSION_DAYS } from "./session.ts";

process.env.AUTH_SECRET = "test-secret-that-is-at-least-32-characters";

test("a token reads back as the same user and role", () => {
  assert.deepEqual(readSessionToken(createSessionToken("user-1", "driver")), { userId: "user-1", role: "driver" });
});

test("a token expires after the session length", () => {
  const now = Date.now();
  const token = createSessionToken("user-1", "student", now);
  const day = 24 * 60 * 60 * 1000;
  assert.notEqual(readSessionToken(token, now + SESSION_DAYS * day - 1), null);
  assert.equal(readSessionToken(token, now + SESSION_DAYS * day), null);
});

test("a changed payload or signature is rejected", () => {
  const [payload, signature] = createSessionToken("user-1", "student").split(".");
  const asAdmin = Buffer.from(JSON.stringify({ u: "user-1", r: "admin", e: Date.now() + 60_000 })).toString("base64url");
  assert.equal(readSessionToken(`${asAdmin}.${signature}`), null);
  assert.equal(readSessionToken(`${payload}.${signature.slice(1)}x`), null);
  assert.equal(readSessionToken(`${payload}.${signature}.extra`), null);
});

test("a token signed with another secret is rejected", () => {
  const token = createSessionToken("user-1", "student");
  process.env.AUTH_SECRET = "another-secret-that-is-at-least-32-chars";
  try {
    assert.equal(readSessionToken(token), null);
  } finally {
    process.env.AUTH_SECRET = "test-secret-that-is-at-least-32-characters";
  }
});

test("garbage is rejected without throwing", () => {
  for (const token of ["", ".", "abc", "abc.def", "a.b.c"]) assert.equal(readSessionToken(token), null);
});

test("a missing or short secret is a hard error", () => {
  const saved = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "short";
  try {
    assert.throws(() => createSessionToken("user-1", "student"), /AUTH_SECRET/);
  } finally {
    process.env.AUTH_SECRET = saved;
  }
});
