import { fail, readBody, requireUser } from "@/lib/server/auth";
import { parseNewCart } from "@/lib/server/cart-rules";
import { db } from "@/lib/server/db";
import { cartInclude, toCart } from "@/lib/server/drivers";
import { isUniqueViolation } from "@/lib/server/rides";

export async function POST(request: Request) {
  const user = await requireUser("admin");
  if (user instanceof Response) return user;

  const parsed = parseNewCart(await readBody(request));
  if (!parsed.ok) return fail(400, parsed.error);

  try {
    return Response.json(toCart(await db.cart.create({ data: parsed.value, include: cartInclude })), { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) return fail(409, `Cart ${parsed.value.number} already exists.`);
    throw error;
  }
}
