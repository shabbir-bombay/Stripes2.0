import assert from "node:assert/strict";
import test from "node:test";
import { isGone, parseSubscription, pushPayload } from "./push-rules.ts";

const p256dh = "B" + "A".repeat(86);
const auth = "c".repeat(22);
const endpoint = "https://fcm.googleapis.com/fcm/send/abc123";

test("a browser subscription is accepted as is", () => {
  assert.deepEqual(parseSubscription({ endpoint, keys: { p256dh, auth }, expirationTime: null }), { ok: true, value: { endpoint, keys: { p256dh, auth } } });
});

test("a subscription needs an https endpoint and keys of the right shape", () => {
  for (const bad of [
    null,
    { keys: { p256dh, auth } },
    { endpoint: "http://push.example/abc", keys: { p256dh, auth } },
    { endpoint: "not a url", keys: { p256dh, auth } },
    { endpoint: `https://x/${"a".repeat(2050)}`, keys: { p256dh, auth } },
    { endpoint },
    { endpoint, keys: { p256dh: "short", auth } },
    { endpoint, keys: { p256dh: p256dh.slice(0, -1) + "!", auth } },
    { endpoint, keys: { p256dh, auth: "x" } },
    { endpoint, keys: { p256dh, auth: 5 } },
  ]) {
    assert.equal(parseSubscription(bad as Record<string, unknown> | null).ok, false, JSON.stringify(bad)?.slice(0, 80));
  }
});

test("an alert opens the person's notifications, and alerts about one ride replace each other", () => {
  const ride = JSON.parse(pushPayload({ id: "n1", text: "Your cart is at Baun.", rideId: "r1", role: "student" }));
  assert.deepEqual(ride, { title: "Stripes", body: "Your cart is at Baun.", url: "/student/notifications", tag: "r1" });
  const point = JSON.parse(pushPayload({ id: "n2", text: "A penalty point.", rideId: null, role: "driver" }));
  assert.equal(point.tag, "n2");
  assert.equal(point.url, "/driver/notifications");
});

test("only 404 and 410 mean the subscription is gone", () => {
  assert.equal(isGone(404), true);
  assert.equal(isGone(410), true);
  for (const code of [400, 413, 429, 500, undefined]) assert.equal(isGone(code), false, String(code));
});
