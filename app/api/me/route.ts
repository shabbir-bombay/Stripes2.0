import { requireUser, toMe } from "@/lib/server/auth";

export async function GET() {
  const user = await requireUser();
  if (user instanceof Response) return user;
  return Response.json(toMe(user));
}
