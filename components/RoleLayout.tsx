import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import type { Role } from "@/lib/types";
import { sessionUser } from "@/lib/server/auth";
import { SignOutButton } from "./SignOutButton";

/** Header with the user's name and Sign out, for every page in a role's area. Anyone else goes to sign-in. */
export async function RoleLayout({ role, children }: { role: Role; children: ReactNode }) {
  const user = await sessionUser();
  if (!user || user.suspended || user.role !== role) redirect("/sign-in");

  return (
    <>
      <header className="app-header">
        <span className="app-header-brand">STRIPES</span>
        <span className="app-header-name">{user.name}</span>
        <SignOutButton />
      </header>
      {children}
    </>
  );
}
