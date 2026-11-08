import { fail, readBody } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { normalizeEmail } from "@/lib/server/email";
import { startPasswordReset } from "@/lib/server/identity";

/** Sends a password-reset code to the account's email. The answer is the same whether or not the account exists. */
export async function POST(request: Request) {
  const { email } = (await readBody(request)) ?? {};
  if (typeof email !== "string" || !email.trim()) return fail(400, "Enter your email.");
  const address = normalizeEmail(email);
  const user = await db.user.findUnique({ where: { email: address }, select: { id: true, email: true, passwordHash: true } });
  const result = await startPasswordReset(user, address);
  if (!result.ok) return fail(result.status, result.error);
  if (result.clearHash) await db.user.update({ where: { id: user!.id }, data: { passwordHash: null } });
  return new Response(null, { status: 204 });
}
