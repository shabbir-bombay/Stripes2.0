import { requireUser } from "@/lib/server/auth";
import { pushPublicKey } from "@/lib/server/push";
import type { PushKey } from "@/lib/types";

/** The key a browser needs to turn on alerts, or null when alerts aren't set up on this server. */
export async function GET() {
  const user = await requireUser();
  if (user instanceof Response) return user;
  return Response.json({ publicKey: pushPublicKey() } satisfies PushKey);
}
