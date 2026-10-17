import { fail, readBody, startSession, toMe } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { normalizeEmail } from "@/lib/server/email";
import { verifyPassword } from "@/lib/server/password";

export async function POST(request: Request) {
  const body = await readBody(request);
  const { email, password } = body ?? {};
  if (typeof email !== "string" || typeof password !== "string") return fail(400, "Email and password are required.");

  const user = await db.user.findUnique({ where: { email: normalizeEmail(email) } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) return fail(401, "Wrong email or password.");
  if (user.suspended) return fail(403, "This account is suspended.");

  await startSession(user);
  return Response.json(toMe(user));
}
