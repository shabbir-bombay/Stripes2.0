import { fail, readBody, requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { isUuid } from "@/lib/server/rides";
import { parseServiceRule } from "@/lib/server/schedule";

const NOT_FOUND = "That rule no longer exists.";

export async function PUT(request: Request, { params }: RouteContext<"/api/admin/service-rules/[id]">) {
  const user = await requireUser("admin");
  if (user instanceof Response) return user;

  const { id } = await params;
  if (!isUuid(id)) return fail(404, NOT_FOUND);
  const parsed = parseServiceRule(await readBody(request));
  if (!parsed.ok) return fail(400, parsed.error);

  const { count } = await db.serviceRule.updateMany({ where: { id }, data: parsed.rule });
  if (count === 0) return fail(404, NOT_FOUND);
  return Response.json({ id, ...parsed.rule });
}

export async function DELETE(_request: Request, { params }: RouteContext<"/api/admin/service-rules/[id]">) {
  const user = await requireUser("admin");
  if (user instanceof Response) return user;

  const { id } = await params;
  if (!isUuid(id)) return fail(404, NOT_FOUND);
  const { count } = await db.serviceRule.deleteMany({ where: { id } });
  if (count === 0) return fail(404, NOT_FOUND);
  return new Response(null, { status: 204 });
}
