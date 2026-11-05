import { fail, readBody, requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { parsePositionReport } from "@/lib/server/position";

/** Saves where the driver's phone says the cart is. */
export async function POST(request: Request) {
  const user = await requireUser("driver");
  if (user instanceof Response) return user;

  const report = parsePositionReport(await readBody(request));
  if (!report.ok) return fail(400, report.error);

  const { lat, lng, at } = report;
  // One conditional update, so a report still in flight when the shift ends can't put the position back,
  // and one that arrives late can't move the cart backwards.
  const { count } = await db.driverProfile.updateMany({
    where: { userId: user.id, cartId: { not: null }, OR: [{ positionAt: null }, { positionAt: { lt: at } }] },
    data: { lat, lng, positionAt: at },
  });
  if (count === 0) {
    const profile = await db.driverProfile.findUnique({ where: { userId: user.id }, select: { cartId: true } });
    if (!profile?.cartId) return fail(409, "Start a shift to share your location.");
    // On shift, so a newer position is already saved: nothing to do.
  }
  return new Response(null, { status: 204 });
}
