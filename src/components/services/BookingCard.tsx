"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import {
  formatDateTime,
  formatDuration,
  formatPrice,
  SERVICES_ROUTES,
  setBookingStatus,
  type ServiceBooking,
} from "@/lib/services";
import { errorMessage } from "@/lib/users";
import { BookingStatusPill } from "./ui";

const borders = { pending: "border-l-secondary", confirmed: "border-l-primary", declined: "border-l-outline-variant", cancelled: "border-l-outline-variant" };

/**
 * Réservation (maquette « Réservations reçues ») : vue prestataire (client, Confirmer / Refuser)
 * ou vue client (prestataire, Annuler). Seule une demande en attente propose des actions.
 */
export function BookingCard({ booking, as, onChange }: { booking: ServiceBooking; as: "provider" | "client"; onChange: (b: ServiceBooking) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const pending = booking.status === "pending";
  const past = new Date(booking.dateTime) <= new Date();
  const who = as === "provider" ? booking.clientName : booking.providerName;

  async function act(status: "confirmed" | "declined" | "cancelled", confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(status);
    setError("");
    try {
      onChange(await setBookingStatus(booking.id, status));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className={`bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm border-l-4 ${borders[booking.status]} flex flex-col gap-space-md ${!pending && booking.status !== "confirmed" ? "opacity-80" : ""}`}>
      <div className="flex items-start justify-between gap-space-md">
        <div className="flex items-center gap-space-md min-w-0">
          <span className="w-12 h-12 rounded-full bg-primary-fixed/50 text-primary flex items-center justify-center font-headline-sm text-headline-sm shrink-0">
            {who.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
          </span>
          <div className="min-w-0">
            {as === "client" ? (
              <Link href={SERVICES_ROUTES.provider(booking.providerId)} className="font-headline-sm text-headline-sm text-on-surface hover:text-primary truncate block">
                {who}
              </Link>
            ) : (
              <h3 className="font-headline-sm text-headline-sm text-on-surface truncate">{who}</h3>
            )}
            <p className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1">
              <Icon name="pets" className="text-[14px]" />
              {booking.animalName}
            </p>
          </div>
        </div>
        <BookingStatusPill status={booking.status} />
      </div>

      <div className="rounded-xl bg-surface-container-low p-space-md flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-label-lg text-label-lg text-on-surface">{booking.serviceName}</span>
          <span className="font-label-lg text-label-lg text-primary shrink-0">{formatPrice(booking.price)}</span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 font-body-sm text-body-sm text-on-surface-variant">
          <span className="flex items-center gap-1 text-primary">
            <Icon name="calendar_month" className="text-[16px]" />
            {formatDateTime(booking.dateTime)}
          </span>
          <span className="flex items-center gap-1">
            <Icon name="schedule" className="text-[16px]" />
            {formatDuration(booking.durationMinutes)}
          </span>
        </div>
        {booking.notes && (
          <p className="font-body-sm text-body-sm text-secondary italic flex items-start gap-1">
            <Icon name="sticky_note_2" className="text-[16px] not-italic" />« {booking.notes} »
          </p>
        )}
      </div>

      {pending && !past && as === "provider" && (
        <div className="grid grid-cols-2 gap-space-sm">
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => act("declined", `Refuser la demande de ${booking.clientName} ?`)}
            className="h-11 rounded-xl bg-surface-container text-on-surface font-label-md text-label-md inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            <Icon name="close" className="text-[18px]" />
            Refuser
          </button>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => act("confirmed")}
            className="h-11 rounded-xl bg-primary text-on-primary font-label-md text-label-md inline-flex items-center justify-center gap-1.5 hover:bg-primary-container disabled:opacity-60"
          >
            <Icon name={busy === "confirmed" ? "progress_activity" : "check"} className={`text-[18px] ${busy === "confirmed" ? "animate-spin" : ""}`} />
            Confirmer
          </button>
        </div>
      )}
      {pending && !past && as === "client" && (
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => act("cancelled", "Annuler cette demande de réservation ?")}
          className="self-start h-10 px-space-md rounded-xl bg-surface-container text-on-surface font-label-md text-label-md inline-flex items-center gap-1.5 disabled:opacity-60"
        >
          <Icon name="event_busy" className="text-[18px]" />
          Annuler la demande
        </button>
      )}
      {pending && past && <p className="font-body-sm text-body-sm text-on-surface-variant">Date passée : cette demande ne peut plus être confirmée.</p>}
      {error && <p role="alert" className="font-body-sm text-body-sm text-error">{error}</p>}
    </article>
  );
}

/** Filtres des listes de réservations. */
export type BookingFilter = "all" | "pending" | "confirmed" | "past";

export function filterBookings(list: ServiceBooking[], filter: BookingFilter, now = new Date()): ServiceBooking[] {
  const isPast = (b: ServiceBooking) => new Date(b.dateTime) <= now;
  if (filter === "pending") return list.filter((b) => b.status === "pending" && !isPast(b));
  if (filter === "confirmed") return list.filter((b) => b.status === "confirmed" && !isPast(b));
  if (filter === "past") return list.filter((b) => isPast(b) || b.status === "declined" || b.status === "cancelled");
  return list;
}

export function BookingFilters({ list, value, onChange }: { list: ServiceBooking[]; value: BookingFilter; onChange: (f: BookingFilter) => void }) {
  const labels: Record<BookingFilter, string> = { all: "Toutes", pending: "En attente", confirmed: "Confirmées", past: "Passées & closes" };
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrer les réservations">
      {(Object.keys(labels) as BookingFilter[]).map((f) => (
        <button
          key={f}
          type="button"
          aria-pressed={value === f}
          onClick={() => onChange(f)}
          className={`shrink-0 h-9 px-4 rounded-full font-label-md text-label-md ${value === f ? "bg-primary text-on-primary" : "bg-surface-container-lowest text-on-surface-variant shadow-sm"}`}
        >
          {labels[f]} ({filterBookings(list, f).length})
        </button>
      ))}
    </div>
  );
}
