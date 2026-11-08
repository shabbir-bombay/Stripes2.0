import { fail, readBody, startSession, toMe } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { normalizeEmail } from "@/lib/server/email";
import { checkPassword } from "@/lib/server/identity";
import { WRONG_PASSWORD } from "@/lib/server/identity-rules";

export async function POST(request: Request) {
  const body = await readBody(request);
  const { email, password } = body ?? {};
  if (typeof email !== "string" || typeof password !== "string") return fail(400, "Email and password are required.");

  const user = await db.user.findUnique({ where: { email: normalizeEmail(email) } });
  if (!user) return fail(WRONG_PASSWORD.status, WRONG_PASSWORD.error);
  const checked = await checkPassword(user, password);
  if (!checked.ok) return fail(checked.status, checked.error, checked.code);
  if (checked.clearHash) await db.user.update({ where: { id: user.id }, data: { passwordHash: null } });
  if (user.suspended) return fail(403, "This account is suspended.");

  await startSession(user);
  return Response.json(toMe(user));
}
