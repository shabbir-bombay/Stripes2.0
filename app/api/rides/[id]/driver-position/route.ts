import { fail, requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { isFresh, storedPosition, TRACKABLE } from "@/lib/server/position";
import { isUuid } from "@/lib/server/rides";

const NOT_FOUND = "We couldn't find that ride.";

/** Where the student's cart is. Null once the student is on board, or without a fresh position. */
export async function GET(_request: Request, { params }: RouteContext<"/api/rides/[id]/driver-position">) {
  const user = await requireUser("student");
  if (user instanceof Response) return user;

  const { id } = await params;
  if (!isUuid(id)) return fail(404, NOT_FOUND);
  const ride = await db.ride.findFirst({
    where: { id, studentId: user.id },
    select: { status: true, driver: { select: { lat: true, lng: true, positionAt: true } } },
  });
  if (!ride) return fail(404, NOT_FOUND);

  const position = ride.driver && TRACKABLE.includes(ride.status) ? storedPosition(ride.driver) : null;
  return Response.json(position && isFresh(position) ? position : null);
}
