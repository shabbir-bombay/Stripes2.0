import { parseName } from "@/lib/server/accounts";
import { fail, readBody, startSession, toMe } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { isPacificEmail, normalizeEmail } from "@/lib/server/email";
import { createLogin } from "@/lib/server/identity";
import { isUniqueViolation } from "@/lib/server/rides";
import type { SignUpResult } from "@/lib/types";

const TAKEN = "An account with this email already exists. Sign in instead.";

// Creates a student account. Staff accounts come from the seed, or an admin changes the role.
// On AWS, Cognito emails a code and the account signs in after confirming it; locally it is signed in at once.
export async function POST(request: Request) {
  const body = await readBody(request);
  const { email, password, name } = body ?? {};
  if (typeof email !== "string" || typeof password !== "string" || typeof name !== "string") {
    return fail(400, "Email, password and name are required.");
  }
  if (!isPacificEmail(email)) return fail(400, "Use your @u.pacific.edu or @pacific.edu email.");
  if (password.length < 8 || password.length > 200) return fail(400, "The password must be at least 8 characters.");
  const parsedName = parseName(name);
  if (!parsedName.ok) return fail(400, parsedName.error);

  const address = normalizeEmail(email);
  if (await db.user.findUnique({ where: { email: address }, select: { id: true } })) return fail(409, TAKEN);
  const login = await createLogin(address, password);
  if (!login.ok) return fail(login.status, login.error);

  try {
    const user = await db.user.create({ data: { email: address, passwordHash: login.passwordHash, name: parsedName.value } });
    if (login.confirm) return Response.json({ confirm: true, email: address } satisfies SignUpResult, { status: 201 });
    await startSession(user);
    return Response.json(toMe(user) satisfies SignUpResult, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) return fail(409, TAKEN);
    throw error;
  }
}
