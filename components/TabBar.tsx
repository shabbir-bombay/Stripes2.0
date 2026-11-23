"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";
import { useInbox } from "./notifications";

type Tab = { href: string; label: string; icon: IconName; alerts?: true };

const TABS: Record<"student" | "driver", Tab[]> = {
  student: [
    { href: "/student", label: "Ride", icon: "ride" },
    { href: "/student/history", label: "History", icon: "history" },
    { href: "/student/notifications", label: "Alerts", icon: "bell", alerts: true },
    { href: "/student/profile", label: "Profile", icon: "user" },
  ],
  driver: [
    { href: "/driver", label: "Shift", icon: "ride" },
    { href: "/driver/notifications", label: "Alerts", icon: "bell", alerts: true },
  ],
};

/** The bottom tab bar for students and drivers, with the count of unread alerts on its tab. */
export function TabBar({ role }: { role: "student" | "driver" }) {
  const pathname = usePathname();
  const { unread } = useInbox();
  const tabs = TABS[role];
  // The most specific match, so /student/ride and /student/request still light up Ride.
  const current = tabs.filter(({ href }) => pathname === href || pathname.startsWith(`${href}/`)).at(-1)?.href;

  return (
    <nav className="tabbar" aria-label="Main">
      <div className="tabbar-inner">
        {tabs.map(({ href, label, icon, alerts }) => (
          <Link
            key={href}
            href={href}
            className="tab"
            aria-current={href === current ? "page" : undefined}
            aria-label={alerts && unread > 0 ? `${label}, ${unread} unread` : undefined}
          >
            <Icon name={icon} />
            {label}
            {alerts && unread > 0 && (
              <span className="badge num" aria-hidden="true">
                {unread}
              </span>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}
