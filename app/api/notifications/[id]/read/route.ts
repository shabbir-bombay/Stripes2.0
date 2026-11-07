import { fail, requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { isUuid } from "@/lib/server/rides";

/** Marks one of the user's own notifications as read. Doing it twice changes nothing. */
export async function POST(_request: Request, ctx: RouteContext<"/api/notifications/[id]/read">) {
  const user = await requireUser();
  if (user instanceof Response) return user;

  const { id } = await ctx.params;
  const { count } = isUuid(id) ? await db.notification.updateMany({ where: { id, userId: user.id }, data: { read: true } }) : { count: 0 };
  if (count === 0) return fail(404, "No such notification.");
  return new Response(null, { status: 204 });
}
