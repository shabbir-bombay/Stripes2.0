import { fail, readBody, requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { parseFeedback } from "@/lib/server/feedback";
import { isUniqueViolation, isUuid, studentRide } from "@/lib/server/rides";

/** A student's rating of their own completed ride, once. */
export async function POST(request: Request, ctx: RouteContext<"/api/rides/[id]/feedback">) {
  const user = await requireUser("student");
  if (user instanceof Response) return user;

  const { id } = await ctx.params;
  const ride = isUuid(id) ? await db.ride.findUnique({ where: { id } }) : null;
  if (!ride || ride.studentId !== user.id) return fail(404, "No such ride.");

  const parsed = parseFeedback(await readBody(request));
  if (!parsed.ok) return fail(400, parsed.error);
  if (ride.status !== "completed") return fail(409, "You can only rate a completed ride.");

  try {
    await db.feedback.create({ data: { rideId: id, rating: parsed.rating, comment: parsed.comment } });
  } catch (error) {
    if (isUniqueViolation(error)) return fail(409, "You already rated this ride.");
    throw error;
  }
  return Response.json(await studentRide(id));
}
