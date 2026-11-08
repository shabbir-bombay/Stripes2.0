import { fail, readBody } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { normalizeEmail } from "@/lib/server/email";
import { finishPasswordReset } from "@/lib/server/identity";
import { isCode } from "@/lib/server/identity-rules";

/** Sets a new password with the code from forgot-password. Then the account signs in with it. */
export async function POST(request: Request) {
  const { email, code, password } = (await readBody(request)) ?? {};
  if (typeof email !== "string" || !isCode(code)) return fail(400, "Enter your email and the 6-digit code.");
  if (typeof password !== "string" || password.length < 8 || password.length > 200) return fail(400, "The password must be at least 8 characters.");
  const address = normalizeEmail(email);
  const result = await finishPasswordReset(address, code, password);
  if (!result.ok) return fail(result.status, result.error);
  if (result.passwordHash) await db.user.updateMany({ where: { email: address }, data: { passwordHash: result.passwordHash } });
  return new Response(null, { status: 204 });
}
