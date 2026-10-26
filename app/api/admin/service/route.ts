import { fail, readBody, requireUser } from "@/lib/server/auth";
import { SERVICE_MODES, setServiceMode } from "@/lib/server/service";
import type { ServiceMode } from "@/lib/types";

export async function PUT(request: Request) {
  const user = await requireUser("admin");
  if (user instanceof Response) return user;

  const mode = (await readBody(request))?.mode;
  if (!SERVICE_MODES.includes(mode as ServiceMode)) return fail(400, "Mode must be automatic, on or off.");
  return Response.json(await setServiceMode(mode as ServiceMode));
}
