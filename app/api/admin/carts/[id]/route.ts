import { fail, readBody, requireUser } from "@/lib/server/auth";
import { cartEditBlocked, parseCartEdit } from "@/lib/server/cart-rules";
import { db } from "@/lib/server/db";
import { cartInclude, toCart } from "@/lib/server/drivers";
import { isUniqueViolation, isUuid } from "@/lib/server/rides";

const NOT_FOUND = "No such cart.";

export async function PATCH(request: Request, { params }: RouteContext<"/api/admin/carts/[id]">) {
  const user = await requireUser("admin");
  if (user instanceof Response) return user;

  const { id } = await params;
  if (!isUuid(id)) return fail(404, NOT_FOUND);
  const parsed = parseCartEdit(await readBody(request));
  if (!parsed.ok) return fail(400, parsed.error);

  const cart = await db.cart.findUnique({ where: { id }, include: cartInclude });
  if (!cart) return fail(404, NOT_FOUND);
  const blocked = cartEditBlocked(toCart(cart));
  if (blocked) return fail(409, blocked);

  try {
    // Only while still free, so a driver starting a shift on this cart at the same moment stops the edit.
    const { count } = await db.cart.updateMany({ where: { id, driver: null }, data: parsed.value });
    if (count === 0) return fail(409, `Cart ${cart.number} just went on shift. Edit it once the shift ends.`);
  } catch (error) {
    if (isUniqueViolation(error)) return fail(409, `Cart ${parsed.value.number} already exists.`);
    throw error;
  }
  return Response.json(toCart(await db.cart.findUniqueOrThrow({ where: { id }, include: cartInclude })));
}
