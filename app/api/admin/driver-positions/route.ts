import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { storedPosition } from "@/lib/server/position";
import type { DriverPosition } from "@/lib/types";

/** Every driver on shift with a known position, stale ones too: `position.at` tells the map how old each one is. */
export async function GET() {
  const user = await requireUser("admin");
  if (user instanceof Response) return user;

  const profiles = await db.driverProfile.findMany({
    where: { cartId: { not: null }, positionAt: { not: null } },
    orderBy: { callSign: "asc" },
  });
  const positions: DriverPosition[] = profiles.flatMap((profile) => {
    const position = storedPosition(profile);
    return position ? [{ driverId: profile.userId, callSign: profile.callSign, position }] : [];
  });
  return Response.json(positions);
}
