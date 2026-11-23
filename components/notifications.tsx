"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { api } from "./api";
import { Button } from "./Button";
import { PushToggle } from "./PushToggle";
import { Icon } from "./Icon";
import { campusDateTime } from "./time";
import { usePolling } from "./usePolling";
import type { Notification } from "@/lib/types";

type Inbox = {
  /** Newest first. Undefined until the first load. */
  notifications?: Notification[];
  unread: number;
  error?: string;
  markRead: (ids: string[]) => Promise<void>;
};

const InboxContext = createContext<Inbox>({ unread: 0, markRead: async () => {} });

export const useInbox = () => useContext(InboxContext);

/** One poll for the whole page, shared by the menu's count, the banner and the list. Admins get no notifications, so they don't poll. */
export function InboxProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const { data, error, refresh } = usePolling<Notification[]>(enabled ? "/api/notifications" : null, 10_000);
  // Marked read here but not yet in a poll, so nothing flickers back as unread in between.
  const [justRead, setJustRead] = useState<ReadonlySet<string>>(new Set());

  const markRead = useCallback(
    async (ids: string[]) => {
      setJustRead((current) => new Set([...current, ...ids]));
      try {
        await Promise.all(ids.map((id) => api(`/api/notifications/${id}/read`, "POST")));
      } catch (e) {
        setJustRead((current) => new Set([...current].filter((id) => !ids.includes(id))));
        throw e;
      }
      await refresh();
    },
    [refresh],
  );

  const value = useMemo<Inbox>(() => {
    const notifications = data?.map((note) => (justRead.has(note.id) ? { ...note, read: true } : note));
    return { notifications, unread: notifications?.filter((note) => !note.read).length ?? 0, error, markRead };
  }, [data, justRead, error, markRead]);

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

/** The newest unread notice, floating at the top of every page but the list itself and the student's ride page (its status already says it). */
export function NotificationBanner({ listHref }: { listHref: string }) {
  const { notifications, unread, markRead } = useInbox();
  const pathname = usePathname();
  const [error, setError] = useState<string>();
  const newest = notifications?.find((note) => !note.read);
  if (!newest || pathname === listHref || pathname === "/student/ride") return null;

  async function dismiss() {
    setError(undefined);
    try {
      await markRead([newest!.id]);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div role="status" className="toast">
      <p>{newest.text}</p>
      {error && <p className="field-error">{error}</p>}
      <div className="toast-actions">
        {unread > 1 && <Link href={listHref}>See all {unread}</Link>}
        <Button variant="quiet" className="accent" onClick={dismiss}>Dismiss</Button>
      </div>
    </div>
  );
}

const EMPTY = {
  student: "You'll get one when a driver has your ride, when your cart arrives, or if your ride is canceled.",
  driver: "You'll get one when an admin assigns you a ride or a ride you hold is canceled.",
};

const PUSH_OFF = {
  student: "Get these on your lock screen",
  driver: "Hear about assigned and canceled rides even when the screen is off",
};

/** The full list, for `/student/notifications` and `/driver/notifications`. Tapping an unread notice marks it read. */
export function NotificationList({ role }: { role: "student" | "driver" }) {
  const { notifications, unread, error, markRead } = useInbox();
  const [actionError, setActionError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function mark(ids: string[]) {
    setBusy(true);
    setActionError(undefined);
    try {
      await markRead(ids);
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page stack">
      <div className="title-row">
        <h1 className="page-title">Alerts</h1>
        {unread > 0 && (
          <Button variant="quiet" className="accent" disabled={busy} onClick={() => mark(notifications!.filter((note) => !note.read).map((note) => note.id))}>
            Mark all read
          </Button>
        )}
      </div>
      <PushToggle offText={PUSH_OFF[role]} />
      {(actionError ?? error) && <p role="alert" className="form-error">{actionError ?? error}</p>}
      {!notifications && !error && <p role="status">Loading alerts…</p>}
      {notifications?.length === 0 && (
        <div className="empty-state">
          <Icon name="bell" />
          <h2>No alerts yet</h2>
          <p className="sub">{EMPTY[role]}</p>
        </div>
      )}
      {notifications && notifications.length > 0 && (
        <ul className="list">
          {notifications.map((note) => {
            const body = (
              <>
                <span className={note.read ? undefined : "unread-dot"} aria-hidden="true" />
                <span>
                  <span className="list-item-title">{note.text}</span>
                  <span className="list-item-meta num">{campusDateTime(note.createdAt)}</span>
                </span>
              </>
            );
            return (
              <li key={note.id}>
                {note.read ? (
                  <div className="list-item note read">{body}</div>
                ) : (
                  <button type="button" className="list-item note" disabled={busy} onClick={() => mark([note.id])}>
                    {body}
                    <span className="sr-only">Unread. Tap to mark as read.</span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
