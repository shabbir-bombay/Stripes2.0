// Container hosts and load balancers call this to check that the app is up.
export function GET() {
  return Response.json({ status: "ok" });
}
