import { fail } from "./auth";
import { db } from "./db";
import type { Ride } from "./generated/prisma/client";
import { planMove, type MoveRequest } from "./ride-status";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Moves a ride to a new status. This is the only code that writes Ride.status.
 * `userId` is who acts: a student may only touch their own ride, and a driver only a ride they hold
 * (or, to claim it, a ride nobody holds). Anything else is 404.
 * Returns the updated ride, or the error response to send instead.
 *
 *   const ride = await transition(id, { to: "canceled", by: "student", userId: user.id });
 *   if (ride instanceof Response) return ride;
 */
export async function transition(rideId: string, move: MoveRequest & { userId: string }): Promise<Ride | Response> {
  const ride = UUID.test(rideId) ? await db.ride.findUnique({ where: { id: rideId } }) : null;
  if (!ride || !mayTouch(ride, move)) return fail(404, "No such ride.");

  const plan = planMove(ride.status, move);
  if (!plan.ok) return fail(plan.status, plan.error);

  // Only applies if the ride is still as read above, so when two people act at once the second gets 409.
  const { count } = await db.ride.updateMany({
    where: { id: ride.id, status: ride.status, driverId: ride.driverId },
    data: { status: move.to, ...plan.patch },
  });
  if (count === 0) return fail(409, "This ride has changed. Refresh and try again.");
  return db.ride.findUniqueOrThrow({ where: { id: ride.id } });
}

function mayTouch(ride: Ride, { by, to, userId }: MoveRequest & { userId: string }) {
  if (by === "student") return ride.studentId === userId;
  if (by === "driver") return ride.driverId === userId || (to === "assigned" && ride.driverId === null);
  return true;
}
