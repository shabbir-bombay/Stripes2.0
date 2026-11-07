import { fail, readBody, requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { parseReason, penaltyInclude, toPenaltyPoint } from "@/lib/server/penalty";
import { isUniqueViolation, isUuid } from "@/lib/server/rides";

/** Asks for a point on a ride this driver holds or drove. It stays hidden from the student until an admin approves it. */
export async function POST(request: Request, ctx: RouteContext<"/api/driver/rides/[id]/penalty-point">) {
  const user = await requireUser("driver");
  if (user instanceof Response) return user;

  const { id } = await ctx.params;
  const ride = isUuid(id) ? await db.ride.findUnique({ where: { id } }) : null;
  if (!ride || ride.driverId !== user.id) return fail(404, "No such ride.");

  const parsed = parseReason((await readBody(request))?.reason);
  if (!parsed.ok) return fail(400, parsed.error);

  try {
    const row = await db.penaltyPoint.create({
      data: { studentId: ride.studentId, rideId: id, reason: parsed.reason, requestedById: user.id },
      include: penaltyInclude,
    });
    return Response.json(toPenaltyPoint(row, "staff"), { status: 201 });
  } catch (error) {
    // One live point per ride (partial unique index). A rejected one may be asked for again.
    if (isUniqueViolation(error)) return fail(409, "A penalty point has already been requested for this ride.");
    throw error;
  }
}
