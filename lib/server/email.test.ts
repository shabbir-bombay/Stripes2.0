import assert from "node:assert/strict";
import test from "node:test";
import { isPacificEmail, normalizeEmail } from "./email.ts";

test("staff and student Pacific addresses are accepted", () => {
  assert.equal(isPacificEmail("admin@pacific.edu"), true);
  assert.equal(isPacificEmail("s_tiger@u.pacific.edu"), true);
  assert.equal(isPacificEmail("  Sam@U.Pacific.EDU "), true);
});

test("other domains and look-alikes are rejected", () => {
  for (const email of [
    "sam@gmail.com",
    "sam@notpacific.edu",
    "sam@x.pacific.edu",
    "sam@pacific.edu.evil.com",
    "@pacific.edu",
    "a@b@pacific.edu",
    "sam pacific@pacific.edu",
    "",
  ]) {
    assert.equal(isPacificEmail(email), false, email);
  }
});

test("emails are stored trimmed and lowercase", () => {
  assert.equal(normalizeEmail("  Sam@U.Pacific.EDU "), "sam@u.pacific.edu");
});
