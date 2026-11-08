import { sendNotification, setVapidDetails } from "web-push";
import type { Role } from "../types";
import { db } from "./db";
import { isGone, PUSH_MAX_AGE_MS, pushPayload } from "./push-rules";

// Push alerts. Every Notification row is also sent to the person's phones and browsers that turned alerts on.
// A sender loop in the server process picks up new rows every 2 seconds, so the routes that write notifications don't
// change and only committed rows are ever sent. Needs VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT (a URL or
// mailto: the push services can contact); without them, alerts are off and nothing here runs.

export const pushPublicKey = () => (process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT ? (process.env.VAPID_PUBLIC_KEY ?? null) : null);

let started = false;

/** Starts the sender loop once per server process. Called from instrumentation.ts. */
export function startPushSender(everyMs = 2000) {
  const publicKey = pushPublicKey();
  if (started || !publicKey) return;
  started = true;
  setVapidDetails(process.env.VAPID_SUBJECT!, publicKey, process.env.VAPID_PRIVATE_KEY!);
  console.log("Push alerts are on.");
  let busy = false;
  setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      await sendPending();
    } catch (error) {
      console.error("Push sender:", error);
    } finally {
      busy = false;
    }
  }, everyMs).unref();
}

type Taken = { id: string; userId: string; text: string; rideId: string | null; role: Role; fresh: boolean };

/**
 * Takes up to 50 unsent notices and sends the ones still worth an alert. SKIP LOCKED means two servers would never
 * send the same one. Times are compared in SQL, in UTC, which is how Prisma stores them.
 */
export async function sendPending() {
  const taken = await db.$queryRaw<Taken[]>`
    WITH taken AS (
      UPDATE "Notification" SET "pushedAt" = now() AT TIME ZONE 'UTC'
      WHERE id IN (SELECT id FROM "Notification" WHERE "pushedAt" IS NULL ORDER BY "createdAt" LIMIT 50 FOR UPDATE SKIP LOCKED)
      RETURNING id, "userId", text, "rideId", "createdAt"
    )
    SELECT taken.id, taken."userId", taken.text, taken."rideId", "User".role::text AS role,
           taken."createdAt" > now() AT TIME ZONE 'UTC' - make_interval(secs => ${PUSH_MAX_AGE_MS / 1000}) AS fresh
    FROM taken JOIN "User" ON "User".id = taken."userId"`;
  const fresh = taken.filter((notice) => notice.fresh);
  if (fresh.length === 0) return;

  const subscriptions = await db.pushSubscription.findMany({ where: { userId: { in: [...new Set(fresh.map((notice) => notice.userId))] } } });
  await Promise.all(
    fresh.flatMap((notice) =>
      subscriptions.filter((sub) => sub.userId === notice.userId).map((sub) => send(sub, pushPayload(notice))),
    ),
  );
}

async function send(sub: { id: string; endpoint: string; p256dh: string; auth: string }, payload: string) {
  try {
    await sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 300, urgency: "high" });
  } catch (error) {
    if (isGone((error as { statusCode?: number }).statusCode)) await db.pushSubscription.deleteMany({ where: { id: sub.id } });
    else console.error(`Push to ${new URL(sub.endpoint).host} failed:`, (error as Error).message);
  }
}
