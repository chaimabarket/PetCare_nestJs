// Onglet « Santé » : règles de calcul partagées par le serveur (/api/health-records/summary) et les tests.
// Aucune dépendance : fonctions pures sur des actes au format de l'API (dates AAAA-MM-JJ).
import type { HealthRecord } from "./health-records";

/** Fenêtre « bientôt » d'un rappel de vaccin (et liste « 30 prochains jours » du tableau de bord). */
export const VACCINE_SOON_DAYS = 30;

export type VaccineStatus = "overdue" | "soon" | "ok" | "none";

export const VACCINE_STATUS_INFO: Record<VaccineStatus, { label: string; className: string; icon: string }> = {
  overdue: { label: "En retard", className: "bg-error text-on-error", icon: "error" },
  soon: { label: "Bientôt", className: "bg-tertiary-fixed text-on-tertiary-fixed-variant", icon: "schedule" },
  ok: { label: "À jour", className: "bg-emerald-50 text-emerald-800", icon: "verified" },
  none: { label: "Aucun vaccin", className: "bg-surface-container text-on-surface-variant", icon: "vaccines" },
};

type RecordLike = Pick<HealthRecord, "id" | "type" | "title" | "date"> &
  Partial<Pick<HealthRecord, "createdAt">> &
  Partial<Pick<HealthRecord, "nextDueDate" | "endDate" | "doseTimes" | "doseEveryDays">>;

/** Décale un jour AAAA-MM-JJ de `days` jours (calcul en UTC : pas d'effet de changement d'heure). */
export function shiftIsoDay(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Nombre de jours de `from` à `to` (négatif si `to` est avant). */
export function daysBetweenIso(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

const vaccineKey = (title: string) => title.trim().toLocaleLowerCase("fr").replace(/\s+/g, " ");

/**
 * Dernière injection de chaque vaccin (même titre, sans tenir compte de la casse) : une ancienne injection
 * dont le rappel est passé ne compte plus quand le vaccin a été refait.
 */
export function latestVaccines<T extends RecordLike>(records: T[]): T[] {
  const latest = new Map<string, T>();
  for (const r of records) {
    if (r.type !== "vaccin") continue;
    const key = vaccineKey(r.title);
    const current = latest.get(key);
    if (!current || r.date > current.date || (r.date === current.date && (r.createdAt ?? "") > (current.createdAt ?? ""))) {
      latest.set(key, r);
    }
  }
  return [...latest.values()];
}

export type DueVaccine = { recordId: string; title: string; dueDate: string; daysLeft: number };

/** Rappels des dernières injections, du plus urgent au plus lointain. */
export function dueVaccines(records: RecordLike[], today: string): DueVaccine[] {
  return latestVaccines(records)
    .filter((r) => r.nextDueDate)
    .map((r) => ({ recordId: r.id, title: r.title, dueDate: r.nextDueDate!, daysLeft: daysBetweenIso(today, r.nextDueDate!) }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** Statut vaccinal d'un animal et prochain rappel (le plus proche). */
export function vaccineStatus(records: RecordLike[], today: string): { status: VaccineStatus; next: DueVaccine | null } {
  const vaccines = latestVaccines(records);
  if (!vaccines.length) return { status: "none", next: null };
  const next = dueVaccines(records, today)[0] ?? null;
  if (!next) return { status: "ok", next: null };
  if (next.daysLeft < 0) return { status: "overdue", next };
  if (next.daysLeft <= VACCINE_SOON_DAYS) return { status: "soon", next };
  return { status: "ok", next };
}

/** Traitement en cours ce jour-là : commencé et pas encore terminé (pas de fin = en cours). */
export function isActiveTreatment(r: RecordLike, day: string): boolean {
  return r.type === "traitement" && r.date <= day && (!r.endDate || r.endDate >= day);
}

/** Heures des prises prévues ce jour-là (aucune si le traitement est fini ou si ce n'est pas un jour de prise). */
export function doseTimesForDay(r: RecordLike, day: string): string[] {
  if (!isActiveTreatment(r, day) || !r.doseTimes?.length) return [];
  const every = Math.max(1, r.doseEveryDays ?? 1);
  return daysBetweenIso(r.date, day) % every === 0 ? [...r.doseTimes].sort() : [];
}

/** Libellé du rythme : « 08:00 · 20:00, tous les jours ». */
export function doseScheduleLabel(r: Pick<HealthRecord, "doseTimes" | "doseEveryDays">): string {
  if (!r.doseTimes.length) return "";
  const every = r.doseEveryDays <= 1 ? "tous les jours" : r.doseEveryDays === 7 ? "une fois par semaine" : `tous les ${r.doseEveryDays} jours`;
  return `${r.doseTimes.join(" · ")}, ${every}`;
}

/** Ce qu'un animal demande aujourd'hui : sert au tri des cartes de l'écran Santé. */
export type PetUrgency = { status: VaccineStatus; dosesLeft: number; name: string };

/** Retard de vaccin, puis prises restantes aujourd'hui, puis rappel « bientôt », puis le reste (par nom). */
export function urgencyRank({ status, dosesLeft }: PetUrgency): number {
  if (status === "overdue") return 0;
  if (dosesLeft > 0) return 1;
  if (status === "soon") return 2;
  return 3;
}

export function compareUrgency(a: PetUrgency, b: PetUrgency): number {
  return urgencyRank(a) - urgencyRank(b) || a.name.localeCompare(b.name, "fr");
}

// ---------------------------------------------------------------------------
// Format JSON de GET /api/health-records/summary
// ---------------------------------------------------------------------------

export type DoseItem = {
  recordId: string;
  petId: string;
  petName: string;
  petThumbnail: string;
  title: string;
  dosage: string;
  time: string;
  taken: boolean;
};

export type PetHealthCard = {
  petId: string;
  name: string;
  species: string;
  breed: string;
  thumbnail: string;
  archived: boolean;
  vaccine: { status: VaccineStatus; next: DueVaccine | null };
  activeTreatments: number;
  dosesDone: number;
  dosesTotal: number;
  lastVisit: string | null;
  allergies: string[];
};

export type DashboardVaccine = DueVaccine & { petId: string; petName: string };

export type HealthSummary = {
  day: string;
  pets: PetHealthCard[];
  doses: DoseItem[];
  overdueVaccines: DashboardVaccine[];
  upcomingVaccines: DashboardVaccine[];
};
