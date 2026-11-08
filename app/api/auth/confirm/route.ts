import { fail, readBody } from "@/lib/server/auth";
import { normalizeEmail } from "@/lib/server/email";
import { confirmEmail } from "@/lib/server/identity";
import { isCode } from "@/lib/server/identity-rules";

/** Confirms a new account's email with the code it was sent. Then the account can sign in. */
export async function POST(request: Request) {
  const { email, code } = (await readBody(request)) ?? {};
  if (typeof email !== "string" || !isCode(code)) return fail(400, "Enter your email and the 6-digit code.");
  const result = await confirmEmail(normalizeEmail(email), code);
  if (!result.ok) return fail(result.status, result.error);
  return new Response(null, { status: 204 });
}
