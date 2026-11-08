import assert from "node:assert/strict";
import test from "node:test";
import { cognitoFailure, isCode, LocalResetCodes } from "./identity-rules.ts";

test("expected Cognito errors get a readable answer; unexpected ones are thrown", () => {
  assert.equal(cognitoFailure("NotAuthorizedException")?.status, 401);
  assert.deepEqual(cognitoFailure("UserNotConfirmedException"), {
    ok: false,
    status: 403,
    error: "Confirm your email first. Enter the code we sent you.",
    code: "unconfirmed",
  });
  assert.equal(cognitoFailure("UsernameExistsException")?.status, 409);
  for (const name of ["CodeMismatchException", "ExpiredCodeException", "InvalidPasswordException"]) assert.equal(cognitoFailure(name)?.status, 400, name);
  for (const name of ["LimitExceededException", "TooManyRequestsException", "TooManyFailedAttemptsException"]) assert.equal(cognitoFailure(name)?.status, 429, name);
  // A wrong code and an unknown account read the same, so codes can't be used to find accounts.
  assert.deepEqual(cognitoFailure("UserNotFoundException"), cognitoFailure("CodeMismatchException"));
  assert.equal(cognitoFailure("InternalErrorException"), null);
});

test("a code is 6 digits", () => {
  assert.equal(isCode("012345"), true);
  assert.equal(isCode(" 123456 "), true);
  for (const bad of ["12345", "1234567", "12a456", 123456, null]) assert.equal(isCode(bad), false, String(bad));
});

test("a local reset code works once", () => {
  const codes = new LocalResetCodes(() => 0);
  const code = codes.issue("sam@u.pacific.edu");
  assert.match(code, /^\d{6}$/);
  assert.equal(codes.check("sam@u.pacific.edu", code), "ok");
  assert.equal(codes.check("sam@u.pacific.edu", code), "wrong");
});

test("a local reset code expires after 15 minutes, and a new one replaces the old", () => {
  let now = 0;
  const codes = new LocalResetCodes(() => now);
  const first = codes.issue("sam@u.pacific.edu");
  const second = codes.issue("sam@u.pacific.edu");
  if (first !== second) assert.equal(codes.check("sam@u.pacific.edu", first), "wrong");
  now = 15 * 60_000;
  assert.equal(codes.check("sam@u.pacific.edu", second), "expired");
});

test("five wrong tries use up a local reset code", () => {
  const codes = new LocalResetCodes(() => 0);
  const code = codes.issue("sam@u.pacific.edu");
  const wrong = code === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) assert.equal(codes.check("sam@u.pacific.edu", wrong), "wrong");
  assert.equal(codes.check("sam@u.pacific.edu", code), "wrong");
});
