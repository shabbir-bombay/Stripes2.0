import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import type { Role } from "@/lib/types";
import { sessionUser } from "@/lib/server/auth";
import { MeProvider } from "./me";
import { InboxProvider, NotificationBanner } from "./notifications";
import { RoleNav } from "./RoleNav";
import { SignOutButton } from "./SignOutButton";
import { TabBar } from "./TabBar";

/**
 * The frame of every signed-in page. Anyone else goes to sign-in.
 * Students and drivers get a tab bar at the bottom (Sign out is on Profile, or on the driver's off-shift screen).
 * Admins keep the header and the menu under it.
 */
export async function RoleLayout({ role, children }: { role: Role; children: ReactNode }) {
  const user = await sessionUser();
  if (!user || user.suspended || user.role !== role) redirect("/sign-in");

  if (role === "admin") {
    // Nothing writes a notification for an admin, so they have no inbox.
    return (
      <InboxProvider enabled={false}>
        <header className="app-header">
          <span className="app-header-brand">STRIPES</span>
          <span className="app-header-name">{user.name}</span>
          <SignOutButton />
        </header>
        <RoleNav role={role} />
        {children}
      </InboxProvider>
    );
  }

  return (
    <MeProvider name={user.name}>
      <InboxProvider enabled>
        <div className="app-shell">
          <NotificationBanner listHref={`/${role}/notifications`} />
          {children}
          <TabBar role={role} />
        </div>
      </InboxProvider>
    </MeProvider>
  );
}
