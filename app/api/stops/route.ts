import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import type { Stop } from "@/lib/types";

export async function GET() {
  const user = await requireUser();
  if (user instanceof Response) return user;

  const stops: Stop[] = await db.stop.findMany({
    where: { active: true },
    select: { id: true, name: true, lat: true, lng: true },
    orderBy: { name: "asc" },
  });
  return Response.json(stops);
}
