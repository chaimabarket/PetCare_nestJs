"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { RequireAuth } from "@/components/auth/RequireAuth";
import {
  AnswerCard,
  householdRows,
  housingRows,
  lifestyleRows,
  MotivationQuote,
  TimelineStepper,
  VerticalTimeline,
} from "@/components/adoption/ApplicationParts";
import { useAsync } from "@/components/adoption/hooks";
import { ApplicationStatusPill, Breadcrumb, ButtonLink, EmptyState, PageLoading, Photo } from "@/components/adoption/ui";
import { Alert } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import {
  ADOPTION_ROUTES,
  formatDate,
  listMyApplications,
  PENDING_STATUSES,
  withdrawApplication,
  type AdoptionApplication,
  type ApplicationStatus,
} from "@/lib/adoption";
import { errorMessage } from "@/lib/users";

type Filter = "all" | "pending" | "accepted" | "adopted" | "closed";

const FILTERS: { key: Filter; label: string; statuses: ApplicationStatus[] }[] = [
  { key: "all", label: "Toutes", statuses: [] },
  { key: "pending", label: "En cours", statuses: ["envoyee", "en-etude"] },
  { key: "accepted", label: "Acceptées", statuses: ["acceptee"] },
  { key: "adopted", label: "Adoptées", statuses: ["adoptee"] },
  { key: "closed", label: "Terminées / Refusées", statuses: ["refusee", "retiree"] },
];

export default function MyApplicationsPage() {
  return (
    <RequireAuth>
      <MyApplications />
    </RequireAuth>
  );
}

function MyApplications() {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const load = useCallback(() => listMyApplications(uid), [uid]);
  const { data, error, loading, reload } = useAsync(load);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string>();
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState<string>();

  const applications = data ?? [];
  const matches = (a: AdoptionApplication, key: Filter) =>
    key === "all" || FILTERS.find((f) => f.key === key)?.statuses.includes(a.status);
  const shown = applications.filter((a) => matches(a, filter));
  const selected = shown.find((a) => a.id === selectedId) ?? shown[0];

  async function withdraw(application: AdoptionApplication) {
    if (!window.confirm(`Retirer votre candidature pour ${application.animalName} ?`)) return;
    setBusyId(application.id);
    setActionError("");
    try {
      await withdrawApplication(application);
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusyId(undefined);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-margin md:px-margin-md lg:px-margin-lg py-space-lg">
      <Breadcrumb items={[{ label: "Adoption", href: ADOPTION_ROUTES.feed }, { label: "Mes candidatures d'adoption" }]} />
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md mb-space-lg">
        <div>
          <div className="flex items-center gap-space-sm">
            <h1 className="font-headline-lg text-headline-lg">Mes candidatures d&apos;adoption</h1>
            {applications.length > 0 && (
              <span className="px-space-sm py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm">
                {applications.length} dossier{applications.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="font-body-lg text-body-lg text-on-surface-variant">Suivez l&apos;avancement de vos demandes d&apos;adoption.</p>
        </div>
        <ButtonLink href={ADOPTION_ROUTES.feed} variant="secondary" icon="search">
          Explorer les adoptions
        </ButtonLink>
      </div>

      <div className="flex items-center gap-space-xs overflow-x-auto pb-space-xs mb-space-lg" role="tablist">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.key)}
              className={`px-space-md py-2 rounded-full font-label-md text-label-md shrink-0 transition-colors ${
                active ? "bg-primary text-on-primary" : "bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container shadow-sm"
              }`}
            >
              {f.label} ({applications.filter((a) => matches(a, f.key)).length})
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
          icon="assignment"
          title="Aucune candidature"
          text="Quand vous candidaterez pour adopter un animal, vous suivrez ici chaque étape."
          action={<ButtonLink href={ADOPTION_ROUTES.feed}>Découvrir les animaux</ButtonLink>}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
          <ul className="lg:col-span-5 flex flex-col gap-space-md">
            {shown.map((application) => (
              <li key={application.id}>
                <ApplicationCard
                  application={application}
                  selected={selected?.id === application.id}
                  onSelect={() => setSelectedId(application.id)}
                  onWithdraw={() => withdraw(application)}
                  busy={busyId === application.id}
                />
              </li>
            ))}
          </ul>
          {selected && (
            <section className="hidden lg:flex lg:col-span-7 flex-col gap-space-lg sticky top-20">
              <ApplicationDetail application={selected} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function ApplicationCard({
  application,
  selected,
  onSelect,
  onWithdraw,
  busy,
}: {
  application: AdoptionApplication;
  selected: boolean;
  onSelect: () => void;
  onWithdraw: () => void;
  busy: boolean;
}) {
  const refused = application.status === "refusee" || application.status === "retiree";
  return (
    <article
      onClick={onSelect}
      className={`bg-surface-container-lowest rounded-2xl p-space-md shadow-sm flex flex-col gap-space-md cursor-pointer transition-all ${
        selected ? "lg:ring-2 lg:ring-primary-container" : "hover:shadow-md"
      } ${refused ? "opacity-80" : ""}`}
    >
      <div className="flex items-start gap-space-md">
        <Photo src={application.animalThumbnail} alt={application.animalName} className={`w-16 h-16 rounded-xl shrink-0 ${refused ? "grayscale" : ""}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-space-sm">
            <Link
              href={ADOPTION_ROUTES.listing(application.listingId)}
              onClick={(e) => e.stopPropagation()}
              className="font-headline-sm text-headline-sm hover:text-primary truncate"
            >
              {application.animalName}
            </Link>
            <ApplicationStatusPill status={application.status} />
          </div>
          <p className="flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant">
            <Icon name="verified" className="text-[16px] text-primary" />
            {application.ownerName}
          </p>
        </div>
      </div>

      {application.status === "adoptee" && (
        <ButtonLink href={ADOPTION_ROUTES.shareHappyTail(application.listingId)} variant="coral" icon="favorite" className="w-full">
          Partager mon Happy Tail
        </ButtonLink>
      )}
      {application.status === "acceptee" && (
        <p className="flex items-start gap-space-xs p-space-sm rounded-xl bg-emerald-50 text-emerald-800 font-body-sm text-body-sm">
          <Icon name="event_available" className="text-[18px]" />
          Candidature acceptée ! Contactez {application.ownerName} pour organiser la rencontre.
        </p>
      )}

      <div className="p-space-sm rounded-xl bg-surface-container-low/60">
        <TimelineStepper status={application.status} />
      </div>

      <div className="flex items-center justify-between gap-space-sm font-body-sm text-body-sm text-on-surface-variant">
        <span>Envoyée le {formatDate(application.createdAt)}</span>
        {PENDING_STATUSES.includes(application.status) && (
          <button
            type="button"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              onWithdraw();
            }}
            className="inline-flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-error disabled:opacity-60"
          >
            <Icon name={busy ? "progress_activity" : "cancel"} className={`text-[16px] ${busy ? "animate-spin" : ""}`} />
            Retirer ma candidature
          </button>
        )}
      </div>
    </article>
  );
}

function ApplicationDetail({ application }: { application: AdoptionApplication }) {
  return (
    <>
      <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex items-center gap-space-md">
        <Photo src={application.animalThumbnail} alt={application.animalName} className="w-20 h-20 rounded-2xl shrink-0" />
        <div className="flex-1 min-w-0">
          <h2 className="font-headline-md text-headline-md">{application.animalName}</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">{application.ownerName}</p>
        </div>
        <ButtonLink href={ADOPTION_ROUTES.listing(application.listingId)} variant="secondary">
          Voir l&apos;annonce
        </ButtonLink>
      </div>
      <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-lg">
        <h2 className="flex items-center gap-space-xs font-headline-sm text-headline-sm">
          <Icon name="timeline" className="text-primary" />
          Parcours de votre dossier
        </h2>
        <VerticalTimeline application={application} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-space-md">
        <AnswerCard icon="home" title="Logement" rows={housingRows(application)} />
        <AnswerCard icon="groups" title="Foyer" rows={householdRows(application)} />
        <AnswerCard icon="directions_walk" title="Mode de vie" rows={lifestyleRows(application)} />
        <section className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-sm">
          <h3 className="flex items-center gap-space-xs font-headline-sm text-headline-sm">
            <Icon name="favorite" className="text-primary text-[22px]" />
            Motivation
          </h3>
          <MotivationQuote text={application.lifestyle.motivation} />
        </section>
      </div>
    </>
  );
}
