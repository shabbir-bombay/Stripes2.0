import { NextResponse, type NextRequest } from "next/server";
import { readSessionToken, SESSION_COOKIE } from "./lib/server/session";

// Sends visitors to the right area before a role page renders:
// not signed in → /sign-in; signed in with another role → that role's own home.
// This is a fast first check only. Layouts and endpoints still load the user from the database.
export function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? readSessionToken(token) : null;
  if (!session) return NextResponse.redirect(new URL("/sign-in", request.url));

  const area = request.nextUrl.pathname.split("/")[1];
  if (area !== session.role) return NextResponse.redirect(new URL(`/${session.role}`, request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/student/:path*", "/driver/:path*", "/admin/:path*"],
};
