import { ROLES } from "@/lib/server/accounts";
import { fail, requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { toUser, userInclude } from "@/lib/server/users";
import type { Role } from "@/lib/types";

const LIMIT = 100;

/** Accounts by name, up to 100. `role` filters; `q` searches name, email and call sign. */
export async function GET(request: Request) {
  const user = await requireUser("admin");
  if (user instanceof Response) return user;

  const params = new URL(request.url).searchParams;
  const role = params.get("role") || undefined;
  if (role && !ROLES.includes(role as Role)) return fail(400, "Role must be student, driver or admin.");
  const q = params.get("q")?.trim();

  const rows = await db.user.findMany({
    where: {
      ...(role && { role: role as Role }),
      ...(q && {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { driver: { callSign: { contains: q, mode: "insensitive" } } },
        ],
      }),
    },
    include: userInclude,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: LIMIT,
  });
  return Response.json(rows.map(toUser));
}
