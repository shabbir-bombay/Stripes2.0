import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { currentShift } from "@/lib/server/drivers";
import { HELD } from "@/lib/server/ride-status";
import { queueOrder, rideInclude, toStaffRide, waitingRides } from "@/lib/server/rides";
import type { DriverQueue } from "@/lib/types";

export async function GET() {
  const user = await requireUser("driver");
  if (user instanceof Response) return user;

  const [shift, mine] = await Promise.all([
    currentShift(user.id),
    db.ride.findMany({ where: { driverId: user.id, status: { in: HELD } }, include: rideInclude, orderBy: queueOrder }),
  ]);
  const queue: DriverQueue = {
    shift,
    mine: mine.map((row) => toStaffRide(row)),
    waiting: shift ? await waitingRides() : [],
  };
  return Response.json(queue);
}
