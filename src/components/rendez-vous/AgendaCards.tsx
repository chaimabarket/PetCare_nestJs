"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { formatTime } from "@/lib/rendez-vous/format";
import { canReschedule, isActive, isBooking } from "@/lib/rendez-vous/rules";
import { REMINDER_CATEGORY_LABELS, PLACE_LABELS, type Appointment, type Reminder } from "@/lib/rendez-vous/types";
import { PetAvatar, Pill, RdvCard, SoftButton, StatusPill, TypeTag } from "./ui";

/** Lien Google Maps vers une adresse (bouton « Itinéraire »). */
export const directionsUrl = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

type Notify = (message: string, tone?: "success" | "error") => void;

/** Carte d'un rendez-vous actif ou terminé dans l'agenda. Toute la carte ouvre le détail. */
export function AppointmentCard({ appointment: a, notify }: { appointment: Appointment; notify: Notify }) {
  const timeColor = a.status === "planned" ? "text-secondary" : "text-primary-container";
  const address = a.providerAddress ?? a.location;
  const booking = isBooking(a);

  return (
    <RdvCard className="relative transition-shadow hover:shadow-[0_8px_24px_-6px_rgba(31,41,55,0.12)]">
      <div className="flex items-start gap-3">
        <PetAvatar name={a.petName} />
        <div className="min-w-0 flex-1">
          <p className="truncate">
            {/* Lien étiré : toute la carte est cliquable, les boutons restent au-dessus. */}
            <Link href={`/rendez-vous/${a.id}`} className="font-bold text-[16px] after:absolute after:inset-0 after:rounded-2xl">
              {a.petName}
            </Link>
            {a.petBreed && <span className="text-[13px] text-on-surface-variant">{`  • ${a.petBreed}`}</span>}
          </p>
          <p className={`mt-1 flex items-center gap-1 font-label-lg text-label-lg ${timeColor}`}>
            <Icon name="schedule" className="text-[16px]" />
            {formatTime(a.startsAt)} - {formatTime(a.endsAt)}
          </p>
        </div>
        <StatusPill status={a.status} />
      </div>

      <div className="mt-3 rounded-xl bg-surface-container-low p-3">
        <div className="flex items-center gap-2">
          <TypeTag type={a.type} label={!booking && a.type === "soin" ? "Personnel" : undefined} />
          <p className="truncate font-label-lg text-[15px]">{a.title}</p>
        </div>
        <IconLine
          icon={booking ? (a.type === "toilettage" ? "storefront" : "local_hospital") : "home"}
          text={a.providerName ?? PLACE_LABELS[a.place]}
          strong
        />
        {address && <IconLine icon="location_on" text={address} />}
      </div>

      {isActive(a.status) && (
        <div className="relative z-10 mt-3 flex gap-2">
          {a.status === "planned" ? (
            <>
              <SoftButton
                label="Modifier"
                icon="edit_calendar"
                href={`/rendez-vous/nouveau?reporter=${a.id}`}
                disabled={!canReschedule(a)}
                className="flex-1"
              />
              <SoftButton
                label={booking ? "Contacter le salon" : "Contacter"}
                icon="chat"
                tone="coral"
                className="flex-1"
                onClick={() =>
                  notify(a.providerPhone ? `Téléphone : ${a.providerPhone}` : "Aucun numéro de téléphone n'est renseigné.")
                }
              />
            </>
          ) : (
            <>
              {address ? (
                <a
                  href={directionsUrl(address)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-surface-container px-3 font-label-lg text-label-lg text-on-surface hover:bg-surface-container-high"
                >
                  <Icon name="near_me" className="text-[18px]" />
                  Itinéraire
                </a>
              ) : (
                <SoftButton label="Itinéraire" icon="near_me" disabled className="flex-1" />
              )}
              <SoftButton
                label="Carnet santé"
                icon="bookmark_add"
                className="flex-1"
                onClick={() => notify("Le carnet de santé arrive avec le module Santé.")}
              />
              {a.providerPhone && (
                <a
                  href={`tel:${a.providerPhone.replaceAll(" ", "")}`}
                  title={`Appeler ${a.providerName}`}
                  className="flex h-10 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-container text-white hover:bg-primary"
                >
                  <Icon name="call" className="text-[20px]" />
                </a>
              )}
            </>
          )}
        </div>
      )}
    </RdvCard>
  );
}

function IconLine({ icon, text, strong }: { icon: string; text: string; strong?: boolean }) {
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-[13px]">
      <Icon name={icon} className="text-[16px] text-on-surface-variant" />
      <span className={`truncate ${strong ? "font-semibold text-on-surface" : "text-on-surface-variant"}`}>{text}</span>
    </p>
  );
}

/** Carte d'un rendez-vous annulé : titre barré, motif et « Reprogrammer ». */
export function CancelledCard({ appointment: a }: { appointment: Appointment }) {
  return (
    <RdvCard className="relative">
      <div className="flex items-start gap-3">
        <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-error-container text-error">
          <Icon name="event_busy" />
        </span>
        <div className="min-w-0 flex-1">
          <Link
            href={`/rendez-vous/${a.id}`}
            className="block truncate font-bold text-[16px] text-outline line-through after:absolute after:inset-0 after:rounded-2xl"
          >
            {a.title}
          </Link>
          <p className="mt-1 text-[13px] text-on-surface-variant">
            {a.providerName ?? a.petName} • {formatTime(a.startsAt)}
          </p>
        </div>
        <StatusPill status={a.status} />
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-surface-container-low py-2 pl-3 pr-1">
        <p className="flex-1 text-[13px] text-on-surface-variant">Motif : {a.cancelReason ?? "non précisé"}</p>
        <Link
          href={`/rendez-vous/nouveau?copie=${a.id}`}
          className="relative z-10 rounded-lg px-3 py-1.5 font-label-lg text-label-lg text-primary-container hover:bg-surface-container"
        >
          Reprogrammer
        </Link>
      </div>
    </RdvCard>
  );
}

/** Rappel de soin du jour dans l'agenda, avec la case « Valider ». */
export function ReminderAgendaCard({ reminder: r, onToggle }: { reminder: Reminder; onToggle: () => void }) {
  return (
    <RdvCard>
      <div className="flex items-start gap-3">
        <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-surface-container text-primary">
          <Icon name="medication" />
        </span>
        <div className="min-w-0 flex-1">
          <p>
            <span className="font-bold text-[16px]">{r.petName}</span>
            <span className="text-[13px] text-on-surface-variant">{`  • ${REMINDER_CATEGORY_LABELS[r.category]}`}</span>
          </p>
          <p className="mt-1 flex items-center gap-1 font-label-lg text-label-lg">
            <Icon name="schedule" className="text-[16px] text-on-surface-variant" />
            {formatTime(r.dueAt)}
          </p>
        </div>
        <Pill label="Rappel" icon="notifications_active" className="bg-primary-fixed/45 text-on-primary-fixed-variant" />
      </div>
      <div className="mt-3 rounded-xl bg-surface-container-low p-3">
        <div className="flex items-center gap-2">
          <TypeTag label="Personnel" className="bg-white text-on-surface-variant" />
          <p className="truncate font-label-lg text-[15px]">{r.title}</p>
        </div>
        {r.description && <p className="mt-1.5 text-[13px] text-on-surface-variant">{r.description}</p>}
      </div>
      <label className="mt-2.5 flex cursor-pointer items-center gap-3 rounded-xl bg-surface-container-low px-3 py-2.5 hover:bg-surface-container">
        <input type="checkbox" checked={r.done} onChange={onToggle} className="h-5 w-5 accent-primary-container" />
        <span className="flex-1 truncate font-label-lg text-label-lg">Valider : {r.title}</span>
        <Icon name="check" className="text-[18px] text-on-surface-variant" />
      </label>
    </RdvCard>
  );
}
