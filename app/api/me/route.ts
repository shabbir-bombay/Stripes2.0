import { parseName } from "@/lib/server/accounts";
import { fail, readBody, requireUser, toMe } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

export async function GET() {
  const user = await requireUser();
  if (user instanceof Response) return user;
  return Response.json(toMe(user));
}

export async function PATCH(request: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;

  const name = parseName((await readBody(request))?.name);
  if (!name.ok) return fail(400, name.error);
  return Response.json(toMe(await db.user.update({ where: { id: user.id }, data: { name: name.value } })));
}
