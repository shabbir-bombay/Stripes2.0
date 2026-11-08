import { fail, readBody } from "@/lib/server/auth";
import { normalizeEmail } from "@/lib/server/email";
import { resendCode } from "@/lib/server/identity";

/** Emails a new confirmation code. The answer is the same whether or not the account exists. */
export async function POST(request: Request) {
  const { email } = (await readBody(request)) ?? {};
  if (typeof email !== "string" || !email.trim()) return fail(400, "Enter your email.");
  const result = await resendCode(normalizeEmail(email));
  if (!result.ok) return fail(result.status, result.error);
  return new Response(null, { status: 204 });
}
