import { endSession } from "@/lib/server/auth";

export async function POST() {
  await endSession();
  return new Response(null, { status: 204 });
}
