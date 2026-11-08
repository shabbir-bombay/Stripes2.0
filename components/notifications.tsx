"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { api } from "./api";
import { Button } from "./Button";
import { PushToggle } from "./PushToggle";
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

/** The newest unread notice, on every page but the list itself. */
export function NotificationBanner({ listHref }: { listHref: string }) {
  const { notifications, unread, markRead } = useInbox();
  const pathname = usePathname();
  const [error, setError] = useState<string>();
  const newest = notifications?.find((note) => !note.read);
  if (!newest || pathname === listHref) return null;

  async function dismiss() {
    setError(undefined);
    try {
      await markRead([newest!.id]);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="page notice-wrap">
      <div role="status" className="banner notice">
        <p>{newest.text}</p>
        {error && <p className="field-error">{error}</p>}
        <div className="notice-actions">
          {unread > 1 && <Link href={listHref}>See all {unread}</Link>}
          <Button variant="secondary" onClick={dismiss}>Dismiss</Button>
        </div>
      </div>
    </div>
  );
}

/** The full list, for `/student/notifications` and `/driver/notifications`. */
export function NotificationList() {
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
      <h1>Notifications</h1>
      <PushToggle />
      {(actionError ?? error) && <p role="alert" className="form-error">{actionError ?? error}</p>}
      {!notifications && !error && <p role="status">Loading notifications…</p>}
      {notifications?.length === 0 && <p className="muted">Nothing yet. Updates about your rides show up here.</p>}
      {unread > 1 && (
        <Button variant="secondary" disabled={busy} onClick={() => mark(notifications!.filter((note) => !note.read).map((note) => note.id))}>
          Mark all as read
        </Button>
      )}
      {notifications?.map((note) => (
        <article key={note.id} className={`card stack note${note.read ? "" : " unread"}`}>
          <p className="note-text">{note.text}</p>
          <p className="field-hint">{campusDateTime(note.createdAt)}{note.read ? "" : " · New"}</p>
          {!note.read && <Button variant="secondary" disabled={busy} onClick={() => mark([note.id])}>Mark as read</Button>}
        </article>
      ))}
    </main>
  );
}
