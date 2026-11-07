"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useInbox } from "./notifications";
import { usePolling } from "./usePolling";
import type { PenaltyPoint, Role } from "@/lib/types";

const NOTIFICATIONS = "Notifications";
const PENALTY_POINTS = "Penalty points";

const LINKS: Record<Role, { href: string; label: string }[]> = {
  student: [
    { href: "/student", label: "Ride" },
    { href: "/student/history", label: "History" },
    { href: "/student/notifications", label: NOTIFICATIONS },
    { href: "/student/profile", label: "Profile" },
  ],
  driver: [
    { href: "/driver", label: "Shift" },
    { href: "/driver/notifications", label: NOTIFICATIONS },
  ],
  admin: [
    { href: "/admin", label: "Board" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/carts", label: "Carts" },
    { href: "/admin/hours", label: "Hours" },
    { href: "/admin/penalty-points", label: PENALTY_POINTS },
  ],
};

/** The pages of a role's area, with a count on anything waiting for this person. */
export function RoleNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const { unread } = useInbox();
  const { data: pending } = usePolling<PenaltyPoint[]>(role === "admin" ? "/api/admin/penalty-points?status=pending" : null, 15_000);
  const links = LINKS[role];
  // The most specific match, so /student/ride still lights up Ride and /student/history lights up History.
  const current = links.filter(({ href }) => pathname === href || pathname.startsWith(`${href}/`)).at(-1)?.href;
  const counts: Record<string, number> = { [NOTIFICATIONS]: unread, [PENALTY_POINTS]: pending?.length ?? 0 };

  return (
    <nav className="role-nav" aria-label="Main">
      {links.map(({ href, label }) => (
        <Link key={href} href={href} aria-current={href === current ? "page" : undefined}>
          {label}
          {counts[label] > 0 && <span className="nav-count" aria-label={`${counts[label]} new`}>{counts[label]}</span>}
        </Link>
      ))}
    </nav>
  );
}
