"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { BookingCard, BookingFilters, filterBookings, type BookingFilter } from "@/components/services/BookingCard";
import { Breadcrumb, ErrorState, LoadingState, useLoad } from "@/components/services/ui";
import { Icon } from "@/components/ui/Icon";
import { listBookings, SERVICES_ROUTES, type ServiceBooking } from "@/lib/services";

export default function MyBookingsPage() {
  return (
    <RequireAuth>
      <MyBookings />
    </RequireAuth>
  );
}

/** Réservations du client : suivi des demandes et annulation tant qu'elles sont en attente. */
function MyBookings() {
  const load = useCallback(() => listBookings("client"), []);
  const { data, error, loading, reload, replace } = useLoad<ServiceBooking[]>(load);
  const [filter, setFilter] = useState<BookingFilter>("all");
  // Heure de référence figée à l'ouverture de la page (le rendu doit rester pur).
  const [now] = useState(() => Date.now());

  const visible = data
    ? filterBookings(data, filter).sort((a, b) => {
        const aPast = new Date(a.dateTime).getTime() <= now;
        const bPast = new Date(b.dateTime).getTime() <= now;
        // À venir d'abord (la plus proche en premier), puis les passées (la plus récente en premier).
        if (aPast !== bPast) return aPast ? 1 : -1;
        return aPast ? b.dateTime.localeCompare(a.dateTime) : a.dateTime.localeCompare(b.dateTime);
      })
    : [];

  return (
    <div className="max-w-3xl mx-auto w-full px-margin md:px-margin-md py-space-xl flex flex-col gap-space-lg">
      <Breadcrumb items={[{ label: "Services", href: SERVICES_ROUTES.directory }, { label: "Mes réservations" }]} />
      <div className="flex flex-wrap items-end justify-between gap-space-md">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Mes réservations</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Vos demandes auprès des professionnels. Elles apparaissent aussi dans votre agenda.
          </p>
        </div>
        <Link href="/rendez-vous" className="h-11 px-5 rounded-xl bg-surface-container-lowest shadow-sm text-on-surface font-label-md text-label-md inline-flex items-center gap-2">
          <Icon name="calendar_month" className="text-[18px]" />
          Mon agenda
        </Link>
      </div>

      {loading && !data && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && data.length === 0 && (
        <div className="bg-surface-container-lowest rounded-2xl p-10 shadow-sm flex flex-col items-center text-center gap-3">
          <span className="w-16 h-16 rounded-2xl bg-primary-fixed/40 text-primary flex items-center justify-center">
            <Icon name="event_note" className="text-[32px]" />
          </span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Aucune réservation pour l&apos;instant</h2>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-md">Trouvez un vétérinaire, un toiletteur ou un promeneur et réservez en quelques clics.</p>
          <Link href={SERVICES_ROUTES.directory} className="h-11 px-6 rounded-xl bg-primary text-on-primary font-label-md text-label-md inline-flex items-center gap-2">
            <Icon name="search" className="text-[18px]" />
            Parcourir l&apos;annuaire
          </Link>
        </div>
      )}
      {data && data.length > 0 && (
        <>
          <BookingFilters list={data} value={filter} onChange={setFilter} />
          {visible.length === 0 && <p className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm text-on-surface-variant">Aucune réservation dans cette catégorie.</p>}
          {visible.map((b) => (
            <BookingCard key={b.id} booking={b} as="client" onChange={(updated) => replace(data.map((x) => (x.id === updated.id ? updated : x)))} />
          ))}
        </>
      )}
    </div>
  );
}
