"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Icon } from "@/components/ui/Icon";
import { errorMessage, resolvePrefs, updateNotificationPrefs, type NotificationPrefs } from "@/lib/users";
import { PreferenceToggles } from "./PreferenceToggles";

type Status = { tone: "saving" | "saved" | "error"; text: string } | null;

/** Préférences d'alerte enregistrées automatiquement à chaque changement. */
function useAutoSavedPrefs() {
  const { profile, refreshProfile } = useAuth();
  // Valeur affichée pendant l'enregistrement, avant le retour de Firestore.
  const [pending, setPending] = useState<NotificationPrefs | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const prefs = pending ?? resolvePrefs(profile?.notificationPrefs);

  async function save(next: NotificationPrefs) {
    if (!profile) return;
    setPending(next);
    setStatus({ tone: "saving", text: "Enregistrement…" });
    try {
      await updateNotificationPrefs(profile.uid, next);
      await refreshProfile();
      setStatus({ tone: "saved", text: "Préférences enregistrées" });
    } catch (error) {
      setStatus({ tone: "error", text: errorMessage(error) });
    } finally {
      setPending(null);
    }
  }

  const toggle = (key: keyof NotificationPrefs, value: boolean) => save({ ...prefs, [key]: value });

  return { prefs, save, toggle, status, city: profile?.city, ready: Boolean(profile) };
}

function StatusLine({ status }: { status: Status }) {
  if (!status) return null;
  const styles = {
    saving: "text-on-surface-variant",
    saved: "text-emerald-700",
    error: "text-error",
  }[status.tone];
  const icon = { saving: "progress_activity", saved: "check_circle", error: "error" }[status.tone];
  return (
    <p role="status" className={`flex items-center gap-1 font-body-sm text-body-sm ${styles}`}>
      <Icon name={icon} className={`text-[16px] ${status.tone === "saving" ? "animate-spin" : ""}`} />
      {status.text}
    </p>
  );
}

/** Panneau latéral « Canaux d'alerte » de la page Notifications. */
export function AlertChannelsPanel({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { prefs, toggle, status, city, ready } = useAutoSavedPrefs();

  return (
    <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm space-y-space-md">
      <div className="flex items-center justify-between">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Canaux d&apos;alerte</h2>
        <Icon name="notifications_active" className="text-primary text-[22px]" />
      </div>
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Désactivez une catégorie pour ne plus voir ses notifications.
      </p>
      <PreferenceToggles prefs={prefs} onToggle={toggle} city={city} disabled={!ready} compact />
      <StatusLine status={status} />
      <button
        type="button"
        onClick={onOpenSettings}
        className="block w-full text-center py-2.5 rounded-full bg-surface-container-low text-primary hover:bg-primary-container hover:text-on-primary font-label-md text-label-md transition-colors"
      >
        Gérer toutes les préférences
      </button>
    </div>
  );
}

/** Fenêtre « Paramètres des alertes » (bouton ⚙ de la page Notifications). */
export function AlertSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { prefs, save, toggle, status, city, ready } = useAutoSavedPrefs();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const allOn = prefs.appointments && prefs.careReminders && prefs.adoption && prefs.lostFoundAlerts;

  function setAll(value: boolean) {
    save({ ...prefs, appointments: value, careReminders: value, adoption: value, lostFoundAlerts: value });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-margin">
      <div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-settings-title"
        className="relative w-full sm:max-w-xl max-h-[90vh] overflow-y-auto bg-surface-container-lowest rounded-t-2xl sm:rounded-2xl p-space-lg md:p-space-xl shadow-[0px_20px_40px_-12px_rgba(15,118,110,0.12),0px_1px_3px_rgba(31,41,55,0.05)] flex flex-col gap-space-lg"
      >
        <div className="flex items-start justify-between gap-space-md">
          <div>
            <h2 id="alert-settings-title" className="font-headline-md text-headline-md text-on-surface tracking-tight">
              Paramètres des alertes
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
              Choisissez les notifications que vous souhaitez recevoir. Les changements sont enregistrés
              automatiquement.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors shrink-0"
          >
            <Icon name="close" className="text-[22px]" />
          </button>
        </div>

        <PreferenceToggles prefs={prefs} onToggle={toggle} city={city} disabled={!ready} />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pt-space-md border-t border-surface-container-low">
          <StatusLine status={status} />
          <div className="flex gap-space-sm sm:ml-auto">
            <button
              type="button"
              onClick={() => setAll(!allOn)}
              disabled={!ready || status?.tone === "saving"}
              className="h-11 px-space-lg rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container font-label-md text-label-md transition-colors disabled:opacity-60"
            >
              {allOn ? "Tout désactiver" : "Tout activer"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-11 px-space-lg rounded-full bg-primary text-on-primary hover:bg-primary-container font-label-lg text-label-lg shadow-sm transition-all"
            >
              Terminé
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
