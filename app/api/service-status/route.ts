import { serviceStatus } from "@/lib/server/service";

// Public, so the landing page can say whether Stripes is running before anyone signs in.
export async function GET() {
  return Response.json(await serviceStatus());
}
