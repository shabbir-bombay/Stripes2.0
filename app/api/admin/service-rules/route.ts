import { fail, readBody, requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { parseServiceRule } from "@/lib/server/schedule";

/** The weekly hours, Sunday first. */
export async function GET() {
  const user = await requireUser("admin");
  if (user instanceof Response) return user;

  return Response.json(await db.serviceRule.findMany({ orderBy: [{ day: "asc" }, { start: "asc" }, { end: "asc" }] }));
}

export async function POST(request: Request) {
  const user = await requireUser("admin");
  if (user instanceof Response) return user;

  const parsed = parseServiceRule(await readBody(request));
  if (!parsed.ok) return fail(400, parsed.error);
  return Response.json(await db.serviceRule.create({ data: parsed.rule }), { status: 201 });
}
