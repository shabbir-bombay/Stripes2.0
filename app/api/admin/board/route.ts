import { requireUser } from "@/lib/server/auth";
import { boardDrivers } from "@/lib/server/drivers";
import { serviceStatus } from "@/lib/server/service";
import { waitingRides } from "@/lib/server/rides";
import type { AdminBoard } from "@/lib/types";

export async function GET() {
  const user = await requireUser("admin");
  if (user instanceof Response) return user;

  const [service, waiting, drivers] = await Promise.all([serviceStatus(), waitingRides(), boardDrivers()]);
  const board: AdminBoard = { service, waiting, drivers };
  return Response.json(board);
}
