// Alerte intelligente de poids (module « Mes animaux ») : code pur, partagé par le serveur (calcul à chaque
// pesée ajoutée, corrigée ou supprimée) et l'interface (textes, sources). Ce n'est jamais un diagnostic.
import { ageInMonths, daysBetween, SMALL_SPECIES, type PetSpecies, type PetStatus } from "./pets-models";

/** Règles, de la plus grave à la moins grave : la première qui s'applique est retenue. */
export const WEIGHT_ALERT_RULES = ["extreme", "loss-10", "rapid-loss", "gain-20", "loss-5", "gain-10"] as const;
export type WeightAlertRule = (typeof WEIGHT_ALERT_RULES)[number];
export type WeightAlertLevel = "consult" | "watch";

export type WeightAlert = {
  rule: WeightAlertRule;
  level: WeightAlertLevel;
  /** Variation en % par rapport à la pesée de référence (négative pour une perte). */
  changePct: number;
  /** Période observée (7, 30 ou 90 jours). */
  windowDays: number;
  referenceId: string;
  referenceDay: string;
  referenceKg: number;
  latestId: string;
  latestDay: string;
  latestKg: number;
};

export type WeightSample = { id: string; day: string; weightKg: number };

export const WEIGHT_SOURCES = [
  { label: "WSAVA — Global Nutrition Guidelines", href: "https://wsava.org/" },
  { label: "VCA Animal Hospitals — perte de poids", href: "https://vcahospitals.com/" },
  { label: "AAHA — Nutrition and Weight Management Guidelines", href: "https://www.aaha.org/" },
  { label: "International Cat Care — score corporel", href: "https://icatcare.org/" },
];

export const WEIGHT_ALERT_INFO: Record<WeightAlertRule, { level: WeightAlertLevel; title: string; advice: string }> = {
  extreme: {
    level: "consult",
    title: "Variation de poids extrême",
    advice:
      "Une variation de 30 % ou plus en une semaine est très inhabituelle. Vérifiez d'abord la saisie ; si elle est exacte, consultez rapidement votre vétérinaire.",
  },
  "loss-10": {
    level: "consult",
    title: "Perte de poids importante",
    advice:
      "Une perte de 10 % ou plus du poids en 3 mois, sans régime prescrit, justifie une consultation vétérinaire (VCA Hospitals).",
  },
  "rapid-loss": {
    level: "consult",
    title: "Perte de poids rapide",
    advice: "Une perte rapide en une semaine peut signaler un problème de santé : consultez votre vétérinaire.",
  },
  "gain-20": {
    level: "consult",
    title: "Prise de poids importante",
    advice:
      "Une prise de 20 % ou plus en 3 mois chez un adulte correspond à environ deux points de score corporel : parlez-en à votre vétérinaire.",
  },
  "loss-5": {
    level: "watch",
    title: "Perte de poids à surveiller",
    advice: "Une perte de 5 % ou plus en un mois mérite d'être surveillée : pesez-le à nouveau dans quelques jours.",
  },
  "gain-10": {
    level: "watch",
    title: "Prise de poids à surveiller",
    advice:
      "Une prise de 10 % en 3 mois correspond à environ un point de score corporel (AAHA, iCatCare) : surveillez l'alimentation et l'activité.",
  },
};

export const WEIGHT_ALERT_DISCLAIMER =
  "Cette alerte compare simplement les pesées enregistrées : ce n'est pas un diagnostic. Seul un vétérinaire peut évaluer l'état de santé de votre animal.";

/** Âge minimal (mois) pour signaler une prise de poids : avant, l'animal grandit. */
const ADULT_MONTHS = 12;
/** Au-delà, la dernière pesée est trop ancienne pour être analysée. */
const MAX_LATEST_AGE_DAYS = 30;
const HISTORY_DAYS = 90;
/** Une prise de poids qui ramène à un poids déjà atteint (à 5 % près) est un retour à la normale. */
const USUAL_WEIGHT_TOLERANCE = 0.05;

const pct = (from: number, to: number) => Math.round(((to - from) / from) * 1000) / 10;

/**
 * Compare la dernière pesée aux pesées des 90 jours précédents. Renvoie la règle la plus grave
 * qui s'applique, ou `null` (moins de 2 pesées, animal archivé, dernière pesée de plus de 30 jours…).
 */
export function analyzeWeights({
  weights,
  species,
  birthDate,
  status,
  today,
}: {
  weights: WeightSample[];
  species: PetSpecies;
  birthDate: string;
  status: PetStatus;
  today: string;
}): WeightAlert | null {
  if (status === "archived" || weights.length < 2) return null;
  const sorted = [...weights].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  const latest = sorted[sorted.length - 1];
  if (daysBetween(latest.day, today) > MAX_LATEST_AGE_DAYS) return null;

  const history = sorted.slice(0, -1).filter((w) => daysBetween(w.day, latest.day) <= HISTORY_DAYS);
  if (!history.length) return null;
  const within = (days: number) => history.filter((w) => daysBetween(w.day, latest.day) <= days);
  const adult = !birthDate || ageInMonths(birthDate, latest.day) >= ADULT_MONTHS;
  const rapidLossThreshold = SMALL_SPECIES.includes(species) ? 3 : 5;

  const alert = (rule: WeightAlertRule, reference: WeightSample, windowDays: number): WeightAlert => ({
    rule,
    level: WEIGHT_ALERT_INFO[rule].level,
    changePct: pct(reference.weightKg, latest.weightKg),
    windowDays,
    referenceId: reference.id,
    referenceDay: reference.day,
    referenceKg: reference.weightKg,
    latestId: latest.id,
    latestDay: latest.day,
    latestKg: latest.weightKg,
  });
  // Référence d'une perte : le poids le plus haut de la période ; d'une prise : le plus bas.
  // À égalité, la pesée la plus récente (l'épisode garde la même référence).
  const highest = (list: WeightSample[]) => list.reduce((a, b) => (b.weightKg >= a.weightKg ? b : a));
  const lowest = (list: WeightSample[]) => list.reduce((a, b) => (b.weightKg <= a.weightKg ? b : a));
  const lossFrom = (days: number) => {
    const list = within(days);
    if (!list.length) return null;
    const reference = highest(list);
    return { reference, change: pct(reference.weightKg, latest.weightKg) };
  };
  const gainFrom = (days: number) => {
    const list = within(days);
    if (!list.length || !adult) return null;
    const reference = lowest(list);
    // Retour au poids habituel : un poids au moins égal (à 5 % près) avait déjà été mesuré avant la baisse.
    const usual = history.some(
      (w) => w.day < reference.day && w.weightKg >= latest.weightKg * (1 - USUAL_WEIGHT_TOLERANCE),
    );
    if (usual) return null;
    return { reference, change: pct(reference.weightKg, latest.weightKg) };
  };

  // extreme : variation (perte ou prise) de 30 % ou plus en 7 jours, quel que soit l'âge.
  const week = within(7);
  if (week.length) {
    const reference = week.reduce((a, b) =>
      Math.abs(latest.weightKg - b.weightKg) / b.weightKg >= Math.abs(latest.weightKg - a.weightKg) / a.weightKg ? b : a,
    );
    if (Math.abs(pct(reference.weightKg, latest.weightKg)) >= 30) return alert("extreme", reference, 7);
  }

  const loss90 = lossFrom(90);
  if (loss90 && loss90.change <= -10) return alert("loss-10", loss90.reference, 90);

  const loss7 = lossFrom(7);
  if (loss7 && loss7.change <= -rapidLossThreshold) return alert("rapid-loss", loss7.reference, 7);

  const gain90 = gainFrom(90);
  if (gain90 && gain90.change >= 20) return alert("gain-20", gain90.reference, 90);

  const loss30 = lossFrom(30);
  if (loss30 && loss30.change <= -5) return alert("loss-5", loss30.reference, 30);

  if (gain90 && gain90.change >= 10) return alert("gain-10", gain90.reference, 90);

  return null;
}

/** Identifiant d'un épisode : animal + règle + pesée de référence. */
export function alertKey(petId: string, alert: Pick<WeightAlert, "rule" | "referenceId">): string {
  return `${petId}:${alert.rule}:${alert.referenceId}`;
}

const rank = (rule: WeightAlertRule) => WEIGHT_ALERT_RULES.indexOf(rule);

/**
 * Faut-il notifier ? Une seule notification par épisode ; une nouvelle seulement si l'alerte s'aggrave
 * (règle plus grave que l'alerte en cours). `notifiedKeys` : épisodes déjà notifiés pour cet animal.
 */
export function shouldNotify(
  petId: string,
  previous: Pick<WeightAlert, "rule"> | null | undefined,
  next: WeightAlert | null,
  notifiedKeys: string[],
): boolean {
  if (!next) return false;
  if (notifiedKeys.includes(alertKey(petId, next))) return false;
  return !previous || rank(next.rule) < rank(previous.rule);
}
