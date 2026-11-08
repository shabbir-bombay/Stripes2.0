import { randomBytes } from "node:crypto";
import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  InitiateAuthCommand,
  ResendConfirmationCodeCommand,
  SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { cognitoFailure, LocalResetCodes, WRONG_PASSWORD, type IdentityFailure } from "./identity-rules";
import { hashPassword, verifyPassword } from "./password";

// Who checks passwords. On AWS that is Amazon Cognito (COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID are set): it emails a
// code to confirm a new account and to reset a forgotten password. Without them (local development and CI) the password
// hash lives on our own User row, as before. Sessions, roles and suspension are ours either way.

export const usingCognito = () => !!(process.env.COGNITO_USER_POOL_ID && process.env.COGNITO_CLIENT_ID);

const poolId = () => process.env.COGNITO_USER_POOL_ID!;
const clientId = () => process.env.COGNITO_CLIENT_ID!;

let client: CognitoIdentityProviderClient | undefined;
const cognito = () => (client ??= new CognitoIdentityProviderClient({}));

const localResets = new LocalResetCodes();

type Ok<T = object> = { ok: true } & T;

/** The answer for an expected Cognito error; anything else is thrown. */
function answer(error: unknown): IdentityFailure {
  const failure = cognitoFailure((error as { name?: string }).name ?? "");
  if (!failure) throw error;
  return failure;
}

const errorName = (error: unknown) => (error as { name?: string }).name;

/**
 * Sets up the password for a new account. Locally that is a hash to save on the row. With Cognito, the password goes to
 * Cognito and it emails a code; the account can't sign in until the code is confirmed.
 * Call it only when no account here has this email.
 */
export async function createLogin(email: string, password: string): Promise<Ok<{ passwordHash: string | null; confirm: boolean }> | IdentityFailure> {
  if (!usingCognito()) return { ok: true, passwordHash: await hashPassword(password), confirm: false };
  const signUp = () =>
    cognito().send(new SignUpCommand({ ClientId: clientId(), Username: email, Password: password, UserAttributes: [{ Name: "email", Value: email }] }));
  try {
    await signUp();
  } catch (error) {
    if (errorName(error) !== "UsernameExistsException") return answer(error);
    // A Cognito login without an account here is left from a deleted account or a sign-up that failed halfway. Start again.
    await deleteLogin(email);
    try {
      await signUp();
    } catch (retryError) {
      return answer(retryError);
    }
  }
  return { ok: true, passwordHash: null, confirm: true };
}

/**
 * Checks the password of an existing account. An account that still has a hash is checked against it; with Cognito on,
 * a correct password is then moved to Cognito and `clearHash` says to remove the hash from the row.
 */
export async function checkPassword(
  user: { email: string; passwordHash: string | null },
  password: string,
): Promise<Ok<{ clearHash: boolean }> | IdentityFailure> {
  if (user.passwordHash) {
    if (!(await verifyPassword(password, user.passwordHash))) return WRONG_PASSWORD;
    return { ok: true, clearHash: usingCognito() && (await moveLogin(user.email, password)) };
  }
  if (!usingCognito()) return WRONG_PASSWORD;
  try {
    await cognito().send(
      new InitiateAuthCommand({ ClientId: clientId(), AuthFlow: "USER_PASSWORD_AUTH", AuthParameters: { USERNAME: user.email, PASSWORD: password } }),
    );
  } catch (error) {
    return answer(error);
  }
  return { ok: true, clearHash: false };
}

/** Creates a confirmed Cognito login with this password, for an account made before Cognito. False if it couldn't. */
async function moveLogin(email: string, password: string): Promise<boolean> {
  const create = () =>
    cognito().send(
      new AdminCreateUserCommand({
        UserPoolId: poolId(),
        Username: email,
        MessageAction: "SUPPRESS",
        UserAttributes: [
          { Name: "email", Value: email },
          { Name: "email_verified", Value: "true" },
        ],
      }),
    );
  try {
    try {
      await create();
    } catch (error) {
      if (errorName(error) !== "UsernameExistsException") throw error;
      await deleteLogin(email);
      await create();
    }
    await cognito().send(new AdminSetUserPasswordCommand({ UserPoolId: poolId(), Username: email, Password: password, Permanent: true }));
    return true;
  } catch (error) {
    // The password is still right, so sign in anyway; the move is tried again next time.
    console.error(`Couldn't move ${email} to Cognito:`, error);
    return false;
  }
}

/** Confirms a new account's email with the code Cognito sent. Nothing to do without Cognito. */
export async function confirmEmail(email: string, code: string): Promise<Ok | IdentityFailure> {
  if (!usingCognito()) return { ok: true };
  try {
    await cognito().send(new ConfirmSignUpCommand({ ClientId: clientId(), Username: email, ConfirmationCode: code.trim() }));
  } catch (error) {
    // "User cannot be confirmed. Current status is CONFIRMED": already done, which is what was asked.
    if (errorName(error) === "NotAuthorizedException") return { ok: true };
    return answer(error);
  }
  return { ok: true };
}

/** Emails a new confirmation code. Says nothing about whether the account exists. */
export async function resendCode(email: string): Promise<Ok | IdentityFailure> {
  if (!usingCognito()) return { ok: true };
  try {
    await cognito().send(new ResendConfirmationCodeCommand({ ClientId: clientId(), Username: email }));
  } catch (error) {
    const failure = answer(error);
    if (failure.status === 429) return failure;
  }
  return { ok: true };
}

/**
 * Sends a password-reset code: emailed by Cognito, or printed in the server log locally. An account that still has a
 * hash is moved to Cognito first (with a random password), since Cognito can only reset its own logins; `clearHash`
 * then says to remove the hash. Says nothing about whether the account exists.
 */
export async function startPasswordReset(user: { email: string; passwordHash: string | null } | null, email: string): Promise<Ok<{ clearHash: boolean }> | IdentityFailure> {
  if (!usingCognito()) {
    if (user) console.log(`Password reset code for ${email}: ${localResets.issue(email)} (local only; on AWS it is emailed)`);
    return { ok: true, clearHash: false };
  }
  const clearHash = !!user?.passwordHash && (await moveLogin(email, `${randomBytes(18).toString("base64url")}aA1!`));
  try {
    await cognito().send(new ForgotPasswordCommand({ ClientId: clientId(), Username: email }));
  } catch (error) {
    const failure = answer(error);
    if (failure.status === 429) return failure;
    // Anything else (no such login, an email that was never confirmed) gets the same answer as success,
    // so nobody can use this to find out who has an account.
  }
  return { ok: true, clearHash };
}

/** Sets a new password with a reset code. Locally, `passwordHash` is the new hash to save on the row. */
export async function finishPasswordReset(email: string, code: string, password: string): Promise<Ok<{ passwordHash?: string }> | IdentityFailure> {
  if (!usingCognito()) {
    const result = localResets.check(email, code);
    if (result === "expired") return cognitoFailure("ExpiredCodeException")!;
    if (result === "wrong") return cognitoFailure("CodeMismatchException")!;
    return { ok: true, passwordHash: await hashPassword(password) };
  }
  try {
    await cognito().send(new ConfirmForgotPasswordCommand({ ClientId: clientId(), Username: email, ConfirmationCode: code.trim(), Password: password }));
  } catch (error) {
    return answer(error);
  }
  return { ok: true };
}

/** Removes the Cognito login for a deleted account. Nothing to do without Cognito, or if there is none. */
export async function deleteLogin(email: string) {
  if (!usingCognito()) return;
  try {
    await cognito().send(new AdminDeleteUserCommand({ UserPoolId: poolId(), Username: email }));
  } catch (error) {
    if (errorName(error) !== "UserNotFoundException") throw error;
  }
}
