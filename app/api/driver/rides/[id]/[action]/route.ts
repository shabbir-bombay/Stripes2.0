import { fail, readBody, requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { DRIVER_ACTIONS } from "@/lib/server/ride-status";
import { isUuid, staffRide } from "@/lib/server/rides";
import { transition } from "@/lib/server/transition";

/** claim, en-route, arrived, start, complete, no-show and cancel: one move each, through transition(). */
export async function POST(request: Request, ctx: RouteContext<"/api/driver/rides/[id]/[action]">) {
  const user = await requireUser("driver");
  if (user instanceof Response) return user;

  const { id, action } = await ctx.params;
  if (!Object.hasOwn(DRIVER_ACTIONS, action)) return fail(404, "No such action.");
  const to = DRIVER_ACTIONS[action];

  const reason = (await readBody(request))?.reason;
  if (reason !== undefined && typeof reason !== "string") return fail(400, "The reason must be text.");

  if (to === "assigned") {
    const [profile, ride] = await Promise.all([
      db.driverProfile.findUnique({ where: { userId: user.id }, include: { cart: true } }),
      isUuid(id) ? db.ride.findUnique({ where: { id } }) : null,
    ]);
    if (!profile?.cart) return fail(409, "Start a shift before claiming rides.");
    // The driver's seat is one of the cart's seats.
    if (ride && ride.partySize > profile.cart.seats - 1) {
      return fail(409, `This party of ${ride.partySize} doesn't fit in Cart ${profile.cart.number}.`);
    }
  }

  // A claim that loses the race gets 409 from transition(): the ride is no longer requested.
  const ride = await transition(id, { to, by: "driver", userId: user.id, driverId: user.id, reason });
  if (ride instanceof Response) return ride;
  return Response.json(await staffRide(ride.id));
}
