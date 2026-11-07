"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/types";

const LINKS: Record<Role, { href: string; label: string }[]> = {
  student: [{ href: "/student", label: "Ride" }],
  driver: [{ href: "/driver", label: "Shift" }],
  admin: [
    { href: "/admin", label: "Board" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/carts", label: "Carts" },
    { href: "/admin/hours", label: "Hours" },
  ],
};

/** The pages of a role's area. A role with one page needs no menu. */
export function RoleNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const links = LINKS[role];
  if (links.length < 2) return null;

  return (
    <nav className="role-nav" aria-label="Main">
      {links.map(({ href, label }) => (
        <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
