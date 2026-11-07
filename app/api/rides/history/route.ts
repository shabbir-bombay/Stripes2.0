import { fail, requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { FINAL } from "@/lib/server/ride-status";
import { isUuid, rideInclude, toRide } from "@/lib/server/rides";
import type { HistoryPage } from "@/lib/types";

const PAGE = 20;

/** The student's finished rides, newest first. Asks for one extra to learn whether another page exists. */
export async function GET(request: Request) {
  const user = await requireUser("student");
  if (user instanceof Response) return user;

  const cursor = new URL(request.url).searchParams.get("cursor");
  if (cursor && !isUuid(cursor)) return fail(400, "That page doesn't exist.");

  const rows = await db.ride.findMany({
    where: { studentId: user.id, status: { in: FINAL } },
    include: rideInclude,
    orderBy: [{ requestedAt: "desc" }, { id: "desc" }],
    take: PAGE + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  });
  const page: HistoryPage = {
    rides: rows.slice(0, PAGE).map((row) => toRide(row)),
    nextCursor: rows.length > PAGE ? rows[PAGE - 1].id : null,
  };
  return Response.json(page);
}
