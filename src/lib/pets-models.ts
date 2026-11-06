// Module 1 « Mes animaux » : types, référentiels et validation partagés entre le navigateur et les routes
// /api/pets (aucune dépendance). Les dates de l'API sont au format ISO ; les jours au format AAAA-MM-JJ.
import type { FieldErrors } from "./validation";
import type { WeightAlert } from "./pet-weight-alert";

// ---------------------------------------------------------------------------
// Référentiels
// ---------------------------------------------------------------------------

export const PET_SPECIES = ["dog", "cat", "rabbit", "rodent", "bird", "other"] as const;
export type PetSpecies = (typeof PET_SPECIES)[number];

export const SPECIES_INFO: Record<PetSpecies, { label: string; plural: string; emoji: string }> = {
  dog: { label: "Chien", plural: "Chiens", emoji: "🐶" },
  cat: { label: "Chat", plural: "Chats", emoji: "🐱" },
  rabbit: { label: "Lapin", plural: "Lapins", emoji: "🐰" },
  rodent: { label: "Rongeur", plural: "Rongeurs", emoji: "🐹" },
  bird: { label: "Oiseau", plural: "Oiseaux", emoji: "🦜" },
  other: { label: "Autre", plural: "Autres", emoji: "🐾" },
};

/** Petits animaux : une perte de poids rapide est plus vite inquiétante (alerte dès 3 %). */
export const SMALL_SPECIES: PetSpecies[] = ["rabbit", "rodent", "bird"];

export const PET_SEXES = ["male", "female"] as const;
export type PetSex = (typeof PET_SEXES)[number];
export const SEX_INFO: Record<PetSex, { label: string; icon: string }> = {
  male: { label: "Mâle", icon: "male" },
  female: { label: "Femelle", icon: "female" },
};

/** `draft` : brouillon à compléter ; `archived` : retiré des actifs, tout est conservé. */
export const PET_STATUSES = ["draft", "active", "archived"] as const;
export type PetStatus = (typeof PET_STATUSES)[number];

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 80;
export const BREED_MAX_LENGTH = 80;
export const NOTES_MAX_LENGTH = 500;
export const CHIP_LENGTH = 15;
export const MAX_PET_PHOTOS = 5;
export const MAX_CONTACTS = 5;
export const CONTACT_NAME_MAX_LENGTH = 80;
export const CONTACT_DETAIL_MAX_LENGTH = 120;
export const VET_TEXT_MAX_LENGTH = 120;
export const ARCHIVE_REASON_MAX_LENGTH = 200;
export const WEIGHT_MAX_KG = 500;
export const WEIGHT_NOTE_MAX_LENGTH = 200;
/** Au-delà de cet écart avec la pesée précédente, l'interface demande confirmation. */
export const WEIGHT_CONFIRM_RATIO = 0.3;

export const PET_ROUTES = {
  list: "/animaux",
  add: "/animaux/nouveau",
  pet: (id: string) => `/animaux/${id}`,
  edit: (id: string) => `/animaux/${id}/modifier`,
};

// ---------------------------------------------------------------------------
// Types (format JSON de l'API)
// ---------------------------------------------------------------------------

/** Vétérinaire référent, saisi à la main (tous les champs facultatifs). */
export type PetVet = { name: string; clinic: string; address: string; phone: string };
export const EMPTY_VET: PetVet = { name: "", clinic: "", address: "", phone: "" };

/** Champs du formulaire d'ajout / modification. */
export type PetInput = {
  name: string;
  species: PetSpecies;
  sex: PetSex | "";
  /** Race ; pour `other`, l'animal saisi librement (obligatoire, ex. « Ours »). */
  breed: string;
  /** AAAA-MM-JJ, ou "" si inconnue. */
  birthDate: string;
  birthDateEstimated: boolean;
  /** 15 chiffres, ou "". */
  chipNumber: string;
  sterilized: boolean;
  notes: string;
  vet: PetVet;
};

export const EMPTY_PET_INPUT: PetInput = {
  name: "",
  species: "dog",
  sex: "",
  breed: "",
  birthDate: "",
  birthDateEstimated: false,
  chipNumber: "",
  sterilized: false,
  notes: "",
  vet: EMPTY_VET,
};

export type PetContact = { id: string; name: string; detail: string; phone: string; emergency: boolean };
export type PetContactInput = Omit<PetContact, "id"> & { id?: string };

/** Photo : `url` et `thumbnail` sont des images compressées (data URL JPEG). */
export type PetPhoto = { id: string; url: string; thumbnail: string };

export type PetWeight = {
  id: string;
  petId: string;
  /** Jour de la pesée chez l'utilisateur (AAAA-MM-JJ) : une seule pesée par jour. */
  day: string;
  measuredOn: string;
  weightKg: number;
  note: string;
  createdAt: string;
  updatedAt: string;
};

/** Alerte de poids en cours (voir lib/pet-weight-alert.ts), avec l'état « ignorée » de l'utilisateur. */
export type PetWeightAlertState = WeightAlert & { key: string; dismissed: boolean; detectedAt: string };

export type Pet = PetInput & {
  id: string;
  status: PetStatus;
  archivedReason?: string;
  archivedAt?: string;
  favorite: boolean;
  contacts: PetContact[];
  /**
   * Fiche (`GET /api/pets/{id}`) : toutes les photos, la première est la couverture.
   * Liste (`GET /api/pets`) : uniquement la couverture, `url` vide (seule la miniature est envoyée).
   */
  photos: PetPhoto[];
  photoCount: number;
  latestWeight?: { kg: number; day: string };
  weightAlert?: PetWeightAlertState;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Dates et âge
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, "0");

/** Jour local AAAA-MM-JJ (navigateur) ; `offsetDays` pour demain, hier… */
export function localDay(date = new Date(), offsetDays = 0): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isValidDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Nombre de jours entre deux jours AAAA-MM-JJ (`to - from`). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Décale un jour AAAA-MM-JJ de `days` jours. */
export function shiftDay(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Âge en mois révolus et jours restants entre la naissance et `today` (AAAA-MM-JJ). */
function ageParts(birthDate: string, today: string): { months: number; days: number } {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  let months = (ty - by) * 12 + (tm - bm);
  if (td < bd) months--;
  const anchor = new Date(Date.UTC(by, bm - 1 + months, bd));
  // Le 31 d'un mois court déborde sur le mois suivant : on revient au dernier jour du mois.
  if (anchor.getUTCDate() !== bd) anchor.setUTCDate(0);
  const days = daysBetween(anchor.toISOString().slice(0, 10), today);
  return { months: Math.max(0, months), days: Math.max(0, days) };
}

export function ageInMonths(birthDate: string, today: string): number {
  return ageParts(birthDate, today).months;
}

/** « 4 ans et 10 mois », « 2 ans », « 8 mois », « 3 semaines », « 5 jours » ; "" si la date est inconnue. */
export function ageLabel(birthDate: string, today: string): string {
  if (!birthDate || !isValidDay(birthDate) || birthDate > today) return "";
  const { months, days } = ageParts(birthDate, today);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;
  if (years > 0) return rest ? `${plural(years, "an")} et ${rest} mois` : plural(years, "an");
  if (months > 0) return `${months} mois`;
  if (days >= 7) return plural(Math.floor(days / 7), "semaine");
  return days <= 1 ? "1 jour" : plural(days, "jour");
}

/** « aujourd'hui », « hier », « il y a 12 j ». */
export function daysAgoLabel(day: string, today: string): string {
  const days = daysBetween(day, today);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  return `il y a ${days} j`;
}

/** « 4,2 kg ». */
export function formatKg(kg: number): string {
  return `${kg.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kg`;
}

/** « 14 octobre 2022 » à partir de AAAA-MM-JJ (sans décalage de fuseau). */
export function formatDay(day: string, options: Intl.DateTimeFormatOptions = { dateStyle: "long" }): string {
  return new Intl.DateTimeFormat("fr-FR", { ...options, timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
}

/** Espèce et race pour l'affichage : « Chien · Golden Retriever », ou l'animal libre (« Ours »). */
export function speciesLine(pet: Pick<PetInput, "species" | "breed">): string {
  if (pet.species === "other") return pet.breed || SPECIES_INFO.other.label;
  return pet.breed ? `${SPECIES_INFO[pet.species].label} · ${pet.breed}` : SPECIES_INFO[pet.species].label;
}

/** Numéro de puce lisible : « 250 269 608 123 456 ». */
export function formatChip(chip: string): string {
  return chip.replace(/(\d{3})(?=\d)/g, "$1 ");
}

/** Numéro de puce tronqué pour l'affichage courant : « 250 269 ••• ••• 456 ». */
export function maskChip(chip: string): string {
  if (chip.length !== CHIP_LENGTH) return chip;
  return `${chip.slice(0, 3)} ${chip.slice(3, 6)} ••• ••• ${chip.slice(12)}`;
}

/** Texte de partage : uniquement nom, espèce, race, sexe et âge (jamais la puce, les notes ni la santé). */
export function shareText(pet: Pick<PetInput, "name" | "species" | "breed" | "sex" | "birthDate">, today: string): string {
  const age = ageLabel(pet.birthDate, today);
  return [
    `${SPECIES_INFO[pet.species].emoji} ${pet.name}`,
    speciesLine(pet),
    pet.sex ? SEX_INFO[pet.sex].label : "",
    age ? `${age}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

// ---------------------------------------------------------------------------
// Validation (même code dans le formulaire et dans les routes API)
// ---------------------------------------------------------------------------

type Raw = Record<string, unknown>;
const isRecord = (v: unknown): v is Raw => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const phonePattern = /^\+?[\d\s.-]{8,20}$/;

export type PetField = keyof PetInput | "vetName" | "vetClinic" | "vetAddress" | "vetPhone";

/**
 * Nettoie et valide les champs d'un animal. `draft` : brouillon, seul le nom est exigé
 * (les champs remplis doivent tout de même être valides).
 */
export function validatePetInput(
  raw: unknown,
  { draft = false, today }: { draft?: boolean; today: string },
): { value: PetInput; errors: FieldErrors<PetField> } {
  const d = isRecord(raw) ? raw : {};
  const vet = isRecord(d.vet) ? d.vet : {};
  const species = PET_SPECIES.includes(d.species as PetSpecies) ? (d.species as PetSpecies) : null;
  const sex = PET_SEXES.includes(d.sex as PetSex) ? (d.sex as PetSex) : "";
  const value: PetInput = {
    name: str(d.name),
    species: species ?? "dog",
    sex,
    breed: str(d.breed),
    birthDate: str(d.birthDate),
    birthDateEstimated: d.birthDateEstimated === true,
    chipNumber: str(d.chipNumber).replace(/[\s.-]/g, ""),
    sterilized: d.sterilized === true,
    notes: str(d.notes),
    vet: { name: str(vet.name), clinic: str(vet.clinic), address: str(vet.address), phone: str(vet.phone) },
  };
  const errors: FieldErrors<PetField> = {};

  if (value.name.length < NAME_MIN_LENGTH) errors.name = `Le nom doit contenir au moins ${NAME_MIN_LENGTH} caractères.`;
  else if (value.name.length > NAME_MAX_LENGTH) errors.name = `${NAME_MAX_LENGTH} caractères maximum.`;
  if (!species) errors.species = "Choisissez une espèce.";
  if (d.sex !== undefined && d.sex !== "" && !sex) errors.sex = "Sexe invalide.";
  else if (!draft && !sex) errors.sex = "Indiquez le sexe de l'animal.";

  if (value.breed.length > BREED_MAX_LENGTH) errors.breed = `${BREED_MAX_LENGTH} caractères maximum.`;
  else if (!draft && value.species === "other" && !value.breed) errors.breed = "Indiquez de quel animal il s'agit.";

  if (value.birthDate) {
    if (!isValidDay(value.birthDate)) errors.birthDate = "La date n'est pas valide.";
    else if (value.birthDate > today) errors.birthDate = "La date de naissance ne peut pas être dans le futur.";
  } else value.birthDateEstimated = false;

  if (value.chipNumber && !new RegExp(`^\\d{${CHIP_LENGTH}}$`).test(value.chipNumber)) {
    errors.chipNumber = `Le numéro de puce comporte ${CHIP_LENGTH} chiffres.`;
  }
  if (value.notes.length > NOTES_MAX_LENGTH) errors.notes = `${NOTES_MAX_LENGTH} caractères maximum.`;

  if (value.vet.name.length > VET_TEXT_MAX_LENGTH) errors.vetName = `${VET_TEXT_MAX_LENGTH} caractères maximum.`;
  if (value.vet.clinic.length > VET_TEXT_MAX_LENGTH) errors.vetClinic = `${VET_TEXT_MAX_LENGTH} caractères maximum.`;
  if (value.vet.address.length > VET_TEXT_MAX_LENGTH) errors.vetAddress = `${VET_TEXT_MAX_LENGTH} caractères maximum.`;
  if (value.vet.phone && !phonePattern.test(value.vet.phone)) errors.vetPhone = "Le numéro de téléphone n'est pas valide.";

  return { value, errors };
}

/** Valide la liste des contacts (5 maximum ; nom et téléphone obligatoires). */
export function validateContacts(raw: unknown): { value: PetContactInput[]; error?: string } {
  if (!Array.isArray(raw)) return { value: [], error: "Contacts invalides." };
  if (raw.length > MAX_CONTACTS) return { value: [], error: `${MAX_CONTACTS} contacts maximum.` };
  const value: PetContactInput[] = [];
  for (const item of raw) {
    const c = isRecord(item) ? item : {};
    const contact: PetContactInput = {
      ...(typeof c.id === "string" && c.id && { id: c.id }),
      name: str(c.name),
      detail: str(c.detail),
      phone: str(c.phone),
      emergency: c.emergency === true,
    };
    if (!contact.name) return { value: [], error: "Le nom du contact est obligatoire." };
    if (contact.name.length > CONTACT_NAME_MAX_LENGTH) return { value: [], error: `Nom du contact : ${CONTACT_NAME_MAX_LENGTH} caractères maximum.` };
    if (contact.detail.length > CONTACT_DETAIL_MAX_LENGTH) return { value: [], error: `Précision : ${CONTACT_DETAIL_MAX_LENGTH} caractères maximum.` };
    if (!phonePattern.test(contact.phone)) return { value: [], error: `Le numéro de ${contact.name} n'est pas valide.` };
    value.push(contact);
  }
  return { value };
}

export type WeightInput = { day: string; weightKg: number; note: string };
export type WeightField = keyof WeightInput;

/** Valide une pesée. `birthDate` : une pesée ne peut pas précéder la naissance. */
export function validateWeight(
  raw: unknown,
  { today, birthDate = "" }: { today: string; birthDate?: string },
): { value: WeightInput; errors: FieldErrors<WeightField> } {
  const d = isRecord(raw) ? raw : {};
  const weightKg = typeof d.weightKg === "number" ? d.weightKg : Number(String(d.weightKg ?? "").replace(",", "."));
  const value: WeightInput = { day: str(d.day), weightKg: Math.round(weightKg * 1000) / 1000, note: str(d.note) };
  const errors: FieldErrors<WeightField> = {};
  if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > WEIGHT_MAX_KG) {
    errors.weightKg = `Le poids doit être compris entre 0 et ${WEIGHT_MAX_KG} kg.`;
  }
  if (!isValidDay(value.day)) errors.day = "La date n'est pas valide.";
  else if (value.day > today) errors.day = "La date ne peut pas être dans le futur.";
  else if (birthDate && value.day < birthDate) errors.day = "La pesée ne peut pas précéder la naissance.";
  if (value.note.length > WEIGHT_NOTE_MAX_LENGTH) errors.note = `${WEIGHT_NOTE_MAX_LENGTH} caractères maximum.`;
  return { value, errors };
}

/** Écart relatif entre deux poids (0,3 = 30 %). */
export function weightChangeRatio(previousKg: number, kg: number): number {
  return previousKg > 0 ? Math.abs(kg - previousKg) / previousKg : 0;
}
