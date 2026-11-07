import { fail } from "./auth";
import { db } from "./db";
import type { Ride } from "./generated/prisma/client";
import { rideNotices } from "./notifications";
import { planMove, type MoveRequest } from "./ride-status";
import { isUuid } from "./rides";

/**
 * Moves a ride to a new status. This is the only code that writes Ride.status.
 * `userId` is who acts: a student may only touch their own ride, and a driver only a ride they hold
 * (or any ride, to claim it: the status check then answers 409 if it is taken). Anything else is 404.
 * Notifications are written in the same database transaction as the move.
 * Returns the updated ride, or the error response to send instead.
 *
 *   const ride = await transition(id, { to: "canceled", by: "student", userId: user.id });
 *   if (ride instanceof Response) return ride;
 */
export async function transition(rideId: string, move: MoveRequest & { userId: string }): Promise<Ride | Response> {
  const ride = isUuid(rideId)
    ? await db.ride.findUnique({ where: { id: rideId }, include: { pickup: { select: { name: true } } } })
    : null;
  if (!ride || !mayTouch(ride, move)) return fail(404, "No such ride.");

  const driver =
    move.to === "assigned" && move.driverId
      ? await db.driverProfile.findUnique({
          where: { userId: move.driverId },
          select: { callSign: true, cart: { select: { number: true } } },
        })
      : null;
  const cartNumber = driver?.cart?.number ?? null;

  const plan = planMove(ride.status, { ...move, cartNumber });
  if (!plan.ok) return fail(plan.status, plan.error);

  const notices = rideNotices(
    { studentId: ride.studentId, driverId: ride.driverId, pickupName: ride.pickup.name },
    {
      to: move.to,
      by: move.by,
      driver: driver ? { id: move.driverId!, callSign: driver.callSign, cartNumber } : undefined,
      reason: plan.patch.cancelReason,
    },
  );

  return db.$transaction(async (tx) => {
    // Only applies if the ride is still as read above, so when two people act at once the second gets 409.
    const { count } = await tx.ride.updateMany({
      where: { id: ride.id, status: ride.status, driverId: ride.driverId },
      data: { status: move.to, ...plan.patch },
    });
    if (count === 0) return fail(409, "This ride has changed. Refresh and try again.");
    if (notices.length > 0) await tx.notification.createMany({ data: notices.map((notice) => ({ ...notice, rideId: ride.id })) });
    return tx.ride.findUniqueOrThrow({ where: { id: ride.id } });
  });
}

function mayTouch(ride: Ride, { by, to, userId }: MoveRequest & { userId: string }) {
  if (by === "student") return ride.studentId === userId;
  // Any driver may try to claim, so a claim on a ride someone else just took gets 409 from the status check, not 404.
  if (by === "driver") return ride.driverId === userId || to === "assigned";
  return true;
}
