import { fail, readBody, requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { currentShift } from "@/lib/server/drivers";
import { HELD } from "@/lib/server/ride-status";
import { isUniqueViolation, isUuid } from "@/lib/server/rides";

const NO_PROFILE = "Your driver account isn't set up yet. Ask an admin.";

/** Starts a shift on a free, active cart. */
export async function POST(request: Request) {
  const user = await requireUser("driver");
  if (user instanceof Response) return user;

  const cartId = (await readBody(request))?.cartId;
  if (!isUuid(cartId)) return fail(400, "Choose a cart.");

  const [profile, cart] = await Promise.all([
    db.driverProfile.findUnique({ where: { userId: user.id } }),
    db.cart.findUnique({ where: { id: cartId }, include: { driver: true } }),
  ]);
  if (!profile) return fail(403, NO_PROFILE);
  if (!cart) return fail(400, "Choose a cart.");
  if (profile.cartId) return fail(409, "You're already on shift.");
  if (!cart.active) return fail(409, `Cart ${cart.number} is out of service. Choose another.`);
  const inUse = `Cart ${cart.number} is in use. Choose another.`;
  if (cart.driver) return fail(409, inUse);

  try {
    // Only while still off shift, so two tabs starting at once give one shift.
    const { count } = await db.driverProfile.updateMany({
      where: { userId: user.id, cartId: null },
      data: { cartId, shiftStart: new Date() },
    });
    if (count === 0) return fail(409, "You're already on shift.");
  } catch (error) {
    // Another driver took the cart at the same moment: one driver per cart (unique cartId).
    if (isUniqueViolation(error)) return fail(409, inUse);
    throw error;
  }
  return Response.json(await currentShift(user.id), { status: 201 });
}

/** Ends the shift and frees the cart. Not while the driver still holds a ride. */
export async function DELETE() {
  const user = await requireUser("driver");
  if (user instanceof Response) return user;

  if (!(await db.driverProfile.findUnique({ where: { userId: user.id } }))) return fail(403, NO_PROFILE);
  // One conditional update, so a ride claimed a moment ago still blocks it.
  const { count } = await db.driverProfile.updateMany({
    where: { userId: user.id, rides: { none: { status: { in: HELD } } } },
    data: { cartId: null, shiftStart: null, lat: null, lng: null, positionAt: null },
  });
  if (count === 0) return fail(409, "Finish or cancel your rides before ending your shift.");
  return new Response(null, { status: 204 });
}
