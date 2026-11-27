"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { PageLoading, PetThumb } from "@/components/sante/ui";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { ApiError } from "@/lib/api";
import { formatRecordDate, RECORD_TYPE_INFO, todayIso } from "@/lib/health-records";
import { getSharedBook } from "@/lib/health-records-api";
import { SHARE_SCOPE_INFO, type SharedHealthBook, type SharedRecord } from "@/lib/health-share";
import { daysBetweenIso, doseScheduleLabel, isActiveTreatment, latestVaccines } from "@/lib/health-summary";
import { ageLabel, SEX_INFO, speciesLine, type PetSex, type PetSpecies } from "@/lib/pets";

const fmt = (iso: string | null) => (iso ? formatRecordDate(iso, { dateStyle: "medium" }) : "—");

/** Carnet ouvert depuis un lien de partage : lecture seule, sans compte. */
export function SharedBook({ token }: { token: string }) {
  const [book, setBook] = useState<SharedHealthBook | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);

  useEffect(() => {
    let active = true;
    getSharedBook(token)
      .then((b) => active && setBook(b))
      .catch((err) => active && setError({ status: err instanceof ApiError ? err.status : 0, message: err instanceof Error ? err.message : "Chargement impossible." }));
    return () => {
      active = false;
    };
  }, [token]);

  if (error) {
    const gone = error.status === 410;
    return (
      <div className="max-w-xl mx-auto px-margin py-space-2xl">
        <Card className="flex flex-col items-center gap-space-md text-center p-space-xl">
          <Icon name={gone ? "link_off" : "help"} className="text-[44px] text-outline" />
          <h1 className="font-headline-md text-headline-md text-on-surface">{gone ? "Lien plus valable" : "Lien introuvable"}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            {error.status === 404 || gone ? error.message : "Le carnet n'a pas pu être chargé. Réessayez dans un instant."}{" "}
            {(gone || error.status === 404) && "Demandez un nouveau lien au propriétaire de l'animal."}
          </p>
        </Card>
      </div>
    );
  }
  if (!book) return <PageLoading label="Ouverture du carnet partagé…" />;

  const today = todayIso();
  const { pet, vet, records, scope } = book;
  const of = (type: SharedRecord["type"]) => records.filter((r) => r.type === type);
  const vaccines = of("vaccin");
  const latestIds = new Set(latestVaccines(vaccines).map((r) => r.id));
  const treatments = of("traitement");
  const current = treatments.filter((r) => isActiveTreatment(r, today));
  const past = treatments.filter((r) => !isActiveTreatment(r, today));
  const visits = records.filter((r) => r.type === "visite" || r.type === "examen");
  const notes = of("note");
  const age = pet.birthDate ? ageLabel(pet.birthDate, today) : "";

  return (
    <div className="max-w-4xl mx-auto px-margin md:px-margin-md py-space-xl flex flex-col gap-space-lg">
      <div className="flex flex-wrap items-center justify-between gap-space-sm rounded-xl bg-primary-fixed/30 p-space-sm font-body-sm text-body-sm text-on-primary-fixed-variant print:hidden">
        <span className="flex items-center gap-space-xs">
          <Icon name="lock" className="text-[16px]" />
          {SHARE_SCOPE_INFO[scope].label} partagé par le propriétaire · lecture seule · valable jusqu&apos;au{" "}
          {new Date(book.expiresAt).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}
        </span>
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1 font-label-md text-label-md text-primary hover:underline">
          <Icon name="print" className="text-[16px]" />
          Imprimer
        </button>
      </div>

      <Card className="flex flex-col sm:flex-row sm:items-center gap-space-md">
        <PetThumb src={pet.photo} name={pet.name} size="w-20 h-20" />
        <div className="min-w-0 flex-1">
          <p className="font-label-sm text-label-sm uppercase tracking-wider text-primary">PetCare · {SHARE_SCOPE_INFO[scope].label}</p>
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">{pet.name}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            {[
              speciesLine({ species: pet.species as PetSpecies, breed: pet.breed }),
              pet.sex ? SEX_INFO[pet.sex as PetSex]?.label : "",
              age,
              pet.sterilized ? "stérilisé(e)" : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {pet.chipNumber && <p className="font-body-sm text-body-sm text-on-surface-variant">N° de puce : {pet.chipNumber}</p>}
        </div>
      </Card>

      <Section icon="warning" title="Allergies et vigilances" tone="text-error" empty="Aucune allergie signalée.">
        {of("allergie").map((r) => (
          <Item key={r.id} title={r.title} tone="bg-error-container/30">
            {r.notes}
          </Item>
        ))}
      </Section>

      <Section icon="medication" title="Traitements en cours" empty="Aucun traitement en cours.">
        {current.map((r) => (
          <Item key={r.id} title={r.title} tone="bg-primary-fixed/25">
            Depuis le {fmt(r.date)}
            {r.endDate ? `, jusqu'au ${fmt(r.endDate)}` : ", sans date de fin"}
            {r.dosage && ` · Posologie : ${r.dosage}`}
            {r.doseTimes.length > 0 && ` · Prises : ${doseScheduleLabel(r)}`}
            {r.veterinarian && ` · ${r.veterinarian}`}
            {r.notes && <span className="block">{r.notes}</span>}
          </Item>
        ))}
      </Section>

      <Section icon="vaccines" title={scope === "urgence" ? "Derniers vaccins" : "Vaccins et rappels"} empty="Aucun vaccin enregistré.">
        {vaccines.map((r) => {
          const late = latestIds.has(r.id) && !!r.nextDueDate && daysBetweenIso(today, r.nextDueDate) < 0;
          return (
            <Item key={r.id} title={r.title} tone="bg-surface-container-low">
              Fait le {fmt(r.date)}
              {r.lotNumber && ` · Lot ${r.lotNumber}`}
              {r.veterinarian && ` · ${r.veterinarian}`}
              {r.nextDueDate && (
                <span className={late ? "text-error font-medium" : ""}>
                  {" "}· Rappel {latestIds.has(r.id) ? "" : "(refait) "}le {fmt(r.nextDueDate)}
                  {late && " — en retard"}
                </span>
              )}
            </Item>
          );
        })}
      </Section>

      {scope === "complet" && (
        <>
          <Section icon="stethoscope" title="Visites et examens" empty="Aucune visite ni examen enregistré.">
            {visits.map((r) => (
              <Item key={r.id} title={`${fmt(r.date)} · ${r.title}`} tone="bg-surface-container-low">
                {RECORD_TYPE_INFO[r.type].label}
                {(r.veterinarian || r.clinic) && ` · ${[r.veterinarian, r.clinic].filter(Boolean).join(" · ")}`}
                {r.notes && <span className="block">{r.notes}</span>}
              </Item>
            ))}
          </Section>
          <Section icon="history" title="Traitements passés" empty="Aucun traitement passé.">
            {past.map((r) => (
              <Item key={r.id} title={r.title} tone="bg-surface-container-low">
                Du {fmt(r.date)} au {fmt(r.endDate)}
                {r.dosage && ` · Posologie : ${r.dosage}`}
              </Item>
            ))}
          </Section>
          <Section icon="notes" title="Notes et observations" empty="Aucune note.">
            {notes.map((r) => (
              <Item key={r.id} title={`${fmt(r.date)} · ${r.title}`} tone="bg-surface-container-low">
                {r.notes}
              </Item>
            ))}
          </Section>
        </>
      )}

      <Section icon="local_hospital" title="Vétérinaire référent" empty="Non renseigné.">
        {vet.name || vet.clinic || vet.phone || vet.address
          ? [
              <Item key="vet" title={[vet.name, vet.clinic].filter(Boolean).join(" · ") || "Vétérinaire"} tone="bg-surface-container-low">
                {vet.address}
                {vet.phone && (
                  <a href={`tel:${vet.phone.replace(/\s/g, "")}`} className="block font-label-lg text-label-lg text-primary hover:underline">
                    {vet.phone}
                  </a>
                )}
              </Item>,
            ]
          : []}
      </Section>

      <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
        Informations saisies par le propriétaire dans{" "}
        <Link href="/" className="text-primary hover:underline">
          PetCare
        </Link>
        . Elles ne remplacent pas le carnet de santé officiel.
      </p>
    </div>
  );
}

function Section({ icon, title, tone = "text-primary", empty, children }: { icon: string; title: string; tone?: string; empty: string; children: ReactNode[] }) {
  return (
    <Card className="flex flex-col gap-space-sm">
      <h2 className="flex items-center gap-space-sm font-headline-sm text-headline-sm text-on-surface">
        <Icon name={icon} className={tone} />
        {title}
      </h2>
      {children.length ? <ul className="flex flex-col gap-space-xs">{children}</ul> : <p className="font-body-md text-body-md text-on-surface-variant">{empty}</p>}
    </Card>
  );
}

function Item({ title, tone, children }: { title: string; tone: string; children?: ReactNode }) {
  return (
    <li className={`rounded-xl p-space-sm ${tone}`}>
      <p className="font-label-lg text-label-lg text-on-surface">{title}</p>
      {children && <div className="font-body-sm text-body-sm text-on-surface-variant">{children}</div>}
    </li>
  );
}
