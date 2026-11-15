/** Blocs de contexte ajoutés à chaque question (sans Firebase : testés avec `npm test`). */
import type { HealthRecord } from "../health-records";
import { speciesLabel, type AssistantPet } from "./pets-model";

const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const pad = (n: number) => String(n).padStart(2, "0");
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const frDay = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** « DATE DU JOUR : 2026-11-12 (jeudi), HEURE : 14:05 » : pour calculer « demain », « jeudi prochain »… */
export function buildDateContext(now: Date): string {
  return `DATE DU JOUR : ${isoDay(now)} (${WEEKDAYS[now.getDay()]}), HEURE : ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/** Bloc « ANIMAUX DE L'UTILISATEUR » : les noms que l'assistant peut utiliser dans une action. */
export function buildPetsListContext(pets: AssistantPet[]): string {
  return pets.length
    ? `ANIMAUX DE L'UTILISATEUR : ${pets.map((p) => `${p.name} (${speciesLabel(p)})`).join(", ")}`
    : "ANIMAUX DE L'UTILISATEUR : aucun animal enregistré.";
}

/** Lignes courtes du carnet : allergies, dernier vaccin de chaque nom, traitements en cours, dernière visite. */
export function buildHealthSummary(records: HealthRecord[], now = new Date()): string[] {
  const today = isoDay(now);
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
  const allergies = sorted.filter((r) => r.type === "allergie").map((r) => `Allergie : ${r.title}`);

  const seen = new Set<string>();
  const vaccines: string[] = [];
  for (const r of sorted.filter((r) => r.type === "vaccin")) {
    const key = r.title.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const next = r.nextDueDate;
    const reminder = !next ? "" : next < today ? `, rappel en retard depuis le ${frDay(next)}` : `, prochain rappel le ${frDay(next)}`;
    vaccines.push(`Vaccin ${r.title} : fait le ${frDay(r.date)}${reminder}`);
  }

  const ongoing = sorted
    .filter((r) => r.type === "traitement" && r.date <= today && (!r.endDate || r.endDate >= today))
    .map((r) => `Traitement en cours : ${r.title}${r.dosage ? ` (${r.dosage})` : ""}${r.endDate ? ` jusqu'au ${frDay(r.endDate)}` : ""}`);

  const lastVisit = sorted.find((r) => r.type === "visite");
  return [
    ...allergies,
    ...vaccines,
    ...ongoing,
    ...(lastVisit ? [`Dernière visite : ${lastVisit.title} le ${frDay(lastVisit.date)}`] : []),
  ].slice(0, 10);
}
