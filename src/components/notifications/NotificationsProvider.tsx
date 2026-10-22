"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  markAllAsRead,
  subscribeToNotifications,
  visibleNotifications,
  type AppNotification,
} from "@/lib/notifications";
import { resolvePrefs } from "@/lib/users";

type NotificationsState = {
  /** Notifications à afficher (rappels futurs et types désactivés exclus). */
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  error: string;
  markAllRead: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsState | null>(null);

type Snapshot = { uid: string; items: AppNotification[]; error: string; receivedAt: number };

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!user) return;
    return subscribeToNotifications(
      user.uid,
      (items) => setSnapshot({ uid: user.uid, items, error: "", receivedAt: Date.now() }),
      (error) => {
        console.error("Lecture des notifications impossible :", error);
        setSnapshot({
          uid: user.uid,
          items: [],
          error: "Impossible de charger vos notifications.",
          receivedAt: Date.now(),
        });
      },
    );
  }, [user]);

  // Fait apparaître les rappels programmés quand leur heure arrive.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const value = useMemo<NotificationsState>(() => {
    const current = user && snapshot?.uid === user.uid ? snapshot : null;
    const notifications = visibleNotifications(
      current?.items ?? [],
      resolvePrefs(profile?.notificationPrefs),
      Math.max(now, current?.receivedAt ?? 0),
    );
    const unread = notifications.filter((n) => !n.read);
    return {
      notifications,
      unreadCount: unread.length,
      loading: Boolean(user) && !current,
      error: current?.error ?? "",
      markAllRead: () => markAllAsRead(unread.map((n) => n.id)),
    };
  }, [user, profile, snapshot, now]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsState {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error("useNotifications doit être utilisé dans <NotificationsProvider>.");
  return context;
}
