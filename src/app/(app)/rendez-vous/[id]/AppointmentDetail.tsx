"use client";

import { useState } from "react";
import Link from "next/link";
import { directionsUrl } from "@/components/rendez-vous/AgendaCards";
import {
  Breadcrumb,
  DemoBanner,
  Dialog,
  Loading,
  Pill,
  RdvCard,
  SoftButton,
  StatusPill,
  pageClass,
  useToast,
} from "@/components/rendez-vous/ui";
import { Icon } from "@/components/ui/Icon";
import { Toggle } from "@/components/ui/Toggle";
import {
  addMinutes,
  formatDayMonth,
  formatDuration,
  formatLongDate,
  formatPrice,
  formatRelativeDay,
  formatReminderMoment,
  formatReminderOffset,
  formatTime,
} from "@/lib/rendez-vous/format";
import {
  canCancel,
  canComplete,
  canConfirm,
  canReschedule,
  durationMinutes,
  hasStarted,
  isActive,
  isBooking,
} from "@/lib/rendez-vous/rules";
import {
  cancelAppointment,
  completeAppointment,
  confirmAppointment,
  errorMessage,
  setAppointmentReminder,
  setViewAs,
  useRdv,
  type RdvState,
} from "@/lib/rendez-vous/store";
import { ACTION_LABELS, PLACE_LABELS, STATUS_LABELS, TYPE_ICONS, TYPE_LABELS, type Appointment } from "@/lib/rendez-vous/types";

/** Détail d'un rendez-vous : le client voit Reporter / Annuler, le prestataire voit en plus l'« Espace Prestataire ». */
export function AppointmentDetail({ id }: { id: string }) {
  const data = useRdv();
  if (!data) return <Loading />;
  const appointment = data.appointments.find((a) => a.id === id);
  if (!appointment) {
    return (
      <div className={pageClass}>
        <Breadcrumb items={[{ label: "Agenda", href: "/rendez-vous" }, { label: "Rendez-vous" }]} />
        <RdvCard className="p-6 text-center text-on-surface-variant">
          Ce rendez-vous n&apos;existe plus ou ne vous concerne pas.
          <div className="mt-4">
            <SoftButton label="Retour à l'agenda" icon="arrow_back" href="/rendez-vous" tone="primary" />
          </div>
        </RdvCard>
      </div>
    );
  }
  return <Detail appointment={appointment} viewAs={data.viewAs} />;
}

function Detail({ appointment: a, viewAs }: { appointment: Appointment; viewAs: RdvState["viewAs"] }) {
  const toast = useToast();
  const [cancelOpen, setCancelOpen] = useState(false);
  const booking = isBooking(a);
  const isProvider = booking && viewAs === "provider";

  function run(action: () => void, success: string) {
    try {
      action();
      toast.show(success);
    } catch (error) {
      toast.show(errorMessage(error), "error");
    }
  }

  async function share() {
    const address = a.providerAddress ?? a.location;
    const text =
      `${a.title} – ${a.petName}\n${formatLongDate(a.startsAt)}, ${formatTime(a.startsAt)} à ${formatTime(a.endsAt)}\n` +
      `${a.providerName ?? PLACE_LABELS[a.place]}${address ? ` – ${address}` : ""}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.show("Détails du rendez-vous copiés.");
    } catch {
      toast.show("Copie impossible sur ce navigateur.", "error");
    }
  }

  return (
    <div className={pageClass}>
      <Breadcrumb items={[{ label: "Agenda", href: "/rendez-vous" }, { label: a.title }]} />
      <DemoBanner />

      <div className="mb-space-lg flex flex-wrap items-center gap-3">
        <Link
          href="/rendez-vous"
          title="Retour à l'agenda"
          className="flex h-10 w-10 items-center justify-center rounded-full text-primary hover:bg-surface-container"
        >
          <Icon name="arrow_back_ios_new" className="text-[20px]" />
        </Link>
        <h1 className="flex-1 font-headline-lg text-headline-lg">Détail du rendez-vous</h1>
        {booking && (
          <div className="flex rounded-xl bg-surface-container-high p-1" role="group" aria-label="Voir en tant que">
            {(["client", "provider"] as const).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setViewAs(role)}
                aria-pressed={viewAs === role}
                className={`rounded-lg px-3 py-1 font-label-md text-label-md ${
                  viewAs === role ? "bg-white text-primary-container shadow-sm" : "text-on-surface-variant"
                }`}
              >
                {role === "client" ? "Vue client" : "Vue prestataire"}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={share}
          title="Partager"
          className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"
        >
          <Icon name="share" />
        </button>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-4">
          <SummaryCard a={a} />
          <PetCard a={a} onHealth={() => toast.show("Le carnet de santé arrive avec le module Santé.")} />
          <PlaceCard a={a} notify={toast.show} />
        </div>

        <div className="flex flex-col gap-4">
          {isProvider && isActive(a.status) && (
            <ProviderCard a={a} onConfirm={() => run(() => confirmAppointment(a), "Rendez-vous confirmé.")} />
          )}

          <ReminderCard
            a={a}
            onToggle={(enabled) =>
              run(() => setAppointmentReminder(a, enabled ? 1440 : 0), enabled ? "Rappel activé." : "Rappel désactivé.")
            }
          />

          <div className="flex flex-col gap-2">
            {canReschedule(a) && (
              <SoftButton
                label="Reporter le rendez-vous"
                icon="sync"
                tone="primary"
                href={`/rendez-vous/nouveau?reporter=${a.id}`}
                className="h-12"
              />
            )}
            {canCancel(a) && (
              <SoftButton label="Annuler le rendez-vous" icon="cancel" tone="danger" onClick={() => setCancelOpen(true)} className="h-11" />
            )}
            {canComplete(a) && (
              <SoftButton
                label="Marquer comme terminé"
                icon="task_alt"
                tone="solid"
                onClick={() => run(() => completeAppointment(a), "Rendez-vous terminé.")}
                className="h-12"
              />
            )}
            {(!isActive(a.status) || (hasStarted(a) && !canComplete(a))) && (
              <p className="py-2 text-center text-[13px] text-on-surface-variant">
                {isActive(a.status)
                  ? "Ce rendez-vous a commencé : il ne peut plus être reporté ni annulé."
                  : `Ce rendez-vous est ${STATUS_LABELS[a.status].toLowerCase()} : aucune action possible.`}
              </p>
            )}
          </div>

          {booking && (
            <RdvCard className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary-fixed text-secondary">
                <Icon name="verified_user" className="text-[22px]" />
              </span>
              <div>
                <p className="font-label-lg text-label-lg">Annulation gratuite jusqu&apos;à 24h avant</p>
                <p className="text-[13px] text-on-surface-variant">
                  Pour toute urgence concernant {a.petName}, contactez directement l&apos;équipe du salon.
                </p>
              </div>
            </RdvCard>
          )}

          {a.changes.length > 0 && <HistoryCard a={a} />}
        </div>
      </div>

      <CancelDialog
        appointment={a}
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={(reason) => {
          setCancelOpen(false);
          run(() => cancelAppointment(a, reason), "Rendez-vous annulé.");
        }}
      />
      {toast.view}
    </div>
  );
}

function CardTitle({ icon, title, trailing }: { icon: string; title: string; trailing?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Icon name={icon} className="text-[20px] text-primary" />
      <h2 className="flex-1 font-label-lg text-[15px]">{title}</h2>
      {trailing}
    </div>
  );
}

function SummaryCard({ a }: { a: Appointment }) {
  return (
    <RdvCard>
      <div className="flex items-center justify-between gap-2">
        <StatusPill status={a.status} label={a.status === "planned" ? "En attente de confirmation" : undefined} />
        <Pill label={formatRelativeDay(a.startsAt)} icon="schedule" className="bg-surface-container-high text-on-surface-variant" />
      </div>
      <div className="mt-4 flex items-center gap-3.5">
        <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px] bg-surface-container text-primary">
          <Icon name={TYPE_ICONS[a.type]} className="text-[26px]" />
        </span>
        <div>
          <p className="font-headline-sm text-[20px]">
            {a.title} – {formatDuration(durationMinutes(a))}
          </p>
          <p className="text-[13px] text-on-surface-variant">{a.description ?? TYPE_LABELS[a.type]}</p>
        </div>
      </div>
      <div className="mt-4 rounded-xl bg-surface-container-low p-4">
        <p className="flex items-center gap-2 font-label-lg text-[16px] text-primary">
          <Icon name="event" className="text-[20px]" />
          {formatLongDate(a.startsAt)}
        </p>
        <div className="mt-1.5 flex items-end justify-between gap-2">
          <p className="pl-7 text-[15px] text-on-surface-variant">
            {formatTime(a.startsAt)} à {formatTime(a.endsAt)}
          </p>
          {a.price !== undefined && (
            <div className="text-right">
              <p className="text-[20px] font-bold text-primary">{formatPrice(a.price)}</p>
              <p className="text-[12px] text-on-surface-variant">Règlement sur place</p>
            </div>
          )}
        </div>
      </div>
    </RdvCard>
  );
}

function PetCard({ a, onHealth }: { a: Appointment; onHealth: () => void }) {
  return (
    <RdvCard className="flex flex-col gap-3.5">
      <CardTitle
        icon="pets"
        title="Animal concerné"
        trailing={a.petId && <Pill label="Fiche à jour" className="bg-surface-container-high text-on-surface-variant" />}
      />
      <div className="flex items-center gap-3.5">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-secondary-fixed text-[26px] font-bold text-on-secondary-container">
          {a.petName.charAt(0).toUpperCase()}
        </span>
        <div>
          <p className="font-headline-sm text-[20px]">{a.petName}</p>
          {a.petBreed && <p className="text-[13px] text-on-surface-variant">{a.petBreed}</p>}
        </div>
      </div>
      {a.notes && (
        <div className="rounded-xl bg-secondary-fixed/35 p-3.5">
          <p className="flex items-center gap-1.5 font-label-md text-[13px] text-on-secondary-container">
            <Icon name="favorite" className="text-[18px] text-secondary" />
            {isBooking(a) ? "Notes de soin pour le prestataire" : "Notes personnelles & matériel"}
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed">{a.notes}</p>
        </div>
      )}
      <SoftButton label="Carnet santé" icon="bookmark_add" onClick={onHealth} />
    </RdvCard>
  );
}

/** « Prestataire de soin » pour une réservation, « Lieu du rendez-vous » pour un rendez-vous personnel. */
function PlaceCard({ a, notify }: { a: Appointment; notify: (message: string) => void }) {
  const address = a.providerAddress ?? a.location;
  return (
    <RdvCard className="flex flex-col gap-3">
      <CardTitle icon={isBooking(a) ? "storefront" : "home"} title={isBooking(a) ? "Prestataire de soin" : "Lieu du rendez-vous"} />
      <div>
        <p className="font-headline-sm text-[20px]">{a.providerName ?? PLACE_LABELS[a.place]}</p>
        {address && <p className="mt-1 text-[14px] text-on-surface-variant">{address}</p>}
      </div>
      {address && (
        // Aperçu du lieu (sans clé de carte) : le bouton Itinéraire ouvre la vraie carte.
        <div className="relative flex h-32 items-center justify-center rounded-xl border border-outline-variant/50 bg-surface-container">
          <Icon name="location_on" filled className="text-[40px] text-primary-container" />
          <span className="absolute bottom-2 left-2 right-2 flex w-fit max-w-[calc(100%-1rem)] items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[12px] font-medium">
            <Icon name="location_on" className="text-[14px] text-on-surface-variant" />
            <span className="truncate">{address}</span>
          </span>
        </div>
      )}
      <div className="flex gap-2">
        {address ? (
          <a
            href={directionsUrl(address)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-surface-container px-3 font-label-lg text-label-lg hover:bg-surface-container-high"
          >
            <Icon name="directions" className="text-[18px]" />
            Itinéraire
          </a>
        ) : (
          <SoftButton label="Itinéraire" icon="directions" disabled className="flex-1" />
        )}
        {isBooking(a) && (
          <SoftButton
            label="Appeler"
            icon="call"
            className="flex-1"
            onClick={() => notify(a.providerPhone ? `Téléphone : ${a.providerPhone}` : "Aucun numéro de téléphone n'est renseigné.")}
          />
        )}
      </div>
    </RdvCard>
  );
}

function ReminderCard({ a, onToggle }: { a: Appointment; onToggle: (enabled: boolean) => void }) {
  const enabled = a.reminderMinutes > 0;
  const offset = enabled ? a.reminderMinutes : 1440;
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const calendarUrl =
    "https://calendar.google.com/calendar/render?" +
    new URLSearchParams({
      action: "TEMPLATE",
      text: `${a.title} – ${a.petName}`,
      dates: `${stamp(a.startsAt)}/${stamp(a.endsAt)}`,
      details: `Rendez-vous PetCare Community pour ${a.petName}.`,
      location: a.providerAddress ?? a.location,
    });

  return (
    <RdvCard className="flex flex-col gap-3">
      <CardTitle icon="notifications_active" title="Rappels & Alertes" />
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <p className="font-label-lg text-[15px]">Me rappeler {formatReminderOffset(offset)}</p>
          <p className="text-[13px] text-on-surface-variant">
            {enabled
              ? `${formatReminderMoment(addMinutes(a.startsAt, -offset))}${a.pushReminder ? " (Push & SMS)" : ""}`
              : "Rappel désactivé"}
          </p>
        </div>
        <Toggle checked={enabled} onChange={onToggle} label="Rappel avant le rendez-vous" disabled={!isActive(a.status)} />
      </div>
      <a
        href={calendarUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-12 items-center justify-center gap-1.5 rounded-xl bg-surface-container px-3 font-label-lg text-label-lg hover:bg-surface-container-high"
      >
        <Icon name="calendar_month" className="text-[18px]" />
        Ajouter à Google Agenda / Apple Calendar
      </a>
    </RdvCard>
  );
}

function ProviderCard({ a, onConfirm }: { a: Appointment; onConfirm: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface-container-low p-4">
      <CardTitle
        icon="badge"
        title="Espace Prestataire"
        trailing={<Pill label="Vue salon partenaire" className="bg-primary-fixed/60 text-on-primary-fixed-variant" />}
      />
      <p className="text-[14px] leading-relaxed">
        {a.status === "planned"
          ? `Cette demande de réservation est en attente de votre validation pour bloquer définitivement le créneau de ${formatTime(a.startsAt)}.`
          : `Vous avez confirmé ce créneau de ${formatTime(a.startsAt)}.`}
      </p>
      {canConfirm(a) && <SoftButton label="Confirmer le rendez-vous" icon="check_circle" tone="solid" onClick={onConfirm} className="h-12" />}
      {canReschedule(a) && (
        <SoftButton
          label="Proposer un autre horaire"
          icon="update"
          tone="primary"
          href={`/rendez-vous/nouveau?reporter=${a.id}`}
          className="h-11 bg-white"
        />
      )}
    </div>
  );
}

/** Historique : l'ancien horaire reste visible après un report (RG-18). */
function HistoryCard({ a }: { a: Appointment }) {
  return (
    <RdvCard className="flex flex-col gap-2">
      <CardTitle icon="history" title="Historique" />
      <ol className="flex flex-col gap-3 pt-1">
        {[...a.changes].reverse().map((c, i) => (
          <li key={i} className="flex gap-2.5">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-container" />
            <div>
              <p className="font-label-lg text-label-lg">
                {ACTION_LABELS[c.action]} · {formatDayMonth(c.at)} {formatTime(c.at)}
              </p>
              {c.oldStart && c.newStart && (
                <p className="text-[13px] text-on-surface-variant">
                  {formatDayMonth(c.oldStart)} {formatTime(c.oldStart)} → {formatDayMonth(c.newStart)} {formatTime(c.newStart)}
                </p>
              )}
              {c.reason && <p className="text-[13px] text-on-surface-variant">Motif : {c.reason}</p>}
            </div>
          </li>
        ))}
      </ol>
    </RdvCard>
  );
}

/** Confirmation d'annulation, avec un motif facultatif. */
function CancelDialog({
  appointment: a,
  open,
  onClose,
  onConfirm,
}: {
  appointment: Appointment;
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onClose={onClose} title="Annuler ce rendez-vous ?">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(reason);
          setReason("");
        }}
        className="flex flex-col gap-4"
      >
        <p className="text-on-surface-variant">
          « {a.title} » pour {a.petName}, prévu le {formatLongDate(a.startsAt)} à {formatTime(a.startsAt)}, sera annulé.
          Cette action est définitive.
        </p>
        <label className="flex flex-col gap-1.5">
          <span className="font-label-lg text-label-lg">Motif (facultatif)</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
            placeholder="Ex. Empêchement de dernière minute"
            className="h-11 rounded-lg bg-surface-container-low px-3.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </label>
        <div className="flex justify-end gap-2">
          <SoftButton label="Garder" icon="undo" onClick={onClose} />
          <button
            type="submit"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-error px-4 font-label-lg text-label-lg text-on-error hover:opacity-90"
          >
            <Icon name="cancel" className="text-[18px]" />
            Annuler le rendez-vous
          </button>
        </div>
      </form>
    </Dialog>
  );
}
