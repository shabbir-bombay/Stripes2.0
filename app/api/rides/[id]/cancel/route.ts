import { fail, readBody, requireUser } from "@/lib/server/auth";
import { studentRide } from "@/lib/server/rides";
import { transition } from "@/lib/server/transition";

export async function POST(request: Request, ctx: RouteContext<"/api/rides/[id]/cancel">) {
  const user = await requireUser("student");
  if (user instanceof Response) return user;

  const reason = (await readBody(request))?.reason;
  if (reason !== undefined && typeof reason !== "string") return fail(400, "The reason must be text.");

  const ride = await transition((await ctx.params).id, { to: "canceled", by: "student", userId: user.id, reason });
  if (ride instanceof Response) return ride;
  return Response.json(await studentRide(ride.id));
}
