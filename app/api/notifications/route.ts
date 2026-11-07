import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import type { Notification } from "@/lib/types";

const LIMIT = 50;

export async function GET() {
  const user = await requireUser();
  if (user instanceof Response) return user;

  const rows = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: LIMIT,
  });
  return Response.json(
    rows.map(({ id, type, text, rideId, read, createdAt }): Notification => ({ id, type, text, rideId, read, createdAt: createdAt.toISOString() })),
  );
}
