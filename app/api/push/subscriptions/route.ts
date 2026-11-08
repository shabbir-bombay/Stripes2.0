import { fail, readBody, requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { parseSubscription } from "@/lib/server/push-rules";

/** Turns on alerts for this browser. A browser someone else had signed in on moves to this account. */
export async function POST(request: Request) {
  const user = await requireUser("student", "driver");
  if (user instanceof Response) return user;
  const parsed = parseSubscription(await readBody(request));
  if (!parsed.ok) return fail(400, parsed.error);
  const { endpoint, keys } = parsed.value;
  await db.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth },
    create: { userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
  });
  return new Response(null, { status: 204 });
}

/** Turns off alerts for this browser, e.g. before signing out. Only your own. */
export async function DELETE(request: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const { endpoint } = (await readBody(request)) ?? {};
  if (typeof endpoint !== "string") return fail(400, "That isn't a browser push subscription.");
  await db.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
  return new Response(null, { status: 204 });
}
