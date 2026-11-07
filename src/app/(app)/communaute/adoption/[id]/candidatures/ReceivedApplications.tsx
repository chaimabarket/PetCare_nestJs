"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AnswerCard, householdRows, housingRows, lifestyleRows, MotivationQuote } from "@/components/adoption/ApplicationParts";
import { Dialog } from "@/components/adoption/Dialog";
import { useAsync } from "@/components/adoption/hooks";
import {
  ApplicationStatusPill,
  Breadcrumb,
  ButtonLink,
  CompatibilityGauge,
  EmptyState,
  ListingStatusPill,
  PageLoading,
  Photo,
} from "@/components/adoption/ui";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import {
  acceptApplication,
  ADOPTION_ROUTES,
  cancelAcceptance,
  confirmAdoption,
  formatDate,
  getListing,
  listReceivedApplications,
  markInReview,
  PENDING_STATUSES,
  refuseApplication,
  type AdoptionApplication,
  type AdoptionListing,
  type ApplicationStatus,
} from "@/lib/adoption";
import { computeCompatibility, type CompatibilityResult } from "@/lib/adoption-compatibility";
import { errorMessage } from "@/lib/users";

type Filter = "all" | "new" | "review" | "accepted" | "closed";
type Sort = "compatibility" | "recent";

const FILTERS: { key: Filter; label: string; statuses: ApplicationStatus[] }[] = [
  { key: "all", label: "Toutes", statuses: [] },
  { key: "new", label: "Nouvelles", statuses: ["envoyee"] },
  { key: "review", label: "En étude", statuses: ["en-etude"] },
  { key: "accepted", label: "Acceptées", statuses: ["acceptee", "adoptee"] },
  { key: "closed", label: "Refusées / retirées", statuses: ["refusee", "retiree"] },
];

type Scored = AdoptionApplication & { result: CompatibilityResult };

export function ReceivedApplications({ id }: { id: string }) {
  return (
    <RequireAuth>
      <Loader id={id} />
    </RequireAuth>
  );
}

function Loader({ id }: { id: string }) {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const load = useCallback(async () => {
    const listing = await getListing(id);
    if (!listing || listing.ownerId !== uid) return null;
    return { listing, applications: await listReceivedApplications(id, uid) };
  }, [id, uid]);
  const { data, error, loading, reload } = useAsync(load);

  if (loading) return <PageLoading />;
  if (error) {
    return (
      <div className="max-w-xl mx-auto p-space-xl">
        <Alert>{error}</Alert>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="max-w-xl mx-auto p-space-xl">
        <EmptyState
          icon="lock"
          title="Accès réservé"
          text="Seul l'auteur de l'annonce peut consulter les candidatures."
          action={<ButtonLink href={ADOPTION_ROUTES.feed}>Retour aux adoptions</ButtonLink>}
        />
      </div>
    );
  }
  return <Applications listing={data.listing} applications={data.applications} reload={reload} />;
}

function Applications({
  listing,
  applications,
  reload,
}: {
  listing: AdoptionListing;
  applications: AdoptionApplication[];
  reload: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("compatibility");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>();

  const scored = useMemo<Scored[]>(
    () => applications.map((a) => ({ ...a, result: computeCompatibility(listing, a) })),
    [applications, listing],
  );
  const matches = (a: Scored, key: Filter) => key === "all" || FILTERS.find((f) => f.key === key)?.statuses.includes(a.status);
  const shown = scored
    .filter((a) => matches(a, filter))
    .filter((a) => !search.trim() || a.applicantName.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => (sort === "compatibility" ? b.result.score - a.result.score : 0));
  const selected = scored.find((a) => a.id === selectedId);
  const unseen = applications.filter((a) => a.status === "envoyee").length;

  return (
    <div className="max-w-7xl mx-auto px-margin md:px-margin-md lg:px-margin-lg py-space-lg">
      <Breadcrumb
        items={[
          { label: "Mes annonces d'adoption", href: ADOPTION_ROUTES.myListings },
          { label: listing.name, href: ADOPTION_ROUTES.listing(listing.id) },
          { label: "Candidatures" },
        ]}
      />

      <header className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col md:flex-row md:items-center gap-space-md mb-space-lg">
        <Photo src={listing.thumbnail} alt={listing.name} className="w-20 h-20 rounded-2xl shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-space-sm">
            <h1 className="font-headline-lg text-headline-lg">Candidatures pour {listing.name}</h1>
            <ListingStatusPill status={listing.status} />
          </div>
          <div className="mt-space-xs flex flex-wrap gap-space-xs">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container-low text-primary font-label-sm text-label-sm">
              <Icon name="inbox" className="text-[14px]" />
              {applications.length} candidature{applications.length > 1 ? "s" : ""} reçue{applications.length > 1 ? "s" : ""}
            </span>
            {unseen > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-label-sm text-label-sm">
                <Icon name="mark_email_unread" className="text-[14px]" />
                {unseen} non examinée{unseen > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        {listing.status !== "adoptee" && (
          <ButtonLink href={ADOPTION_ROUTES.edit(listing.id)} variant="secondary" icon="edit">
            Modifier l&apos;annonce
          </ButtonLink>
        )}
      </header>

      {applications.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="Aucune candidature pour l'instant"
          text={`Vous serez notifié(e) dès qu'une personne souhaitera adopter ${listing.name}.`}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
          <div className={`lg:col-span-4 flex-col gap-space-md ${selected ? "hidden lg:flex" : "flex"}`}>
            <div className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm flex flex-col gap-space-sm">
              <label className="flex items-center bg-surface-container-low rounded-xl px-space-md h-11">
                <Icon name="search" className="text-outline mr-space-sm" />
                <span className="sr-only">Rechercher un candidat</span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un candidat…"
                  className="w-full bg-transparent outline-none font-body-md text-body-md"
                />
              </label>
              <label className="flex items-center justify-between gap-space-sm font-label-sm text-label-sm text-on-surface-variant">
                <span className="flex items-center gap-1">
                  <Icon name="swap_vert" className="text-[16px]" />
                  Trier par
                </span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  className="bg-surface-container-low rounded-lg px-2 py-1.5 outline-none cursor-pointer text-on-surface"
                >
                  <option value="compatibility">Compatibilité</option>
                  <option value="recent">Plus récentes</option>
                </select>
              </label>
              <div className="flex gap-space-xs overflow-x-auto pb-1">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    aria-pressed={filter === f.key}
                    onClick={() => setFilter(f.key)}
                    className={`px-3 py-1 rounded-full font-label-sm text-label-sm shrink-0 ${
                      filter === f.key ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                    }`}
                  >
                    {f.label} ({scored.filter((a) => matches(a, f.key)).length})
                  </button>
                ))}
              </div>
            </div>
            <ul className="flex flex-col gap-space-sm">
              {shown.map((application) => (
                <li key={application.id}>
                  <ApplicantCard
                    application={application}
                    selected={selected?.id === application.id}
                    onSelect={() => setSelectedId(application.id)}
                  />
                </li>
              ))}
              {shown.length === 0 && (
                <li className="p-space-lg text-center font-body-md text-body-md text-on-surface-variant">Aucune candidature dans cette catégorie.</li>
              )}
            </ul>
          </div>

          <section className={`lg:col-span-8 flex-col gap-space-lg ${selected ? "flex" : "hidden lg:flex"}`}>
            {selected ? (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedId(undefined)}
                  className="lg:hidden self-start inline-flex items-center gap-1 font-label-lg text-label-lg text-primary"
                >
                  <Icon name="arrow_back" className="text-[18px]" />
                  Retour à la liste
                </button>
                <ApplicationReview
                  key={selected.id}
                  listing={listing}
                  application={selected}
                  all={applications}
                  onChanged={reload}
                />
              </>
            ) : (
              <div className="bg-surface-container-lowest rounded-2xl p-space-2xl shadow-sm text-center text-on-surface-variant flex flex-col items-center gap-space-sm">
                <Icon name="touch_app" className="text-[40px] text-primary" />
                Sélectionnez une candidature pour l&apos;examiner.
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function ApplicantCard({ application, selected, onSelect }: { application: Scored; selected: boolean; onSelect: () => void }) {
  const isNew = application.status === "envoyee";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected}
      className={`w-full text-left bg-surface-container-lowest rounded-2xl p-space-md shadow-sm flex flex-col gap-space-sm transition-all relative overflow-hidden ${
        selected ? "ring-2 ring-primary-container bg-primary/5" : "hover:shadow-md"
      } ${application.status === "refusee" || application.status === "retiree" ? "opacity-70" : ""}`}
    >
      {selected && <span className="absolute left-0 inset-y-0 w-1.5 bg-primary-container" />}
      <div className="flex items-start gap-space-sm">
        <Avatar name={application.applicantName} className="w-11 h-11 text-label-lg shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="flex items-center gap-space-xs font-headline-sm text-headline-sm truncate">
            {application.applicantName}
            {isNew && <span className="px-1.5 py-0.5 rounded-md bg-primary text-on-primary font-label-sm text-label-sm">Nouveau</span>}
          </p>
          <p className="flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant">
            <Icon name="location_on" className="text-[14px]" />
            {application.applicantCity}
          </p>
        </div>
        <CompatibilityGauge score={application.result.score} size={48} />
      </div>
      <ul className="flex flex-wrap gap-x-space-sm gap-y-1">
        {application.result.checks.slice(0, 3).map((check) => (
          <li
            key={check.key}
            className={`flex items-center gap-1 font-label-sm text-label-sm ${check.ok ? "text-emerald-700" : "text-amber-700"}`}
          >
            <Icon name={check.ok ? "check_circle" : "warning"} className="text-[14px]" />
            {check.label}
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-space-sm">
        <ApplicationStatusPill status={application.status} />
        <span className="font-label-sm text-label-sm text-on-surface-variant">Reçue le {formatDate(application.createdAt)}</span>
      </div>
    </button>
  );
}

function ApplicationReview({
  listing,
  application,
  all,
  onChanged,
}: {
  listing: AdoptionListing;
  application: Scored;
  all: AdoptionApplication[];
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const { result } = application;
  const otherAccepted = listing.acceptedApplicationId && listing.acceptedApplicationId !== application.id;
  const openOthers = all.filter(
    (a) => a.id !== application.id && (PENDING_STATUSES.includes(a.status) || a.status === "acceptee"),
  ).length;

  // Première ouverture : la candidature passe « En étude » (le candidat est informé).
  const reviewStarted = useRef(false);
  useEffect(() => {
    if (application.status !== "envoyee" || reviewStarted.current) return;
    reviewStarted.current = true;
    markInReview(application).then(onChanged, (err) => console.error("Passage en étude impossible :", err));
  }, [application, onChanged]);

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    setError("");
    try {
      await action();
      onChanged();
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function confirm() {
    const ok = await run("confirm", () => confirmAdoption(listing, application, all));
    if (ok) setCelebrate(true);
  }

  return (
    <>
      <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col md:flex-row md:items-center gap-space-lg">
        <div className="flex items-center gap-space-md flex-1 min-w-0">
          <Avatar name={application.applicantName} className="w-16 h-16 text-headline-sm shrink-0" />
          <div className="min-w-0">
            <h2 className="font-headline-md text-headline-md truncate">{application.applicantName}</h2>
            <p className="flex items-center gap-1 font-body-md text-body-md text-on-surface-variant">
              <Icon name="location_on" className="text-[16px]" />
              {application.applicantCity} · Reçue le {formatDate(application.createdAt)}
            </p>
            <ApplicationStatusPill status={application.status} className="mt-space-xs" />
          </div>
        </div>
        <div className="flex items-center gap-space-md p-space-md rounded-2xl bg-primary/5 md:max-w-xs">
          <CompatibilityGauge score={result.score} size={72} />
          <div>
            <p className="font-label-lg text-label-lg">{result.score} % de compatibilité</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Aide à la décision, pas un verdict</p>
          </div>
        </div>
      </div>

      <section className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-sm">
        <h3 className="flex items-center gap-space-xs font-headline-sm text-headline-sm">
          <Icon name="fact_check" className="text-primary text-[22px]" />
          Points de compatibilité
        </h3>
        <ul className="flex flex-col gap-space-xs">
          {result.checks.map((check) => (
            <li
              key={check.key}
              className={`flex items-start gap-space-sm p-space-sm rounded-xl font-body-md text-body-md ${
                check.ok ? "bg-emerald-50/70 text-emerald-900" : "bg-amber-50 text-amber-900"
              }`}
            >
              <Icon name={check.ok ? "check_circle" : "warning"} className={`text-[20px] ${check.ok ? "text-emerald-600" : "text-amber-500"}`} />
              {check.detail}
            </li>
          ))}
        </ul>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-space-md">
        <AnswerCard icon="home" title="Logement" rows={housingRows(application)} />
        <AnswerCard icon="groups" title="Foyer" rows={householdRows(application)} />
        <AnswerCard icon="directions_walk" title="Mode de vie" rows={lifestyleRows(application)} />
        <section className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-sm">
          <h3 className="flex items-center gap-space-xs font-headline-sm text-headline-sm">
            <Icon name="favorite" className="text-primary text-[22px]" />
            Motivation
          </h3>
          <MotivationQuote text={application.lifestyle.motivation} author={application.applicantName} />
        </section>
      </div>

      <section className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-md">
        {error && <Alert>{error}</Alert>}

        {PENDING_STATUSES.includes(application.status) && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
            <div>
              <h3 className="font-headline-sm text-headline-sm">Instruction du dossier</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {otherAccepted
                  ? `Une autre candidature est déjà acceptée : ${listing.name} est réservé(e).`
                  : "Prenez une décision ; le candidat sera notifié."}
              </p>
            </div>
            <div className="flex gap-space-sm">
              <Button
                type="button"
                variant="secondary"
                loading={busy === "refuse"}
                disabled={Boolean(busy)}
                onClick={() => {
                  if (window.confirm(`Refuser la candidature de ${application.applicantName} ?`)) run("refuse", () => refuseApplication(application));
                }}
              >
                Refuser
              </Button>
              <Button
                type="button"
                icon="check"
                loading={busy === "accept"}
                disabled={Boolean(busy) || Boolean(otherAccepted) || listing.status !== "disponible"}
                onClick={() => run("accept", () => acceptApplication(listing, application))}
              >
                Accepter
              </Button>
            </div>
          </div>
        )}

        {application.status === "acceptee" && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md p-space-md rounded-2xl bg-emerald-50">
            <div className="flex items-start gap-space-sm">
              <Icon name="check_circle" filled className="text-emerald-600 text-[32px]" />
              <div>
                <h3 className="font-headline-sm text-headline-sm text-emerald-900">Candidature acceptée – {listing.name} est réservé(e)</h3>
                <p className="font-body-sm text-body-sm text-emerald-800">
                  {listing.name} ne reçoit plus de nouvelles candidatures. Confirmez l&apos;adoption après la rencontre.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-space-sm">
              <Button
                type="button"
                variant="ghost"
                loading={busy === "cancel"}
                disabled={Boolean(busy)}
                onClick={() => {
                  if (window.confirm("Annuler l'acceptation ? L'animal redeviendra disponible.")) run("cancel", () => cancelAcceptance(listing, application));
                }}
              >
                Annuler l&apos;acceptation
              </Button>
              <Button type="button" variant="coral" disabled={Boolean(busy)} onClick={() => setConfirmOpen(true)}>
                Confirmer l&apos;adoption
              </Button>
            </div>
          </div>
        )}

        {application.status === "adoptee" && (
          <p className="flex items-center gap-space-sm p-space-md rounded-2xl bg-secondary-fixed/50 text-on-secondary-fixed-variant font-label-lg text-label-lg">
            <Icon name="celebration" className="text-[24px]" />
            {listing.name} a été adopté(e) par {application.applicantName}.
          </p>
        )}
        {(application.status === "refusee" || application.status === "retiree") && (
          <p className="font-body-md text-body-md text-on-surface-variant">
            {application.status === "refusee" ? "Cette candidature a été refusée." : "Le candidat a retiré sa candidature."}
          </p>
        )}
      </section>

      <Dialog
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setCelebrate(false);
        }}
        title={celebrate ? `${listing.name} a trouvé sa famille ! 🎉` : `Confirmer l'adoption de ${listing.name} par ${application.applicantName} ?`}
      >
        {celebrate ? (
          <div className="flex flex-col items-center text-center gap-space-md">
            <span className="w-20 h-20 rounded-full bg-secondary-fixed flex items-center justify-center">
              <Icon name="celebration" filled className="text-[#E07A5F] text-[44px]" />
            </span>
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              Merci pour votre engagement. {application.applicantName} a été notifié(e) et pourra partager son Happy Tail.
            </p>
            <ButtonLink href={ADOPTION_ROUTES.myListings}>Retour à mes annonces</ButtonLink>
          </div>
        ) : (
          <>
            <div className="flex justify-center">
              <span className="w-16 h-16 rounded-full bg-secondary-fixed flex items-center justify-center">
                <Icon name="favorite" filled className="text-[#E07A5F] text-[34px]" />
              </span>
            </div>
            <ul className="flex flex-col gap-space-sm font-body-md text-body-md">
              <li className="flex items-start gap-space-sm">
                <Icon name="swap_horiz" className="text-primary text-[20px]" />
                L&apos;annonce de {listing.name} passera au statut « Adopté ».
              </li>
              <li className="flex items-start gap-space-sm">
                <Icon name="health_and_safety" className="text-primary text-[20px]" />
                Le carnet de santé ne sera pas transmis.
              </li>
              <li className="flex items-start gap-space-sm">
                <Icon name="group_remove" className="text-primary text-[20px]" />
                {openOthers > 0
                  ? `Les ${openOthers} autre${openOthers > 1 ? "s" : ""} candidature${openOthers > 1 ? "s" : ""} ser${openOthers > 1 ? "ont refusées" : "a refusée"} et les candidats informés.`
                  : "Aucune autre candidature en cours."}
              </li>
            </ul>
            {error && <Alert>{error}</Alert>}
            <div className="flex justify-end gap-space-sm">
              <Button type="button" variant="ghost" onClick={() => setConfirmOpen(false)}>
                Annuler
              </Button>
              <Button type="button" variant="coral" loading={busy === "confirm"} onClick={confirm}>
                Confirmer
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}
