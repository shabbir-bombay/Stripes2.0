import { fail, requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { penaltyNotice } from "@/lib/server/notifications";
import { PENALTY_DECISIONS, penaltyInclude, toPenaltyPoint } from "@/lib/server/penalty";
import { isUuid } from "@/lib/server/rides";

/** approve and reject. Approving makes the point count and tells the student; rejecting leaves them none the wiser. */
export async function POST(_request: Request, ctx: RouteContext<"/api/admin/penalty-points/[id]/[action]">) {
  const user = await requireUser("admin");
  if (user instanceof Response) return user;

  const { id, action } = await ctx.params;
  if (!Object.hasOwn(PENALTY_DECISIONS, action)) return fail(404, "No such action.");
  const status = PENALTY_DECISIONS[action];

  const point = isUuid(id) ? await db.penaltyPoint.findUnique({ where: { id } }) : null;
  if (!point) return fail(404, "No such penalty point.");

  return db.$transaction(async (tx) => {
    // Only while still pending, so when two admins decide at once the second gets 409.
    const { count } = await tx.penaltyPoint.updateMany({
      where: { id, status: "pending" },
      data: { status, decidedById: user.id, decidedAt: new Date() },
    });
    if (count === 0) return fail(409, "This request has already been decided.");
    if (status === "approved") await tx.notification.create({ data: { ...penaltyNotice(point.studentId, point.reason), rideId: point.rideId } });
    const row = await tx.penaltyPoint.findUniqueOrThrow({ where: { id }, include: penaltyInclude });
    return Response.json(toPenaltyPoint(row, "staff"));
  });
}
