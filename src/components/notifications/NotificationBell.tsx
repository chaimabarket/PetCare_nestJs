"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { timeAgo } from "@/lib/dates";
import { markAsRead, type AppNotification } from "@/lib/notifications";
import { useNotifications } from "./NotificationsProvider";
import { notificationStyle } from "./styles";

const PREVIEW_COUNT = 5;

/** Cloche de la barre de navigation avec le volet rapide des dernières notifications. */
export function NotificationBell() {
  const router = useRouter();
  const { notifications, unreadCount, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const preview = notifications.slice(0, PREVIEW_COUNT);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function openNotification(notification: AppNotification) {
    setOpen(false);
    if (!notification.read) await markAsRead(notification.id).catch(console.error);
    router.push(notification.link ?? "/notifications");
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unreadCount ? `Notifications (${unreadCount} non lues)` : "Notifications"}
        aria-expanded={open}
        className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors relative"
      >
        <Icon name="notifications" filled={open} className="text-[22px]" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-secondary text-on-secondary font-label-sm text-[10px] leading-4 text-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed sm:absolute top-16 sm:top-12 right-4 sm:right-0 z-50 w-96 max-w-[calc(100vw-2rem)]">
          <div className="bg-surface-container-lowest rounded-2xl shadow-xl overflow-hidden">
            <div className="p-space-md flex items-center justify-between bg-surface-container-low/60">
              <div className="flex items-center gap-space-xs">
                <span className="font-headline-sm text-headline-sm text-on-surface">Notifications</span>
                {unreadCount > 0 && (
                  <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full font-label-sm text-label-sm bg-secondary text-on-secondary">
                    {unreadCount}
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllRead().catch(console.error)}
                  className="font-label-sm text-label-sm text-primary hover:text-primary-container transition-colors flex items-center gap-1"
                >
                  <Icon name="done_all" className="text-[16px]" />
                  Tout marquer lu
                </button>
              )}
            </div>

            {preview.length === 0 ? (
              <div className="p-space-xl flex flex-col items-center gap-space-xs text-center">
                <Icon name="notifications_off" className="text-[32px] text-outline" />
                <p className="font-body-md text-body-md text-on-surface-variant">Aucune notification pour le moment.</p>
              </div>
            ) : (
              <ul className="divide-y divide-surface-container-high/40 max-h-80 overflow-y-auto">
                {preview.map((n) => {
                  const style = notificationStyle(n.type);
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => openNotification(n)}
                        className={`w-full text-left p-space-md flex gap-space-sm hover:bg-surface-container-low transition-colors ${
                          n.read ? "" : style.tint
                        }`}
                      >
                        <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${style.iconBox}`}>
                          <Icon name={style.icon} filled className="text-[20px]" />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center justify-between gap-2">
                            <span className={`font-label-md text-label-md text-on-surface truncate ${n.read ? "font-medium" : ""}`}>
                              {n.title}
                            </span>
                            {!n.read && <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />}
                          </span>
                          <span className="block font-body-sm text-body-sm text-on-surface-variant truncate mt-0.5">{n.body}</span>
                          <span className="block font-label-sm text-label-sm text-outline mt-1">{timeAgo(n.showAt)}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="p-space-sm bg-surface-container-lowest text-center">
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="w-full py-2 px-space-md rounded-xl font-label-md text-label-md text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-1"
              >
                Voir toutes les notifications
                <Icon name="arrow_forward" className="text-[16px]" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
