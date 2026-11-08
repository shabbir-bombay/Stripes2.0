import { randomInt } from "node:crypto";

// The parts of signing in that don't talk to Cognito or the database, as pure functions so they can be tested.

export type IdentityFailure = { ok: false; status: 400 | 401 | 403 | 409 | 429; error: string; code?: "unconfirmed" };

export const WRONG_PASSWORD: IdentityFailure = { ok: false, status: 401, error: "Wrong email or password." };
export const UNCONFIRMED: IdentityFailure = {
  ok: false,
  status: 403,
  error: "Confirm your email first. Enter the code we sent you.",
  code: "unconfirmed",
};

/** The answer to give for a Cognito error, or null if it is unexpected and should be thrown. */
export function cognitoFailure(name: string): IdentityFailure | null {
  switch (name) {
    case "UsernameExistsException":
      return { ok: false, status: 409, error: "An account with this email already exists. Sign in instead." };
    case "InvalidPasswordException":
      return { ok: false, status: 400, error: "The password must be at least 8 characters." };
    case "CodeMismatchException":
    case "UserNotFoundException":
      return { ok: false, status: 400, error: "That code isn't right. Check the email and try again." };
    case "ExpiredCodeException":
      return { ok: false, status: 400, error: "That code has expired. Ask for a new one." };
    case "NotAuthorizedException":
      return WRONG_PASSWORD;
    case "UserNotConfirmedException":
      return UNCONFIRMED;
    case "LimitExceededException":
    case "TooManyRequestsException":
    case "TooManyFailedAttemptsException":
      return { ok: false, status: 429, error: "Too many tries. Wait a few minutes and try again." };
    case "CodeDeliveryFailureException":
      return { ok: false, status: 400, error: "We couldn't send the email. Check the address and try again." };
    default:
      return null;
  }
}

/** A Cognito code is 6 digits. */
export function isCode(value: unknown): value is string {
  return typeof value === "string" && /^\d{6}$/.test(value.trim());
}

const RESET_MINUTES = 15;
const MAX_TRIES = 5;

/**
 * Password-reset codes when there is no Cognito (local development). The code is printed in the server log instead of
 * emailed. Each email has one code at a time; it expires after 15 minutes or 5 wrong tries.
 */
export class LocalResetCodes {
  private codes = new Map<string, { code: string; expires: number; tries: number }>();
  private now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  issue(email: string): string {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    this.codes.set(email, { code, expires: this.now() + RESET_MINUTES * 60_000, tries: 0 });
    return code;
  }

  check(email: string, code: string): "ok" | "wrong" | "expired" {
    const entry = this.codes.get(email);
    if (!entry || entry.expires <= this.now()) {
      this.codes.delete(email);
      return entry ? "expired" : "wrong";
    }
    if (entry.code !== code.trim()) {
      if (++entry.tries >= MAX_TRIES) this.codes.delete(email);
      return "wrong";
    }
    this.codes.delete(email);
    return "ok";
  }
}
