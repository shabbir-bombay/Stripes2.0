import { parseName } from "@/lib/server/accounts";
import { fail, readBody, startSession, toMe } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { isPacificEmail, normalizeEmail } from "@/lib/server/email";
import { hashPassword } from "@/lib/server/password";

// Creates a student account and signs it in. Staff accounts come from the seed, or an admin changes the role.
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

  try {
    const user = await db.user.create({
      data: { email: normalizeEmail(email), passwordHash: await hashPassword(password), name: parsedName.value },
    });
    await startSession(user);
    return Response.json(toMe(user), { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return fail(409, "An account with this email already exists. Sign in instead.");
    throw error;
  }
}
