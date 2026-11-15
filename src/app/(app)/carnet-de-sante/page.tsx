"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { ButtonLink, carnetHref, PageLoading, pageClass, PetThumb } from "@/components/sante/ui";
import { Alert, Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { formatRecordDate, todayIso } from "@/lib/health-records";
import { getHealthSummary, setDoseTaken } from "@/lib/health-records-api";
import {
  VACCINE_STATUS_INFO,
  type DashboardVaccine,
  type DoseItem,
  type HealthSummary,
  type PetHealthCard,
} from "@/lib/health-summary";
import { PET_ROUTES, speciesLine, type PetSpecies } from "@/lib/pets";

/** Onglet « Santé » : tableau de bord du jour, puis une carte par animal (les animaux archivés en bas). */
export default function SantePage() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoading label="Chargement…" />;
  if (!user) return <SignInInvite />;
  return <Sante />;
}

function SignInInvite() {
  return (
    <div className={pageClass}>
      <Card className="max-w-xl mx-auto flex flex-col items-center gap-space-md text-center p-space-xl">
        <span className="w-16 h-16 rounded-full bg-primary-fixed/50 text-primary flex items-center justify-center">
          <Icon name="health_and_safety" filled className="text-[32px]" />
        </span>
        <h1 className="font-headline-md text-headline-md text-on-surface">Le suivi santé de vos compagnons</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Connectez-vous pour retrouver les vaccins, traitements et prises du jour de vos animaux, et exporter leur carnet en PDF.
        </p>
        <div className="flex flex-col sm:flex-row gap-space-sm">
          <ButtonLink href="/connexion" icon="login">
            Se connecter
          </ButtonLink>
          <ButtonLink href="/inscription" variant="secondary">
            Créer un compte
          </ButtonLink>
        </div>
      </Card>
    </div>
  );
}

function Sante() {
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [error, setError] = useState("");
  const [doseError, setDoseError] = useState("");
  const [pending, setPending] = useState<Set<string>>(() => new Set());

  const load = useCallback(async () => {
    setError("");
    try {
      setSummary(await getHealthSummary(todayIso()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chargement impossible.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement initial depuis l'API
    load();
  }, [load]);

  /** Coche ou décoche une prise : affichage immédiat, annulé si le serveur refuse. */
  async function toggleDose(dose: DoseItem) {
    if (!summary) return;
    const key = `${dose.recordId}|${dose.time}`;
    const taken = !dose.taken;
    const apply = (value: boolean) =>
      setSummary((s) =>
        s && {
          ...s,
          doses: s.doses.map((d) => (d.recordId === dose.recordId && d.time === dose.time ? { ...d, taken: value } : d)),
          pets: s.pets.map((p) => (p.petId === dose.petId ? { ...p, dosesDone: p.dosesDone + (value ? 1 : -1) } : p)),
        },
      );
    setDoseError("");
    setPending((set) => new Set(set).add(key));
    apply(taken);
    try {
      await setDoseTaken(dose.recordId, summary.day, dose.time, taken);
    } catch (err) {
      apply(!taken);
      setDoseError(err instanceof Error ? err.message : "La prise n'a pas pu être enregistrée.");
    } finally {
      setPending((set) => {
        const next = new Set(set);
        next.delete(key);
        return next;
      });
    }
  }

  if (!summary) {
    return (
      <div className={pageClass}>
        <Header />
        {error ? (
          <Card className="flex flex-col items-start gap-space-md">
            <Alert>{error}</Alert>
            <button type="button" onClick={load} className="font-label-lg text-label-lg text-primary hover:underline">
              Réessayer
            </button>
          </Card>
        ) : (
          <PageLoading label="Chargement de vos animaux…" />
        )}
      </div>
    );
  }

  const active = summary.pets.filter((p) => !p.archived);
  const archived = summary.pets.filter((p) => p.archived);

  return (
    <div className={pageClass}>
      <Header />

      {summary.pets.length === 0 ? (
        <Card className="max-w-xl flex flex-col items-start gap-space-md p-space-xl">
          <Icon name="pets" className="text-[40px] text-outline" />
          <h2 className="font-headline-sm text-headline-sm">Aucun animal pour le moment</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Ajoutez votre premier compagnon dans « Mes animaux » : son carnet de santé sera créé avec sa fiche.
          </p>
          <ButtonLink href={PET_ROUTES.add} icon="add">
            Ajouter un animal
          </ButtonLink>
        </Card>
      ) : (
        <div className="flex flex-col gap-space-xl">
          {active.length > 0 && <Today summary={summary} pending={pending} error={doseError} onToggle={toggleDose} />}

          <section aria-labelledby="sante-animaux" className="flex flex-col gap-space-md">
            <h2 id="sante-animaux" className="font-headline-sm text-headline-sm text-on-surface">
              Mes animaux
            </h2>
            {active.length ? (
              <div className="grid gap-space-lg md:grid-cols-2 xl:grid-cols-3">
                {active.map((pet) => (
                  <PetCard key={pet.petId} pet={pet} />
                ))}
              </div>
            ) : (
              <Card className="flex flex-col items-start gap-space-sm">
                <p className="font-body-md text-body-md text-on-surface-variant">Tous vos animaux sont archivés.</p>
                <ButtonLink href={PET_ROUTES.add} icon="add" variant="secondary">
                  Ajouter un animal
                </ButtonLink>
              </Card>
            )}
          </section>

          {archived.length > 0 && (
            <details className="group rounded-2xl bg-surface-container-low">
              <summary className="flex cursor-pointer list-none items-center gap-space-sm p-space-md font-label-lg text-label-lg text-on-surface-variant">
                <Icon name="inventory_2" className="text-[20px]" />
                Animaux archivés ({archived.length}) · carnets en lecture seule
                <Icon name="expand_more" className="ml-auto transition-transform group-open:rotate-180" />
              </summary>
              <div className="grid gap-space-md p-space-md pt-0 md:grid-cols-2 xl:grid-cols-3">
                {archived.map((pet) => (
                  <PetCard key={pet.petId} pet={pet} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function Header() {
  return (
    <div className="flex flex-col gap-space-xs mb-space-xl max-w-2xl">
      <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">Santé</h1>
      <p className="font-body-lg text-body-lg text-on-surface-variant">
        Prises du jour, rappels de vaccins et carnets de santé de vos compagnons.
      </p>
    </div>
  );
}

/* ---------- Tableau de bord du jour ---------- */

function Today({
  summary,
  pending,
  error,
  onToggle,
}: {
  summary: HealthSummary;
  pending: Set<string>;
  error: string;
  onToggle: (dose: DoseItem) => void;
}) {
  const { doses, overdueVaccines, upcomingVaccines } = summary;
  const done = doses.filter((d) => d.taken).length;
  const nothing = !doses.length && !overdueVaccines.length && !upcomingVaccines.length;

  return (
    <section aria-labelledby="sante-jour" className="grid gap-space-lg lg:grid-cols-[1.4fr_1fr]">
      <Card className="flex flex-col gap-space-md">
        <div className="flex flex-wrap items-center justify-between gap-space-sm">
          <h2 id="sante-jour" className="flex items-center gap-space-sm font-headline-sm text-headline-sm text-on-surface">
            <Icon name="today" className="text-primary" />
            Aujourd&apos;hui
          </h2>
          <span className="font-label-md text-label-md text-on-surface-variant capitalize">
            {formatRecordDate(summary.day, { weekday: "long", day: "numeric", month: "long" })}
          </span>
        </div>
        {error && <Alert>{error}</Alert>}
        {doses.length ? (
          <>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Prises notées : <strong className="text-on-surface">{done} / {doses.length}</strong>
            </p>
            <ul className="flex flex-col gap-space-xs">
              {doses.map((dose) => {
                const key = `${dose.recordId}|${dose.time}`;
                return (
                  <li key={key}>
                    <label
                      className={`flex items-center gap-space-sm rounded-xl p-space-sm transition-colors cursor-pointer ${
                        dose.taken ? "bg-surface-container-low" : "bg-primary-fixed/25 hover:bg-primary-fixed/40"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={dose.taken}
                        disabled={pending.has(key)}
                        onChange={() => onToggle(dose)}
                        className="w-5 h-5 shrink-0 accent-primary"
                      />
                      <span className="w-14 shrink-0 font-label-lg text-label-lg text-primary">{dose.time}</span>
                      <PetThumb src={dose.petThumbnail} name={dose.petName} size="w-9 h-9" />
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate font-label-lg text-label-lg ${dose.taken ? "line-through text-on-surface-variant" : "text-on-surface"}`}>
                          {dose.title}
                        </span>
                        <span className="block truncate font-body-sm text-body-sm text-on-surface-variant">
                          {dose.petName}
                          {dose.dosage && ` · ${dose.dosage}`}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="font-body-md text-body-md text-on-surface-variant">
            {nothing ? "Rien à faire aujourd'hui : aucune prise ni rappel de vaccin proche." : "Aucune prise de traitement prévue aujourd'hui."}
          </p>
        )}
      </Card>

      <Card className="flex flex-col gap-space-md">
        <h2 className="flex items-center gap-space-sm font-headline-sm text-headline-sm text-on-surface">
          <Icon name="vaccines" className="text-primary" />
          Vaccins
        </h2>
        <VaccineList title="En retard" items={overdueVaccines} late />
        <VaccineList title="Dans les 30 prochains jours" items={upcomingVaccines} />
        {!overdueVaccines.length && !upcomingVaccines.length && (
          <p className="font-body-md text-body-md text-on-surface-variant">Aucun rappel en retard ni dans les 30 prochains jours.</p>
        )}
      </Card>
    </section>
  );
}

function VaccineList({ title, items, late }: { title: string; items: DashboardVaccine[]; late?: boolean }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-space-xs">
      <h3 className={`font-label-md text-label-md uppercase tracking-wide ${late ? "text-error" : "text-on-surface-variant"}`}>{title}</h3>
      <ul className="flex flex-col gap-space-xs">
        {items.map((v) => (
          <li key={v.recordId}>
            <Link
              href={`/animaux/${encodeURIComponent(v.petId)}/carnet-de-sante/${v.recordId}`}
              className={`flex items-center gap-space-sm rounded-xl p-space-sm hover:shadow-sm transition-shadow ${
                late ? "bg-error-container/40" : "bg-tertiary-fixed/40"
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-label-lg text-label-lg text-on-surface">{v.title}</span>
                <span className="block font-body-sm text-body-sm text-on-surface-variant">
                  {v.petName} · {dueLabel(v.daysLeft, v.dueDate)}
                </span>
              </span>
              <Icon name="chevron_right" className="text-outline" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function dueLabel(daysLeft: number, dueDate: string): string {
  if (daysLeft < 0) return `en retard de ${-daysLeft} jour${daysLeft < -1 ? "s" : ""} (${formatRecordDate(dueDate, { dateStyle: "medium" })})`;
  if (daysLeft === 0) return "aujourd'hui";
  if (daysLeft === 1) return "demain";
  return `dans ${daysLeft} jours (${formatRecordDate(dueDate, { dateStyle: "medium" })})`;
}

/* ---------- Carte d'un animal ---------- */

function PetCard({ pet }: { pet: PetHealthCard }) {
  const status = VACCINE_STATUS_INFO[pet.vaccine.status];
  const next = pet.vaccine.next;
  const subtitle = speciesLine({ species: pet.species as PetSpecies, breed: pet.breed });

  return (
    <Link href={carnetHref(pet.petId)} className="group" aria-label={`Ouvrir le carnet de santé de ${pet.name}`}>
      <Card className={`h-full flex flex-col gap-space-md transition-shadow group-hover:shadow-md ${pet.archived ? "opacity-80" : ""}`}>
        <div className="flex items-center gap-space-md">
          <PetThumb src={pet.thumbnail} name={pet.name} />
          <div className="min-w-0 flex-1">
            <p className="font-headline-sm text-headline-sm text-on-surface truncate">{pet.name}</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{subtitle}</p>
          </div>
          {pet.archived ? (
            <span className="inline-flex items-center gap-1 px-space-sm py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm">
              <Icon name="lock" className="text-[14px]" />
              Lecture seule
            </span>
          ) : (
            <Icon name="chevron_right" className="text-outline transition-transform group-hover:translate-x-1" />
          )}
        </div>

        <div className="flex flex-col gap-space-xs font-body-sm text-body-sm text-on-surface-variant">
          <p className="flex flex-wrap items-center gap-space-xs">
            <span className={`inline-flex items-center gap-1 px-space-sm py-0.5 rounded-full font-label-sm text-label-sm ${status.className}`}>
              <Icon name={status.icon} className="text-[14px]" />
              {status.label}
            </span>
            {next && (
              <span className={pet.vaccine.status === "overdue" ? "text-error font-medium" : ""}>
                {next.title} : {dueLabel(next.daysLeft, next.dueDate)}
              </span>
            )}
          </p>
          {!pet.archived && (
            <p className="flex items-center gap-1">
              <Icon name="medication" className="text-[16px] text-primary" />
              {pet.activeTreatments
                ? `${pet.activeTreatments} traitement${pet.activeTreatments > 1 ? "s" : ""} en cours`
                : "Aucun traitement en cours"}
              {pet.dosesTotal > 0 && (
                <strong className={pet.dosesDone < pet.dosesTotal ? "text-primary" : "text-on-surface"}>
                  {" "}· prises du jour {pet.dosesDone} / {pet.dosesTotal}
                </strong>
              )}
            </p>
          )}
        </div>

        {(pet.lastVisit || pet.allergies.length > 0) && (
          <div className="flex flex-wrap gap-space-xs">
            {pet.lastVisit && (
              <span className="inline-flex items-center gap-1 px-space-sm py-0.5 rounded-full bg-primary-fixed/50 text-on-primary-fixed-variant font-label-sm text-label-sm">
                <Icon name="stethoscope" className="text-[14px]" />
                Visite du {formatRecordDate(pet.lastVisit, { dateStyle: "medium" })}
              </span>
            )}
            {pet.allergies.map((a) => (
              <span key={a} className="inline-flex items-center gap-1 px-space-sm py-0.5 rounded-full bg-error-container/60 text-on-error-container font-label-sm text-label-sm">
                <Icon name="warning" className="text-[14px]" />
                {a}
              </span>
            ))}
          </div>
        )}
      </Card>
    </Link>
  );
}
