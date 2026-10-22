"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { timeAgo } from "@/lib/dates";
import { deleteNotification, markAsRead, type AppNotification } from "@/lib/notifications";
import { notificationStyle } from "./styles";

export function NotificationCard({
  notification,
  onError,
}: {
  notification: AppNotification;
  onError: (message: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const style = notificationStyle(notification.type);
  const unread = !notification.read;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      console.error(error);
      onError("L'action n'a pas pu être effectuée. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  function open() {
    const link = notification.link;
    if (!link) return;
    run(async () => {
      if (unread) await markAsRead(notification.id);
      router.push(link);
    });
  }

  return (
    <article
      className={`group bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden flex flex-col sm:flex-row gap-space-md items-start ${
        unread ? "" : "opacity-90 hover:opacity-100"
      }`}
    >
      {unread && <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl ${style.bar}`} />}
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
          unread ? style.iconBox : "bg-surface-container text-on-surface-variant"
        }`}
      >
        <Icon name={style.icon} filled={unread} className="text-[26px]" />
      </div>

      <div className="flex-1 min-w-0 w-full">
        <div className="flex items-start justify-between gap-space-sm">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">{notification.title}</h3>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-label-sm text-label-sm ${style.badge}`}>
                {style.label}
              </span>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1 leading-relaxed whitespace-pre-line">
              {notification.body}
            </p>
          </div>
          {unread && <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${style.dot}`} title="Non lue" />}
        </div>

        <div
          className={`mt-space-md flex flex-wrap items-center justify-between gap-space-sm rounded-xl ${
            unread ? "bg-surface-container-low/40 p-space-sm" : ""
          }`}
        >
          <span className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
            <Icon name="schedule" className="text-[16px]" />
            {timeAgo(notification.showAt)}
          </span>
          <div className="flex items-center gap-2">
            {notification.link && (
              <button
                type="button"
                onClick={open}
                disabled={busy}
                className={`px-space-md py-1.5 rounded-full font-label-md text-label-md transition-colors shadow-sm flex items-center gap-1 disabled:opacity-60 ${style.button}`}
              >
                <Icon name="open_in_new" className="text-[16px]" />
                {notification.actionLabel ?? "Voir"}
              </button>
            )}
            {unread && (
              <button
                type="button"
                onClick={() => run(() => markAsRead(notification.id))}
                disabled={busy}
                className="px-space-sm py-1.5 rounded-full font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface transition-colors"
              >
                Marquer lu
              </button>
            )}
            <button
              type="button"
              onClick={() => run(() => deleteNotification(notification.id))}
              disabled={busy}
              aria-label="Supprimer la notification"
              title="Supprimer"
              className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:text-error hover:bg-error-container/40 transition-colors"
            >
              <Icon name="delete" className="text-[18px]" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
