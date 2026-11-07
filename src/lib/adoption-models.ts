// Module Adoption : types, constantes et fonctions sans accès aux données.
// Partagé par le navigateur (lib/adoption.ts, pages) et les routes API (lib/server/adoption.ts).
import type { UserRole } from "./models";

// ---------------------------------------------------------------------------
// Référentiels
// ---------------------------------------------------------------------------

export type Species = "chat" | "chien" | "oiseau" | "lapin" | "autre";
export type AgeGroup = "bebe" | "jeune" | "adulte" | "senior";
export type Sex = "male" | "femelle";
export type Size = "petit" | "moyen" | "grand";
export type Energy = "faible" | "moyen" | "eleve";
export type PersonalityTrait =
  | "calme"
  | "energique"
  | "affectueux"
  | "joueur"
  | "timide"
  | "ok-enfants"
  | "ok-chats"
  | "ok-chiens"
  | "interieur"
  | "exterieur"
  | "eduque"
  | "soins";

export const SPECIES: Record<Species, { label: string; plural: string; emoji: string }> = {
  chat: { label: "Chat", plural: "Chats", emoji: "🐱" },
  chien: { label: "Chien", plural: "Chiens", emoji: "🐶" },
  oiseau: { label: "Oiseau", plural: "Oiseaux", emoji: "🦜" },
  lapin: { label: "Lapin", plural: "Lapins", emoji: "🐰" },
  autre: { label: "Autre", plural: "Autres", emoji: "🐾" },
};

export const AGE_GROUPS: Record<AgeGroup, string> = {
  bebe: "Bébé",
  jeune: "Jeune",
  adulte: "Adulte",
  senior: "Senior",
};

export const SEXES: Record<Sex, { label: string; symbol: string }> = {
  male: { label: "Mâle", symbol: "♂" },
  femelle: { label: "Femelle", symbol: "♀" },
};

export const SIZES: Record<Size, string> = { petit: "Petit", moyen: "Moyen", grand: "Grand" };

export const ENERGY_LEVELS: Record<Energy, string> = { faible: "Faible", moyen: "Moyen", eleve: "Élevé" };

export const PERSONALITY: Record<PersonalityTrait, { emoji: string; label: string }> = {
  calme: { emoji: "🛋️", label: "Calme" },
  energique: { emoji: "⚡", label: "Énergique" },
  affectueux: { emoji: "🤗", label: "Affectueux" },
  joueur: { emoji: "🎾", label: "Joueur" },
  timide: { emoji: "🙈", label: "Timide" },
  "ok-enfants": { emoji: "👶", label: "OK enfants" },
  "ok-chats": { emoji: "🐱", label: "OK chats" },
  "ok-chiens": { emoji: "🐶", label: "OK chiens" },
  interieur: { emoji: "🏠", label: "Intérieur" },
  exterieur: { emoji: "🌳", label: "Besoin d'extérieur" },
  eduque: { emoji: "🎓", label: "Éduqué" },
  soins: { emoji: "💊", label: "Soins spécifiques" },
};

/** Clés d'un objet en conservant leur type (ordre d'affichage). */
export function keysOf<K extends string>(record: Record<K, unknown>): K[] {
  return Object.keys(record) as K[];
}

export type StatusTone = "green" | "amber" | "coral" | "grey";

export type ListingStatus = "brouillon" | "disponible" | "reservee" | "adoptee" | "archivee";

export const LISTING_STATUS: Record<ListingStatus, { label: string; tone: StatusTone }> = {
  brouillon: { label: "Brouillon", tone: "grey" },
  disponible: { label: "Disponible", tone: "green" },
  reservee: { label: "Réservé", tone: "amber" },
  adoptee: { label: "Adopté", tone: "coral" },
  archivee: { label: "Archivé", tone: "grey" },
};

export type ApplicationStatus = "envoyee" | "en-etude" | "acceptee" | "refusee" | "retiree" | "adoptee";

export const APPLICATION_STATUS: Record<ApplicationStatus, { label: string; tone: StatusTone }> = {
  envoyee: { label: "Envoyée", tone: "amber" },
  "en-etude": { label: "En étude", tone: "amber" },
  acceptee: { label: "Acceptée", tone: "green" },
  refusee: { label: "Refusée", tone: "grey" },
  retiree: { label: "Retirée", tone: "grey" },
  adoptee: { label: "Adoptée", tone: "coral" },
};

/** Candidatures encore en attente d'une décision. */
export const PENDING_STATUSES: ApplicationStatus[] = ["envoyee", "en-etude"];

/** Rôles autorisés à publier une annonce d'adoption. */
export const PUBLISHER_ROLES: UserRole[] = ["proprietaire", "refuge"];

export const MAX_PHOTOS = 5;
export const STORY_MAX_LENGTH = 2000;
export const TEXT_MAX_LENGTH = 1000;
export const MOTIVATION_MIN_LENGTH = 30;
export const MOTIVATION_MAX_LENGTH = 1000;
export const HAPPY_TAIL_MAX_LENGTH = 1500;
export const MAX_ALONE_HOURS = 10;

export const ADOPTION_ROUTES = {
  feed: "/communaute/adoption",
  publish: "/communaute/adoption/publier",
  myListings: "/communaute/adoption/mes-annonces",
  myApplications: "/communaute/adoption/mes-candidatures",
  favorites: "/communaute/adoption/favoris",
  happyTails: "/communaute/adoption/happy-tails",
  listing: (id: string) => `/communaute/adoption/${id}`,
  apply: (id: string) => `/communaute/adoption/${id}/candidature`,
  received: (id: string) => `/communaute/adoption/${id}/candidatures`,
  edit: (id: string) => `/communaute/adoption/${id}/modifier`,
  shareHappyTail: (id: string) => `/communaute/adoption/${id}/happy-tail`,
};

// ---------------------------------------------------------------------------
// Documents (dates au format ISO, renvoyées par l'API)
// ---------------------------------------------------------------------------

export type Compatibility = { kids: boolean; cats: boolean; dogs: boolean; garden: boolean };

/** Champs saisis dans le formulaire de publication. */
export type ListingInput = {
  name: string;
  title: string;
  species: Species;
  breed: string;
  sex: Sex;
  ageGroup: AgeGroup;
  /** Âge affiché tel quel (ex. « 2 ans », « 4 mois »). */
  ageLabel: string;
  size: Size;
  city: string;
  /** Photos compressées (data URL JPEG) ; la première est la couverture. */
  photos: string[];
  /** Miniature de la couverture, recopiée dans les candidatures. */
  thumbnail: string;
  story: string;
  needs: string;
  conditions: string;
  personality: PersonalityTrait[];
  compatibility: Compatibility;
  energy: Energy;
  /** Nombre d'heures que l'animal peut rester seul. */
  aloneHours: number;
  /** Mise en avant « ADOPTE-MOI » (coup de cœur, urgence). */
  adoptMe: boolean;
};

/** Annonce `adoptionListings`. */
export type AdoptionListing = ListingInput & {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerRole: UserRole;
  ownerCity: string;
  status: ListingStatus;
  acceptedApplicationId?: string;
  adopterId?: string;
  adopterName?: string;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
  adoptedAt?: string;
};

export type HousingAnswers = {
  type: "appartement" | "maison";
  outdoor: boolean;
  tenure: "proprietaire" | "locataire";
  landlordOk: boolean;
  city: string;
};

export type ChildAgeRange = "0-5" | "6-12" | "13+";
export const CHILD_AGE_RANGES: ChildAgeRange[] = ["0-5", "6-12", "13+"];

export type HouseholdAnswers = {
  adults: number;
  children: number;
  childAges: ChildAgeRange[];
  cats: number;
  dogs: number;
  others: number;
  allergies: boolean;
};

export type ActivityLevel = "calme" | "modere" | "tres-actif";
export type Experience = "premiere" | "un-peu" | "beaucoup";

export const ACTIVITY_LEVELS: Record<ActivityLevel, string> = {
  calme: "Calme",
  modere: "Modéré",
  "tres-actif": "Très actif",
};

export const EXPERIENCE_LEVELS: Record<Experience, string> = {
  premiere: "Première fois",
  "un-peu": "Un peu",
  beaucoup: "Beaucoup",
};

export type LifestyleAnswers = {
  aloneHours: number;
  activity: ActivityLevel;
  experience: Experience;
  motivation: string;
};

export type ApplicationAnswers = {
  housing: HousingAnswers;
  household: HouseholdAnswers;
  lifestyle: LifestyleAnswers;
};

/** Candidature `adoptionApplications` (id = `{listingId}_{applicantId}`). */
export type AdoptionApplication = ApplicationAnswers & {
  id: string;
  listingId: string;
  ownerId: string;
  ownerName: string;
  animalName: string;
  animalThumbnail: string;
  applicantId: string;
  applicantName: string;
  applicantCity: string;
  status: ApplicationStatus;
  createdAt?: string;
  updatedAt?: string;
  reviewedAt?: string;
  decidedAt?: string;
  adoptedAt?: string;
  withdrawnAt?: string;
};

/** Histoire `happyTails` (id = id de l'annonce) : une par adoption. */
export type HappyTail = {
  id: string;
  listingId: string;
  adopterId: string;
  adopterName: string;
  ownerName: string;
  animalName: string;
  species: Species;
  beforePhoto: string;
  afterPhoto: string;
  story: string;
  likedBy: string[];
  createdAt?: string;
};

export const REPORT_REASONS = ["Contenu inapproprié", "Arnaque", "Doublon", "Autre"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export type ReportTarget = "annonce" | "happy-tail";

/** Annonces visibles par tous (les brouillons et archives ne le sont que par leur auteur). */
export const PUBLIC_LISTING_STATUSES: ListingStatus[] = ["disponible", "reservee", "adoptee"];

/** Annonces affichées dans le fil. */
export const FEED_LISTING_STATUSES: ListingStatus[] = ["disponible", "reservee"];

export const applicationId = (listingId: string, applicantId: string) => `${listingId}_${applicantId}`;

function millis(date?: string): number {
  return date ? new Date(date).getTime() : Date.now();
}

/** Plus récents d'abord. */
export function byNewest<T extends { createdAt?: string; publishedAt?: string }>(a: T, b: T): number {
  return millis(b.publishedAt ?? b.createdAt) - millis(a.publishedAt ?? a.createdAt);
}

/** Nombre de jours depuis la publication (« en ligne depuis »). */
export function daysOnline(listing: AdoptionListing, now = Date.now()): number {
  return Math.max(0, Math.floor((now - millis(listing.publishedAt ?? listing.createdAt)) / 86_400_000));
}

export function formatDate(date?: string): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Filtres du fil
// ---------------------------------------------------------------------------

export type ListingFilters = {
  species: Species[];
  ages: AgeGroup[];
  sex: Sex | "";
  sizes: Size[];
  city: string;
  traits: PersonalityTrait[];
  adoptMeOnly: boolean;
};

export const EMPTY_FILTERS: ListingFilters = {
  species: [],
  ages: [],
  sex: "",
  sizes: [],
  city: "",
  traits: [],
  adoptMeOnly: false,
};

/** Nombre de critères actifs (pastille du bouton « Filtres »). */
export function activeFilterCount(filters: ListingFilters): number {
  return (
    Number(filters.species.length > 0) +
    Number(filters.ages.length > 0) +
    Number(Boolean(filters.sex)) +
    Number(filters.sizes.length > 0) +
    Number(Boolean(filters.city)) +
    Number(filters.traits.length > 0) +
    Number(filters.adoptMeOnly)
  );
}

/** Un trait « OK enfants / chats / chiens » est aussi satisfait par la compatibilité déclarée. */
function hasTrait(listing: AdoptionListing, trait: PersonalityTrait): boolean {
  if (listing.personality.includes(trait)) return true;
  if (trait === "ok-enfants") return listing.compatibility.kids;
  if (trait === "ok-chats") return listing.compatibility.cats;
  if (trait === "ok-chiens") return listing.compatibility.dogs;
  if (trait === "exterieur") return listing.compatibility.garden;
  return false;
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function matchesFilters(listing: AdoptionListing, filters: ListingFilters, search = ""): boolean {
  const term = normalize(search);
  if (term) {
    const haystack = normalize(
      [listing.name, listing.title, listing.breed, listing.city, SPECIES[listing.species].label, listing.ownerName].join(" "),
    );
    if (!haystack.includes(term)) return false;
  }
  if (filters.species.length && !filters.species.includes(listing.species)) return false;
  if (filters.ages.length && !filters.ages.includes(listing.ageGroup)) return false;
  if (filters.sex && listing.sex !== filters.sex) return false;
  if (filters.sizes.length && !filters.sizes.includes(listing.size)) return false;
  if (filters.city && normalize(listing.city) !== normalize(filters.city)) return false;
  if (filters.adoptMeOnly && !listing.adoptMe) return false;
  return filters.traits.every((trait) => hasTrait(listing, trait));
}
