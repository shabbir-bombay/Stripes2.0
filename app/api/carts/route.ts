import { requireUser } from "@/lib/server/auth";
import { allCarts } from "@/lib/server/drivers";

export async function GET() {
  const user = await requireUser("driver", "admin");
  if (user instanceof Response) return user;
  return Response.json(await allCarts());
}
