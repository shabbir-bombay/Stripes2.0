import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { ACTIVE } from "@/lib/server/ride-status";
import { queuePosition, rideInclude, toRide } from "@/lib/server/rides";

/** The student's ride that isn't finished yet, or null. */
export async function GET() {
  const user = await requireUser("student");
  if (user instanceof Response) return user;

  const row = await db.ride.findFirst({ where: { studentId: user.id, status: { in: ACTIVE } }, include: rideInclude });
  return Response.json(row && toRide(row, await queuePosition(row)));
}
