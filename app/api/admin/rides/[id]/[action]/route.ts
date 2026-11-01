import { fail, readBody, requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { ADMIN_ACTIONS, planAssign } from "@/lib/server/ride-status";
import { isUuid, staffRide } from "@/lib/server/rides";
import { transition } from "@/lib/server/transition";

/** assign (which also reassigns), unassign and cancel, through transition(). */
export async function POST(request: Request, ctx: RouteContext<"/api/admin/rides/[id]/[action]">) {
  const user = await requireUser("admin");
  if (user instanceof Response) return user;

  const { id, action } = await ctx.params;
  if (!Object.hasOwn(ADMIN_ACTIONS, action)) return fail(404, "No such action.");
  const to = ADMIN_ACTIONS[action];
  const body = await readBody(request);
  const by = { by: "admin" as const, userId: user.id };

  if (to === "canceled") {
    const reason = body?.reason;
    if (reason !== undefined && typeof reason !== "string") return fail(400, "The reason must be text.");
    const ride = await transition(id, { to, ...by, reason });
    if (ride instanceof Response) return ride;
    return Response.json(await staffRide(ride.id));
  }

  if (to === "requested") {
    const ride = await transition(id, { to, ...by });
    if (ride instanceof Response) return ride;
    return Response.json(await staffRide(ride.id));
  }

  const driverId = body?.driverId;
  if (!isUuid(driverId)) return fail(400, "Choose a driver.");
  const [ride, profile] = await Promise.all([
    isUuid(id) ? db.ride.findUnique({ where: { id } }) : null,
    db.driverProfile.findUnique({ where: { userId: driverId }, include: { cart: true } }),
  ]);
  if (!ride) return fail(404, "No such ride.");
  if (!profile) return fail(404, "No such driver.");

  const plan = planAssign(ride, { driverId, cart: profile.cart });
  if (!plan.ok) return fail(plan.status, plan.error);
  // A reassign is two moves. If a driver claims the ride between them, the second one gets 409.
  for (const step of plan.steps) {
    const moved = await transition(id, step === "assign" ? { to: "assigned", ...by, driverId } : { to: "requested", ...by });
    if (moved instanceof Response) return moved;
  }
  return Response.json(await staffRide(id));
}
