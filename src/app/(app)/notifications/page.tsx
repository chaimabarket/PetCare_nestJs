"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AlertChannelsPanel, AlertSettingsDialog } from "@/components/notifications/AlertSettings";
import { NotificationCard } from "@/components/notifications/NotificationCard";
import { useNotifications } from "@/components/notifications/NotificationsProvider";
import { Alert } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { isToday } from "@/lib/dates";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_TYPES,
  type AppNotification,
  type NotificationCategory,
} from "@/lib/notifications";

type Filter = NotificationCategory | "all";
type Sort = "recent" | "unread";

export default function NotificationsPage() {
  return (
    <RequireAuth>
      <NotificationCenter />
    </RequireAuth>
  );
}

function NotificationCenter() {
  const { notifications, unreadCount, loading, error, markAllRead } = useNotifications();
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");
  const [marking, setMarking] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const countFor = (key: Filter) =>
    key === "all" ? notifications.length : notifications.filter((n) => NOTIFICATION_TYPES[n.type]?.category === key).length;

  const filtered = notifications.filter((n) => filter === "all" || NOTIFICATION_TYPES[n.type]?.category === filter);
  // « Non lues d'abord » regroupe en Non lues / Lues ; sinon, regroupement par date.
  const groups =
    sort === "unread"
      ? [
          { title: "Non lues", highlight: true, items: filtered.filter((n) => !n.read), empty: "Aucune notification non lue." },
          { title: "Lues", highlight: false, items: filtered.filter((n) => n.read), empty: "" },
        ]
      : [
          { title: "Aujourd'hui", highlight: true, items: filtered.filter((n) => isToday(n.showAt)), empty: "" },
          { title: "Plus tôt", highlight: false, items: filtered.filter((n) => !isToday(n.showAt)), empty: "" },
        ];

  async function handleMarkAll() {
    setActionError("");
    setSuccess("");
    if (unreadCount === 0) {
      setSuccess("Toutes vos notifications sont déjà lues.");
      return;
    }
    setMarking(true);
    try {
      const count = unreadCount;
      await markAllRead();
      setSuccess(`${count} notification${count > 1 ? "s" : ""} marquée${count > 1 ? "s" : ""} comme lue${count > 1 ? "s" : ""}.`);
    } catch (err) {
      console.error(err);
      setActionError("Impossible de marquer les notifications comme lues. Réessayez.");
    } finally {
      setMarking(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-margin md:px-margin-md lg:px-margin-lg py-space-xl w-full">
      <nav className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant mb-space-lg">
        <Link href="/" className="hover:text-primary transition-colors flex items-center gap-1">
          <Icon name="home" className="text-[18px]" />
          <span>Accueil</span>
        </Link>
        <Icon name="chevron_right" className="text-[14px] text-outline" />
        <span className="text-on-surface font-medium">Centre de notifications</span>
      </nav>

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-lg pb-space-lg">
        <div className="space-y-space-xs max-w-2xl">
          <div className="flex items-center gap-space-sm flex-wrap">
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">
              Centre de notifications
            </h1>
            {unreadCount > 0 && (
              <span className="px-space-sm py-0.5 rounded-full font-label-sm text-label-sm bg-secondary-fixed text-on-secondary-fixed-variant font-bold">
                {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            Restez informé de vos rendez-vous, rappels de soins, adoptions et alertes de la communauté.
          </p>
        </div>
        <div className="flex items-center gap-space-sm shrink-0">
          <button
            type="button"
            onClick={handleMarkAll}
            disabled={marking}
            className="h-11 px-space-lg rounded-full font-label-lg text-label-lg bg-surface-container-lowest hover:bg-surface-container text-on-surface shadow-sm transition-all flex items-center gap-2 disabled:opacity-60"
          >
            <Icon
              name={marking ? "progress_activity" : "done_all"}
              className={`text-primary text-[20px] ${marking ? "animate-spin" : ""}`}
            />
            <span>Tout marquer comme lu</span>
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            title="Paramètres des alertes"
            aria-label="Paramètres des alertes"
            aria-haspopup="dialog"
            className="h-11 w-11 rounded-full bg-surface-container-lowest hover:bg-surface-container text-on-surface flex items-center justify-center shadow-sm transition-all"
          >
            <Icon name="tune" className="text-[20px]" />
          </button>
        </div>
      </div>

      <div className="mt-space-md mb-space-xl flex flex-col md:flex-row md:items-center justify-between gap-space-md">
        <div className="flex items-center gap-space-xs overflow-x-auto pb-2 md:pb-0" role="tablist" aria-label="Filtrer les notifications">
          {NOTIFICATION_CATEGORIES.map((category) => {
            const active = filter === category.key;
            return (
              <button
                key={category.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(category.key)}
                className={`px-space-md py-2 rounded-full font-label-md text-label-md transition-all shrink-0 inline-flex items-center gap-1.5 ${
                  active ? "bg-primary text-on-primary" : "bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                {category.dot && !active && <span className={`w-2 h-2 rounded-full ${category.dot}`} />}
                {category.label} ({countFor(category.key)})
              </button>
            );
          })}
        </div>
        <label className="flex items-center gap-space-sm self-end md:self-auto">
          <span className="font-label-sm text-label-sm text-outline">Trier par :</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="bg-surface-container-lowest text-on-surface font-label-sm text-label-sm rounded-lg px-2 py-1.5 outline-none cursor-pointer shadow-sm"
          >
            <option value="recent">Plus récentes d&apos;abord</option>
            <option value="unread">Non lues d&apos;abord</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-md items-start">
        <div className="lg:col-span-8 space-y-space-xl">
          {(error || actionError) && <Alert>{error || actionError}</Alert>}
          {success && <Alert tone="success">{success}</Alert>}

          {loading ? (
            <p className="text-center text-on-surface-variant py-space-2xl">Chargement des notifications…</p>
          ) : filtered.length === 0 ? (
            <EmptyState filtered={filter !== "all"} />
          ) : (
            groups.map((group) => (
              <Group
                key={group.title}
                title={group.title}
                highlight={group.highlight}
                items={group.items}
                empty={group.empty}
                onError={setActionError}
              />
            ))
          )}
        </div>

        <aside className="lg:col-span-4 space-y-space-lg">
          <AlertChannelsPanel onOpenSettings={() => setSettingsOpen(true)} />
        </aside>
      </div>
      <AlertSettingsDialog open={settingsOpen} onClose={closeSettings} />
    </div>
  );
}

function Group({
  title,
  items,
  highlight = false,
  empty = "",
  onError,
}: {
  title: string;
  items: AppNotification[];
  highlight?: boolean;
  /** Texte affiché si le groupe est vide (sinon le groupe est masqué). */
  empty?: string;
  onError: (message: string) => void;
}) {
  if (items.length === 0 && !empty) return null;
  const unread = items.filter((n) => !n.read).length;

  return (
    <section className="space-y-space-md">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-space-xs font-label-lg text-label-lg uppercase tracking-wider font-bold text-on-surface">
          {title}
          {highlight && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
        </h2>
        <span className="font-label-sm text-label-sm text-on-surface-variant">
          {unread > 0
            ? `${unread} nouvelle${unread > 1 ? "s" : ""} notification${unread > 1 ? "s" : ""}`
            : `${items.length} notification${items.length > 1 ? "s" : ""}`}
        </span>
      </div>
      {items.length === 0 && (
        <p className="flex items-center gap-space-xs bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm font-body-md text-body-md text-on-surface-variant">
          <Icon name="done_all" className="text-primary text-[20px]" />
          {empty}
        </p>
      )}
      {items.map((n) => (
        <NotificationCard key={n.id} notification={n} onError={onError} />
      ))}
    </section>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl p-space-2xl shadow-sm flex flex-col items-center text-center gap-space-sm">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
        <Icon name="notifications_off" className="text-primary text-[32px]" />
      </div>
      <h2 className="font-headline-sm text-headline-sm text-on-surface">
        {filtered ? "Aucune notification dans cette catégorie" : "Vous êtes à jour !"}
      </h2>
      <p className="font-body-md text-body-md text-on-surface-variant max-w-sm">
        Vos rappels de rendez-vous, réponses aux candidatures et alertes de la communauté apparaîtront ici.
      </p>
    </div>
  );
}
