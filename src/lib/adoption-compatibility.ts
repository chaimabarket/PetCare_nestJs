import type { AdoptionListing, ApplicationAnswers } from "./adoption";

export type CompatibilityCheck = {
  key: "jardin" | "enfants" | "animaux" | "temps-seul" | "activite" | "logement" | "allergies" | "experience";
  /** Libellé court (cartes de la liste). */
  label: string;
  ok: boolean;
  /** Explication affichée dans le détail. */
  detail: string;
  weight: number;
};

export type CompatibilityResult = { score: number; checks: CompatibilityCheck[] };

type ListingCriteria = Pick<AdoptionListing, "name" | "compatibility" | "aloneHours" | "energy" | "personality">;

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

/**
 * Aide à la décision, pas un verdict : compare les besoins de l'animal aux réponses du candidat.
 * Les trois premiers critères (jardin, enfants, autres animaux) sont ceux affichés sur les cartes.
 */
export function computeCompatibility(listing: ListingCriteria, answers: ApplicationAnswers): CompatibilityResult {
  const { name, compatibility } = listing;
  const { housing, household, lifestyle } = answers;
  const checks: CompatibilityCheck[] = [];

  checks.push(
    compatibility.garden
      ? {
          key: "jardin",
          label: "Jardin",
          ok: housing.outdoor,
          detail: housing.outdoor
            ? `${name} a besoin d'un jardin – le candidat dispose d'un extérieur`
            : `${name} a besoin d'un jardin – le candidat n'en a pas`,
          weight: 3,
        }
      : {
          key: "jardin",
          label: housing.outdoor ? "Jardin" : "Logement",
          ok: true,
          detail: `${name} n'a pas besoin de jardin`,
          weight: 3,
        },
  );

  checks.push(
    household.children > 0
      ? {
          key: "enfants",
          label: "Enfants",
          ok: compatibility.kids,
          detail: compatibility.kids
            ? `${name} s'entend avec les enfants (${plural(household.children, "enfant")} dans le foyer)`
            : `Le foyer compte ${plural(household.children, "enfant")} – ${name} n'est pas indiqué(e) OK enfants`,
          weight: 3,
        }
      : { key: "enfants", label: "Enfants", ok: true, detail: "Pas d'enfant dans le foyer", weight: 3 },
  );

  const conflicts = [
    household.cats > 0 && !compatibility.cats ? "chats" : "",
    household.dogs > 0 && !compatibility.dogs ? "chiens" : "",
  ].filter(Boolean);
  const hasAnimals = household.cats + household.dogs + household.others > 0;
  checks.push({
    key: "animaux",
    label: conflicts.length ? `Autres ${conflicts.join(" et ")}` : "Autres animaux",
    ok: conflicts.length === 0,
    detail: conflicts.length
      ? `Le foyer a déjà des ${conflicts.join(" et des ")} – ${name} n'est pas indiqué(e) compatible`
      : hasAnimals
        ? `Cohabitation possible avec les animaux du foyer`
        : "Pas d'autre animal dans le foyer",
    weight: 3,
  });

  const aloneOk = lifestyle.aloneHours <= listing.aloneHours;
  checks.push({
    key: "temps-seul",
    label: "Temps seul",
    ok: aloneOk,
    detail: aloneOk
      ? `Seul(e) ${lifestyle.aloneHours} h par jour – ${name} le supporte (jusqu'à ${listing.aloneHours} h)`
      : `${name} peut rester seul(e) ${listing.aloneHours} h au plus – le candidat prévoit ${lifestyle.aloneHours} h`,
    weight: 2,
  });

  const activityMismatch =
    (listing.energy === "eleve" && lifestyle.activity === "calme") ||
    (listing.energy === "faible" && lifestyle.activity === "tres-actif");
  checks.push({
    key: "activite",
    label: "Activité",
    ok: !activityMismatch,
    detail: activityMismatch
      ? listing.energy === "eleve"
        ? `${name} est très énergique – le foyer a un rythme calme`
        : `${name} a besoin de calme – le foyer est très actif`
      : `Le rythme du foyer convient au niveau d'énergie de ${name}`,
    weight: 2,
  });

  const housingOk = housing.tenure === "proprietaire" || housing.landlordOk;
  checks.push({
    key: "logement",
    label: "Logement",
    ok: housingOk,
    detail: housingOk
      ? housing.tenure === "proprietaire"
        ? "Le candidat est propriétaire de son logement"
        : "Le propriétaire du logement accepte les animaux"
      : "Locataire : l'accord du propriétaire pour les animaux n'est pas confirmé",
    weight: 2,
  });

  if (household.allergies) {
    checks.push({
      key: "allergies",
      label: "Allergies",
      ok: false,
      detail: "Des allergies sont déclarées dans le foyer",
      weight: 1,
    });
  }

  const needsCare = listing.personality.includes("soins");
  const experienceOk = !needsCare || lifestyle.experience !== "premiere";
  checks.push({
    key: "experience",
    label: "Expérience",
    ok: experienceOk,
    detail: experienceOk
      ? needsCare
        ? `Le candidat a de l'expérience pour les soins spécifiques de ${name}`
        : "Expérience suffisante pour cet animal"
      : `${name} demande des soins spécifiques – ce serait une première adoption`,
    weight: 1,
  });

  const total = checks.reduce((sum, c) => sum + c.weight, 0);
  const passed = checks.reduce((sum, c) => sum + (c.ok ? c.weight : 0), 0);
  return { score: Math.round((passed / total) * 100), checks };
}

export type GaugeTone = "teal" | "amber" | "grey";

export function gaugeTone(score: number): GaugeTone {
  if (score >= 75) return "teal";
  if (score >= 50) return "amber";
  return "grey";
}
