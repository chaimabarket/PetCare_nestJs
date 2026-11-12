"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AvailabilityEditor } from "@/components/services/AvailabilityEditor";
import { BookingCard, BookingFilters, filterBookings, type BookingFilter } from "@/components/services/BookingCard";
import { ProviderProfileForm } from "@/components/services/ProviderProfileForm";
import { ServiceDialog } from "@/components/services/ServiceDialog";
import { Breadcrumb, categoryIcon, ErrorState, LoadingState, Pill, ProviderPhoto, useLoad, VerifiedBadge } from "@/components/services/ui";
import { Icon } from "@/components/ui/Icon";
import {
  formatDuration,
  formatPrice,
  getMyProvider,
  listBookings,
  listCategories,
  SERVICES_ROUTES,
  updateService,
  zonedParts,
  type ProviderDetail,
  type ProviderService,
  type ServiceBooking,
  type ServiceCategory,
} from "@/lib/services";
import { errorMessage } from "@/lib/users";

type Tab = "dashboard" | "planning";
type Data = { provider: ProviderDetail | null; categories: ServiceCategory[]; bookings: ServiceBooking[] };

export default function ProviderSpacePage() {
  return (
    <RequireAuth roles={["prestataire"]}>
      <ProviderSpace />
    </RequireAuth>
  );
}

/** Espace prestataire (maquettes tableau_de_bord_prestataire et disponibilit_s_r_servations_prestataire). */
function ProviderSpace() {
  const { profile } = useAuth();
  const load = useCallback(async (): Promise<Data> => {
    const [provider, categories] = await Promise.all([getMyProvider(), listCategories()]);
    return { provider, categories, bookings: provider ? await listBookings("provider") : [] };
  }, []);
  const { data, error, loading, reload, replace } = useLoad<Data>(load);
  // Le lien des notifications (« #demandes ») ouvre directement l'onglet des réservations.
  const [tab, setTab] = useState<Tab>(() =>
    typeof window !== "undefined" && ["#demandes", "#disponibilites"].includes(window.location.hash) ? "planning" : "dashboard",
  );

  if (loading && !data) return <LoadingState />;
  if (error || !data) return <div className="max-w-5xl mx-auto px-margin py-space-xl"><ErrorState message={error ?? "Erreur"} onRetry={reload} /></div>;

  const { provider, categories, bookings } = data;
  const pendingCount = bookings.filter((b) => b.status === "pending" && new Date(b.dateTime) > new Date()).length;

  return (
    <div className="max-w-5xl mx-auto w-full px-margin md:px-margin-md lg:px-margin-lg py-space-xl flex flex-col gap-space-lg">
      <Breadcrumb items={[{ label: "Services", href: SERVICES_ROUTES.directory }, { label: "Mon espace prestataire" }]} />
      <div className="flex flex-wrap items-end justify-between gap-space-md">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Tableau de bord</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">Gérez votre fiche, vos prestations, vos horaires et les demandes de vos clients.</p>
        </div>
        {provider && (
          <Link href={SERVICES_ROUTES.provider(provider.id)} className="h-11 px-5 rounded-xl bg-surface-container-lowest shadow-sm text-on-surface font-label-md text-label-md inline-flex items-center gap-2">
            <Icon name="visibility" className="text-[18px]" />
            Voir ma fiche publique
          </Link>
        )}
      </div>

      {!provider ? (
        <section className="bg-surface-container-lowest rounded-2xl p-space-lg md:p-space-xl shadow-sm flex flex-col gap-space-lg">
          <div className="flex items-start gap-space-md">
            <span className="w-12 h-12 rounded-xl bg-primary-fixed/50 text-primary flex items-center justify-center shrink-0">
              <Icon name="storefront" className="text-[26px]" />
            </span>
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface">Créez votre profil prestataire</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Toiletteur, vétérinaire, promeneur, pension… présentez votre activité. L&apos;équipe PetCare valide votre profil avant sa
                publication dans l&apos;annuaire.
              </p>
            </div>
          </div>
          <ProviderProfileForm
            categories={categories}
            defaultEmail={profile?.email}
            onSaved={() => reload()}
          />
        </section>
      ) : (
        <>
          <div role="tablist" className="inline-flex self-start p-1 bg-surface-container-low rounded-xl">
            {(["dashboard", "planning"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg font-label-md text-label-md inline-flex items-center gap-2 ${tab === t ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant"}`}
              >
                {t === "dashboard" ? "Profil & prestations" : "Disponibilités & réservations"}
                {t === "planning" && pendingCount > 0 && (
                  <span className="min-w-5 h-5 px-1.5 rounded-full bg-secondary text-on-secondary text-[11px] font-bold flex items-center justify-center">{pendingCount}</span>
                )}
              </button>
            ))}
          </div>
          {tab === "dashboard" ? (
            <Dashboard data={{ provider, categories, bookings }} onChange={replace} reload={reload} pendingCount={pendingCount} onShowRequests={() => setTab("planning")} />
          ) : (
            <Planning data={{ provider, categories, bookings }} onChange={replace} />
          )}
        </>
      )}
    </div>
  );
}

function Dashboard({
  data,
  onChange,
  reload,
  pendingCount,
  onShowRequests,
}: {
  data: Data & { provider: ProviderDetail };
  onChange: (d: Data) => void;
  reload: () => void;
  pendingCount: number;
  onShowRequests: () => void;
}) {
  const { provider, categories, bookings } = data;
  const [editing, setEditing] = useState(false);
  const [dialog, setDialog] = useState<{ service?: ProviderService } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const icon = categoryIcon(categories, provider.category);
  const month = zonedParts(new Date()).day.slice(0, 7);
  const thisMonth = bookings.filter((b) => b.status === "confirmed" && zonedParts(new Date(b.dateTime)).day.startsWith(month)).length;
  const services = [...provider.services].sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name, "fr") : a.status === "published" ? -1 : 1));
  const online = services.filter((s) => s.status === "published").length;

  const setService = (service: ProviderService) =>
    onChange({ ...data, provider: { ...provider, services: provider.services.some((s) => s.id === service.id) ? provider.services.map((s) => (s.id === service.id ? service : s)) : [...provider.services, service] } });

  async function toggleArchive(service: ProviderService) {
    setBusyId(service.id);
    setError("");
    try {
      const { name, category, durationMinutes, price, description } = service;
      setService(await updateService(service.id, { name, category, durationMinutes, price, description, status: service.status === "published" ? "archived" : "published" }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
      <div className="lg:col-span-5 flex flex-col gap-space-lg">
        {/* Statut du profil */}
        <section className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-md">
          {provider.status === "published" && (
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-label-lg text-label-lg text-primary">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Profil en ligne &amp; visible
              </span>
              <VerifiedBadge />
            </div>
          )}
          {provider.status === "pending" && (
            <div className="flex flex-col gap-2">
              <Pill tone="amber">En attente de validation</Pill>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                L&apos;équipe PetCare vérifie votre profil. Il apparaîtra dans l&apos;annuaire après validation ; vous recevrez une notification.
              </p>
            </div>
          )}
          {provider.status === "rejected" && (
            <div className="flex flex-col gap-2">
              <Pill tone="red">Profil refusé</Pill>
              <p className="font-body-sm text-body-sm text-on-surface">Motif : {provider.rejectionReason}</p>
              <button type="button" onClick={() => setEditing(true)} className="self-start h-10 px-4 rounded-xl bg-primary text-on-primary font-label-md text-label-md">
                Corriger mon profil
              </button>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 text-center">
            <button type="button" onClick={onShowRequests} className="rounded-xl bg-surface-container-low p-3 hover:bg-surface-container">
              <span className="block font-headline-md text-headline-md text-secondary">{pendingCount}</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">en attente</span>
            </button>
            <span className="rounded-xl bg-surface-container-low p-3">
              <span className="block font-headline-md text-headline-md text-primary">{thisMonth}</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">confirmées ce mois</span>
            </span>
            <span className="rounded-xl bg-surface-container-low p-3">
              <span className="block font-headline-md text-headline-md text-on-surface">{online}</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">prestations en ligne</span>
            </span>
          </div>
        </section>

        {/* Informations pro */}
        <section className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-md">
          {editing ? (
            <ProviderProfileForm
              provider={provider}
              categories={categories}
              onCancel={() => setEditing(false)}
              onSaved={() => {
                setEditing(false);
                reload();
              }}
            />
          ) : (
            <>
              <div className="flex items-start gap-space-md">
                <ProviderPhoto provider={provider} icon={icon} className="w-16 h-16" />
                <div className="min-w-0">
                  <h2 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-1">
                    {provider.name}
                    {provider.status === "published" && <Icon name="verified" className="text-[18px] text-primary" />}
                  </h2>
                  <p className="font-label-md text-label-md text-secondary">{provider.category}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1">
                    <Icon name="location_on" className="text-[16px]" />
                    {[provider.address, provider.city].filter(Boolean).join(", ")}
                  </p>
                </div>
              </div>
              {provider.description && <p className="font-body-md text-body-md text-on-surface line-clamp-4">{provider.description}</p>}
              <div className="rounded-xl bg-surface-container-low p-space-md flex flex-col gap-1 font-body-sm text-body-sm">
                <span className="flex items-center gap-2"><Icon name="call" className="text-[16px] text-on-surface-variant" />{provider.phone}</span>
                <span className="flex items-center gap-2"><Icon name="mail" className="text-[16px] text-on-surface-variant" />{provider.email}</span>
              </div>
              <button type="button" onClick={() => setEditing(true)} className="h-11 rounded-xl bg-primary-fixed/40 text-on-primary-fixed-variant font-label-md text-label-md inline-flex items-center justify-center gap-2">
                <Icon name="edit" className="text-[18px]" />
                Modifier mes informations pro
              </button>
            </>
          )}
        </section>

        <p className="rounded-2xl bg-secondary-fixed/60 text-on-secondary-fixed p-space-md font-body-sm text-body-sm flex items-start gap-2">
          <Icon name="payments" className="text-[20px]" />
          <span>
            <strong className="block">Règlement direct sur place</strong>
            Aucun paiement en ligne : vos clients règlent le jour du rendez-vous.
          </span>
        </p>
      </div>

      {/* Prestations */}
      <section className="lg:col-span-7 flex flex-col gap-space-md">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
            Mes prestations
            <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm">{services.length} service{services.length > 1 ? "s" : ""}</span>
          </h2>
          <button type="button" onClick={() => setDialog({})} className="inline-flex items-center gap-1 font-label-md text-label-md text-primary hover:underline">
            <Icon name="add_circle" className="text-[20px]" />
            Ajouter
          </button>
        </div>
        {services.length === 0 && (
          <p className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm text-on-surface-variant">
            Ajoutez vos prestations (ex. « Bain complet & démêlage doux, 45 min, 35 DT ») : vos clients pourront les réserver.
          </p>
        )}
        {services.map((s) => (
          <article key={s.id} className={`bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col gap-2 ${s.status === "archived" ? "opacity-75" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">{s.category}</span>
              {s.status === "published" ? <Pill tone="green">Actif</Pill> : <Pill tone="grey">Archivé</Pill>}
            </div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">{s.name}</h3>
            <div className="flex gap-4 font-body-sm text-body-sm text-on-surface-variant">
              <span className="flex items-center gap-1"><Icon name="schedule" className="text-[16px]" />{formatDuration(s.durationMinutes)}</span>
              <span className="flex items-center gap-1"><Icon name="payments" className="text-[16px]" />{formatPrice(s.price)}</span>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDialog({ service: s })} className="h-10 px-4 rounded-xl bg-primary-fixed/40 text-on-primary-fixed-variant font-label-md text-label-md inline-flex items-center gap-1">
                <Icon name="edit" className="text-[16px]" />
                Modifier
              </button>
              <button
                type="button"
                disabled={busyId === s.id}
                onClick={() => toggleArchive(s)}
                className={`h-10 px-4 rounded-xl font-label-md text-label-md inline-flex items-center gap-1 disabled:opacity-60 ${
                  s.status === "published" ? "bg-surface-container text-on-surface" : "bg-primary text-on-primary"
                }`}
              >
                <Icon name={s.status === "published" ? "archive" : "unarchive"} className="text-[16px]" />
                {s.status === "published" ? "Archiver" : "Réactiver"}
              </button>
            </div>
          </article>
        ))}
        {error && <p role="alert" className="font-body-sm text-body-sm text-error">{error}</p>}
        <button type="button" onClick={() => setDialog({})} className="h-14 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg shadow-md hover:bg-primary-container inline-flex items-center justify-center gap-2">
          <Icon name="add" className="text-[22px]" />
          Créer une nouvelle prestation
        </button>
      </section>

      {dialog && (
        <ServiceDialog
          service={dialog.service}
          categories={categories}
          defaultCategory={provider.category}
          onClose={() => setDialog(null)}
          onSaved={(saved) => {
            setService(saved);
            setDialog(null);
          }}
        />
      )}
    </div>
  );
}

function Planning({ data, onChange }: { data: Data & { provider: ProviderDetail }; onChange: (d: Data) => void }) {
  const [filter, setFilter] = useState<BookingFilter>("pending");
  const { provider, bookings } = data;
  const visible = filterBookings(bookings, filter).sort((a, b) =>
    filter === "past" ? b.dateTime.localeCompare(a.dateTime) : a.dateTime.localeCompare(b.dateTime),
  );
  const pending = filterBookings(bookings, "pending").length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
      <div id="disponibilites" className="lg:col-span-5">
        <AvailabilityEditor initial={provider.availability} onSaved={(availability) => onChange({ ...data, provider: { ...provider, availability } })} />
      </div>
      <section id="demandes" className="lg:col-span-7 flex flex-col gap-space-md scroll-mt-24">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
            <Icon name="inbox" className="text-primary" />
            Réservations reçues
          </h2>
          {pending > 0 && <span className="px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm">{pending} en attente</span>}
        </div>
        <BookingFilters list={bookings} value={filter} onChange={setFilter} />
        {visible.length === 0 && (
          <p className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm text-on-surface-variant">
            {bookings.length ? "Aucune réservation dans cette catégorie." : "Aucune demande pour l'instant. Vérifiez que vos prestations et vos horaires sont en ligne."}
          </p>
        )}
        {visible.map((b) => (
          <BookingCard key={b.id} booking={b} as="provider" onChange={(updated) => onChange({ ...data, bookings: bookings.map((x) => (x.id === updated.id ? updated : x)) })} />
        ))}
      </section>
    </div>
  );
}
