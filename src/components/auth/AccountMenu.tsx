"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { logOut, ROLE_LABELS } from "@/lib/users";

/** Menu sous l'avatar : profil, notifications, déconnexion. */
export function AccountMenu() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const name = profile?.displayName ?? user?.displayName ?? user?.email ?? "";

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

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logOut();
      setOpen(false);
      router.replace("/connexion");
    } finally {
      setLoggingOut(false);
    }
  }

  const itemClass =
    "w-full flex items-center gap-space-sm px-space-md py-2.5 font-label-lg text-label-lg transition-colors text-left";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu du compte"
        aria-expanded={open}
        className="flex rounded-full ring-2 ring-primary-container/20 hover:ring-primary-container/50 transition-shadow"
      >
        <Avatar name={name} className="w-8 h-8 text-label-md" />
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-64 bg-surface-container-lowest rounded-2xl shadow-xl overflow-hidden">
          <div className="p-space-md flex items-center gap-space-sm bg-surface-container-low/60">
            <Avatar name={name} className="w-10 h-10 text-label-lg shrink-0" />
            <div className="min-w-0">
              <p className="font-label-lg text-label-lg text-on-surface truncate">{name}</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                {profile ? ROLE_LABELS[profile.role] : user?.email}
              </p>
            </div>
          </div>
          <div className="py-space-xs">
            <Link href="/profil" onClick={() => setOpen(false)} className={`${itemClass} text-on-surface hover:bg-surface-container-low`}>
              <Icon name="person" className="text-[20px] text-primary" />
              Mon profil
            </Link>
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className={`${itemClass} text-on-surface hover:bg-surface-container-low`}
            >
              <Icon name="notifications" className="text-[20px] text-primary" />
              Notifications
            </Link>
          </div>
          <div className="h-px bg-surface-container" />
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className={`${itemClass} text-error hover:bg-error-container/30 disabled:opacity-60`}
          >
            <Icon name={loggingOut ? "progress_activity" : "logout"} className={`text-[20px] ${loggingOut ? "animate-spin" : ""}`} />
            {loggingOut ? "Déconnexion…" : "Se déconnecter"}
          </button>
        </div>
      )}
    </div>
  );
}
