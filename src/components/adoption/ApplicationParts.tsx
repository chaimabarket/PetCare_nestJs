import type { ReactNode } from "react";
import type { Timestamp } from "firebase/firestore";
import { Icon } from "@/components/ui/Icon";
import {
  ACTIVITY_LEVELS,
  EXPERIENCE_LEVELS,
  formatDate,
  type AdoptionApplication,
  type ApplicationAnswers,
  type ApplicationStatus,
} from "@/lib/adoption";

const STEPS = ["Envoyée", "En étude", "Acceptée", "Adoptée"] as const;

/** Étape atteinte (0 à 3) et éventuel arrêt (refus / retrait). */
function progress(status: ApplicationStatus): { step: number; stopped?: string } {
  switch (status) {
    case "envoyee":
      return { step: 0 };
    case "en-etude":
      return { step: 1 };
    case "acceptee":
      return { step: 2 };
    case "adoptee":
      return { step: 3 };
    case "refusee":
      return { step: 1, stopped: "Refusée" };
    case "retiree":
      return { step: 0, stopped: "Retirée" };
  }
}

/** Frise horizontale Envoyée → En étude → Acceptée → Adoptée. */
export function TimelineStepper({ status }: { status: ApplicationStatus }) {
  const { step, stopped } = progress(status);
  const adopted = status === "adoptee";
  const labels = stopped ? [...STEPS.slice(0, step + 1), stopped] : [...STEPS];
  const bar = adopted ? "bg-[#E07A5F]" : stopped ? "bg-outline" : "bg-primary-container";

  return (
    <div className="flex flex-col gap-1.5" aria-label={`Étape : ${stopped ?? STEPS[step]}`}>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }}>
        {labels.map((label, index) => {
          const reached = index <= (stopped ? labels.length - 1 : step);
          const current = index === (stopped ? labels.length - 1 : step);
          return (
            <div key={label} className="flex flex-col gap-1">
              <span className={`h-1.5 rounded-full ${reached ? (current && stopped ? "bg-outline" : bar) : "bg-surface-container"}`} />
              <span
                className={`font-label-sm text-label-sm truncate ${
                  current ? (stopped ? "text-on-surface-variant font-bold" : adopted ? "text-[#E07A5F] font-bold" : "text-primary font-bold") : reached ? "text-on-surface" : "text-outline"
                }`}
              >
                {current && !stopped && <Icon name="check" className="text-[12px] align-middle mr-0.5" />}
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Frise verticale détaillée (panneau de droite de « Mes candidatures »). */
export function VerticalTimeline({ application }: { application: AdoptionApplication }) {
  const { step, stopped } = progress(application.status);
  const events: { title: string; text: string; date?: Timestamp; done: boolean; current: boolean; tone?: "grey" }[] = [
    {
      title: "Candidature transmise",
      text: "Votre dossier a été envoyé à l'auteur de l'annonce.",
      date: application.createdAt,
      done: true,
      current: step === 0 && !stopped,
    },
  ];
  if (stopped === "Retirée") {
    events.push({ title: "Candidature retirée", text: "Vous avez retiré votre candidature.", date: application.withdrawnAt, done: true, current: true, tone: "grey" });
  } else {
    events.push({
      title: "Étude du dossier",
      text: "L'auteur de l'annonce examine la compatibilité de votre foyer.",
      date: application.reviewedAt,
      done: step >= 1,
      current: step === 1 && !stopped,
    });
    if (stopped === "Refusée") {
      events.push({ title: "Candidature non retenue", text: "Merci pour votre démarche ! D'autres animaux attendent une famille.", date: application.decidedAt, done: true, current: true, tone: "grey" });
    } else {
      events.push(
        {
          title: "Candidature acceptée",
          text: "L'animal vous est réservé : organisez la rencontre avec l'auteur de l'annonce.",
          date: application.status === "acceptee" || application.status === "adoptee" ? application.decidedAt : undefined,
          done: step >= 2,
          current: step === 2,
        },
        {
          title: "Adoption confirmée",
          text: "Bienvenue dans votre nouvelle famille ! Le carnet de santé n'est pas transmis automatiquement.",
          date: application.adoptedAt,
          done: step >= 3,
          current: step === 3,
        },
      );
    }
  }

  return (
    <ol className="relative flex flex-col gap-space-lg">
      {events.map((event, index) => (
        <li key={event.title} className="relative flex gap-space-md">
          {index < events.length - 1 && <span className="absolute left-[11px] top-7 bottom-[-1.5rem] w-0.5 bg-surface-container" />}
          <span
            className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
              event.tone === "grey"
                ? "bg-outline text-white"
                : event.done
                  ? event.current
                    ? "bg-amber-500 text-white"
                    : "bg-primary-container text-on-primary"
                  : "bg-surface-container text-outline"
            }`}
          >
            <Icon name={event.tone === "grey" ? "close" : event.done && !event.current ? "check" : event.current ? "autorenew" : "circle"} className="text-[14px]" />
          </span>
          <div className={`flex-1 min-w-0 ${event.done ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-space-sm">
              <h3 className="font-label-lg text-label-lg text-on-surface">{event.title}</h3>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                {event.date ? formatDate(event.date) : event.done ? "" : "À venir"}
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{event.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <li className="flex justify-between gap-space-sm font-body-md text-body-md">
      <span className="text-on-surface-variant">{label}</span>
      <span className="text-on-surface font-medium text-right">{value}</span>
    </li>
  );
}

const yesNo = (value: boolean) => (value ? "Oui" : "Non");

export function housingRows(answers: ApplicationAnswers) {
  const { housing } = answers;
  return [
    { label: "Type de logement", value: housing.type === "maison" ? "Maison" : "Appartement" },
    { label: "Jardin ou extérieur", value: yesNo(housing.outdoor) },
    { label: "Statut", value: housing.tenure === "proprietaire" ? "Propriétaire" : "Locataire" },
    ...(housing.tenure === "locataire" ? [{ label: "Accord du propriétaire", value: yesNo(housing.landlordOk) }] : []),
    { label: "Ville", value: housing.city },
  ];
}

export function householdRows(answers: ApplicationAnswers) {
  const { household } = answers;
  return [
    { label: "Adultes", value: String(household.adults) },
    {
      label: "Enfants",
      value: household.children ? `${household.children} (${household.childAges.join(", ") || "âges non précisés"} ans)` : "Aucun",
    },
    { label: "Chats / chiens / autres", value: `${household.cats} / ${household.dogs} / ${household.others}` },
    { label: "Allergies dans le foyer", value: yesNo(household.allergies) },
  ];
}

export function lifestyleRows(answers: ApplicationAnswers) {
  const { lifestyle } = answers;
  return [
    { label: "Heures seul par jour", value: `${lifestyle.aloneHours}${lifestyle.aloneHours >= 10 ? "+" : ""} h` },
    { label: "Niveau d'activité", value: ACTIVITY_LEVELS[lifestyle.activity] },
    { label: "Expérience avec l'espèce", value: EXPERIENCE_LEVELS[lifestyle.experience] },
  ];
}

/** Carte de réponses (récapitulatif candidat, détail côté refuge). */
export function AnswerCard({
  icon,
  title,
  rows,
  action,
}: {
  icon: string;
  title: string;
  rows: { label: string; value: ReactNode }[];
  action?: ReactNode;
}) {
  return (
    <section className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-sm">
      <div className="flex items-center justify-between gap-space-sm">
        <h3 className="flex items-center gap-space-xs font-headline-sm text-headline-sm text-on-surface">
          <Icon name={icon} className="text-primary text-[22px]" />
          {title}
        </h3>
        {action}
      </div>
      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <Row key={row.label} label={row.label} value={row.value} />
        ))}
      </ul>
    </section>
  );
}

export function MotivationQuote({ text, author }: { text: string; author?: string }) {
  return (
    <figure className="bg-surface-container-low/70 rounded-xl p-space-md">
      <blockquote className="font-body-md text-body-md text-on-surface italic whitespace-pre-line">« {text} »</blockquote>
      {author && <figcaption className="mt-space-xs font-label-sm text-label-sm text-on-surface-variant">— {author}</figcaption>}
    </figure>
  );
}
