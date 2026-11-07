"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAsync } from "@/components/adoption/hooks";
import { Breadcrumb, ButtonLink, EmptyState, ListingStatusPill, PageLoading, Photo } from "@/components/adoption/ui";
import { Alert } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import {
  ADOPTION_ROUTES,
  archiveListing,
  daysOnline,
  deleteDraft,
  listMyListings,
  listOwnerApplications,
  PUBLISHER_ROLES,
  republishListing,
  type AdoptionApplication,
  type AdoptionListing,
  type ListingStatus,
} from "@/lib/adoption";
import { errorMessage } from "@/lib/users";

const TABS: { status: ListingStatus; label: string }[] = [
  { status: "disponible", label: "Disponibles" },
  { status: "reservee", label: "Réservées" },
  { status: "adoptee", label: "Adoptées" },
  { status: "brouillon", label: "Brouillons" },
  { status: "archivee", label: "Archivées" },
];

export default function MyListingsPage() {
  return (
    <RequireAuth roles={PUBLISHER_ROLES}>
      <MyListings />
    </RequireAuth>
  );
}

function MyListings() {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const load = useCallback(
    async () => {
      const [listings, applications] = await Promise.all([listMyListings(uid), listOwnerApplications(uid)]);
      return { listings, applications };
    },
    [uid],
  );
  const { data, error, loading, reload } = useAsync(load);
  const [tab, setTab] = useState<ListingStatus>("disponible");
  const [actionError, setActionError] = useState("");

  const listings = data?.listings ?? [];
  const shown = listings.filter((l) => l.status === tab);

  async function run(action: () => Promise<void>) {
    setActionError("");
    try {
      await action();
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-margin md:px-margin-md lg:px-margin-lg py-space-lg">
      <Breadcrumb items={[{ label: "Adoption", href: ADOPTION_ROUTES.feed }, { label: "Mes annonces d'adoption" }]} />
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md mb-space-lg">
        <div>
          <h1 className="font-headline-lg text-headline-lg">Mes annonces d&apos;adoption</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">Suivez vos annonces et les candidatures reçues.</p>
        </div>
        <ButtonLink href={ADOPTION_ROUTES.publish} variant="coral" icon="add_circle">
          Publier une annonce
        </ButtonLink>
      </div>

      <div className="flex items-center gap-space-xs overflow-x-auto pb-space-xs mb-space-lg" role="tablist">
        {TABS.map((t) => {
          const count = listings.filter((l) => l.status === t.status).length;
          const active = tab === t.status;
          return (
            <button
              key={t.status}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.status)}
              className={`px-space-md py-2 rounded-full font-label-md text-label-md shrink-0 transition-colors ${
                active ? "bg-primary text-on-primary" : "bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container shadow-sm"
              }`}
            >
              {t.label} ({count})
            </button>
          );
        })}
      </div>

      {(error || actionError) && (
        <div className="mb-space-md">
          <Alert>{error || actionError}</Alert>
        </div>
      )}

      {loading ? (
        <PageLoading />
      ) : shown.length === 0 ? (
        <EmptyState
          icon="campaign"
          title="Aucune annonce ici"
          text="Publiez une annonce pour aider un animal à trouver sa famille."
          action={<ButtonLink href={ADOPTION_ROUTES.publish}>Publier une annonce</ButtonLink>}
        />
      ) : (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-space-md px-space-lg py-space-sm bg-surface-container-low font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
            <span className="col-span-4">Animal</span>
            <span className="col-span-2">Statut</span>
            <span className="col-span-2">Candidatures</span>
            <span className="col-span-2">En ligne depuis</span>
            <span className="col-span-2 text-right">Actions</span>
          </div>
          <ul className="divide-y divide-surface-container">
            {shown.map((listing) => (
              <ListingRow
                key={listing.id}
                listing={listing}
                applications={(data?.applications ?? []).filter((a) => a.listingId === listing.id)}
                onArchive={() => run(() => archiveListing(listing))}
                onRepublish={() => run(() => republishListing(listing))}
                onDelete={() => run(() => deleteDraft(listing))}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ListingRow({
  listing,
  applications,
  onArchive,
  onRepublish,
  onDelete,
}: {
  listing: AdoptionListing;
  applications: AdoptionApplication[];
  onArchive: () => void;
  onRepublish: () => void;
  onDelete: () => void;
}) {
  const total = applications.filter((a) => a.status !== "retiree").length;
  const fresh = applications.filter((a) => a.status === "envoyee").length;
  const days = daysOnline(listing);

  return (
    <li className="grid grid-cols-[auto_1fr_auto] md:grid-cols-12 gap-space-md items-center px-space-md md:px-space-lg py-space-md">
      <Link href={ADOPTION_ROUTES.listing(listing.id)} className="md:col-span-4 flex items-center gap-space-sm min-w-0 col-span-2">
        <Photo src={listing.thumbnail} alt={listing.name} className="w-14 h-14 rounded-xl shrink-0" />
        <span className="min-w-0">
          <span className="block font-headline-sm text-headline-sm truncate">{listing.name}</span>
          <span className="flex flex-wrap items-center gap-space-xs md:hidden mt-1">
            <ListingStatusPill status={listing.status} />
            <ApplicationsBadge total={total} fresh={fresh} />
          </span>
        </span>
      </Link>
      <span className="hidden md:block md:col-span-2">
        <ListingStatusPill status={listing.status} />
      </span>
      <span className="hidden md:block md:col-span-2">
        <ApplicationsBadge total={total} fresh={fresh} />
      </span>
      <span className="hidden md:block md:col-span-2 font-body-md text-body-md text-on-surface-variant">
        {listing.status === "brouillon" ? "—" : `${days} jour${days > 1 ? "s" : ""}`}
      </span>
      <div className="md:col-span-2 flex items-center justify-end gap-space-xs">
        {listing.status !== "brouillon" && (
          <Link
            href={ADOPTION_ROUTES.received(listing.id)}
            className="hidden sm:inline-flex items-center h-9 px-space-md rounded-full bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors whitespace-nowrap"
          >
            Voir les candidatures
          </Link>
        )}
        <RowMenu listing={listing} onArchive={onArchive} onRepublish={onRepublish} onDelete={onDelete} />
      </div>
    </li>
  );
}

function ApplicationsBadge({ total, fresh }: { total: number; fresh: number }) {
  return (
    <span className="inline-flex items-center gap-space-xs flex-wrap">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container text-on-surface font-label-sm text-label-sm">
        <Icon name="group" className="text-[14px]" />
        {total} candidature{total > 1 ? "s" : ""}
      </span>
      {fresh > 0 && (
        <span className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant font-label-sm text-label-sm">
          {fresh} nouvelle{fresh > 1 ? "s" : ""}
        </span>
      )}
    </span>
  );
}

function RowMenu({
  listing,
  onArchive,
  onRepublish,
  onDelete,
}: {
  listing: AdoptionListing;
  onArchive: () => void;
  onRepublish: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const item = "w-full flex items-center gap-space-sm px-space-md py-2 font-label-lg text-label-lg text-left hover:bg-surface-container-low";

  function confirmThen(text: string, action: () => void) {
    setOpen(false);
    if (window.confirm(text)) action();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Actions pour ${listing.name}`}
        aria-expanded={open}
        className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
      >
        <Icon name="more_vert" />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-30 w-56 py-space-xs bg-surface-container-lowest rounded-xl shadow-xl">
          {listing.status !== "brouillon" && (
            <Link href={ADOPTION_ROUTES.received(listing.id)} className={`${item} sm:hidden`}>
              <Icon name="group" className="text-[20px] text-primary" />
              Candidatures
            </Link>
          )}
          {listing.status !== "adoptee" && (
            <Link href={ADOPTION_ROUTES.edit(listing.id)} className={item}>
              <Icon name="edit" className="text-[20px] text-primary" />
              Modifier
            </Link>
          )}
          {(listing.status === "disponible" || listing.status === "reservee") && (
            <button
              type="button"
              className={item}
              onClick={() =>
                confirmThen(
                  `Archiver l'annonce de ${listing.name} ? Les candidatures en cours seront refusées et les candidats informés.`,
                  onArchive,
                )
              }
            >
              <Icon name="archive" className="text-[20px] text-on-surface-variant" />
              Archiver
            </button>
          )}
          {listing.status === "archivee" && (
            <button type="button" className={item} onClick={() => confirmThen(`Remettre en ligne l'annonce de ${listing.name} ?`, onRepublish)}>
              <Icon name="unarchive" className="text-[20px] text-primary" />
              Remettre en ligne
            </button>
          )}
          {listing.status === "brouillon" && (
            <button
              type="button"
              className={`${item} text-error`}
              onClick={() => confirmThen(`Supprimer définitivement le brouillon de ${listing.name} ?`, onDelete)}
            >
              <Icon name="delete" className="text-[20px]" />
              Supprimer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
