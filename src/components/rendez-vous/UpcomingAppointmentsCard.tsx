"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { formatTime, shortDayName } from "@/lib/rendez-vous/format";
import { isActive } from "@/lib/rendez-vous/rules";
import { useRdv } from "@/lib/rendez-vous/store";
import { TYPE_LABELS } from "@/lib/rendez-vous/types";
import { StatusPill } from "./ui";

/** Carte « Prochains rendez-vous » de l'Accueil : les 2 prochains rendez-vous et le lien « Voir l'agenda ». */
export function UpcomingAppointmentsCard() {
  const data = useRdv();
  const now = data ? new Date() : null;
  const next = data && now
    ? data.appointments
        .filter((a) => isActive(a.status) && a.endsAt > now)
        .sort((x, y) => x.startsAt.getTime() - y.startsAt.getTime())
        .slice(0, 2)
    : [];
  const todo = data && now ? data.reminders.filter((r) => !r.done && r.dueAt < new Date(now.getTime() + 86_400_000)).length : 0;

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface-container-lowest p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-low text-primary-container">
          <Icon name="calendar_month" className="text-[22px]" />
        </span>
        <h2 className="flex-1 font-headline-sm text-[19px]">Prochains rendez-vous</h2>
        <Link href="/rendez-vous" className="flex items-center font-label-lg text-[13px] text-primary hover:underline">
          Voir l&apos;agenda
          <Icon name="chevron_right" className="text-[18px]" />
        </Link>
      </div>

      {!data ? (
        <p className="p-3 text-center text-on-surface-variant">Chargement…</p>
      ) : next.length === 0 ? (
        <p className="rounded-xl bg-surface-container-low p-4 text-on-surface-variant">Aucun rendez-vous à venir.</p>
      ) : (
        next.map((a) => (
          <Link
            key={a.id}
            href={`/rendez-vous/${a.id}`}
            className="flex items-center gap-3 rounded-xl bg-surface-container-low p-3 hover:bg-surface-container"
          >
            <span className="flex w-12 shrink-0 flex-col items-center rounded-[10px] bg-white py-1.5">
              <span className="text-[11px] text-on-surface-variant">{shortDayName(a.startsAt)}</span>
              <span className="text-[18px] font-bold text-primary-container">{a.startsAt.getDate()}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-label-lg text-[15px]">{a.title}</span>
              <span className="block truncate text-[13px] text-on-surface-variant">
                {a.petName} • {TYPE_LABELS[a.type]} • {formatTime(a.startsAt)}
              </span>
            </span>
            <StatusPill status={a.status} />
          </Link>
        ))
      )}

      <Link
        href="/rappels"
        className="flex items-center gap-3 rounded-xl bg-secondary-fixed/50 p-3 text-on-secondary-container hover:bg-secondary-fixed"
      >
        <Icon name="notifications_active" className="text-[22px]" />
        <span className="flex-1 font-label-lg text-label-lg">Rappels de soins</span>
        {todo > 0 && <span className="rounded-full bg-white px-2 py-0.5 font-label-md text-label-md">{todo} à faire</span>}
        <Icon name="chevron_right" className="text-[18px]" />
      </Link>
    </div>
  );
}
