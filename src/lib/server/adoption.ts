// Module Adoption côté serveur : collections MongoDB, validation des données reçues et règles d'accès.
// Remplace la section « Module Adoption » de l'ancien firestore.rules.
import "server-only";
import { ObjectId, type Collection } from "mongodb";
import {
  AGE_GROUPS,
  CHILD_AGE_RANGES,
  ENERGY_LEVELS,
  EXPERIENCE_LEVELS,
  ACTIVITY_LEVELS,
  HAPPY_TAIL_MAX_LENGTH,
  MAX_ALONE_HOURS,
  MAX_PHOTOS,
  MOTIVATION_MAX_LENGTH,
  MOTIVATION_MIN_LENGTH,
  PERSONALITY,
  PUBLIC_LISTING_STATUSES,
  SEXES,
  SIZES,
  SPECIES,
  STORY_MAX_LENGTH,
  TEXT_MAX_LENGTH,
  type AdoptionApplication,
  type AdoptionListing,
  type ApplicationAnswers,
  type HappyTail,
  type ListingInput,
  type ReportReason,
  type ReportTarget,
} from "@/lib/adoption-models";
import { badRequest, notFound } from "./http";
import { mongo, users, type UserDoc } from "./mongo";

// ---------------------------------------------------------------------------
// Documents MongoDB (mêmes champs que les types partagés, avec de vraies dates)
// ---------------------------------------------------------------------------

type WithDates<T, K extends keyof T> = Omit<T, "id" | K> & { [P in K]?: Date };

export type ListingDoc = WithDates<AdoptionListing, "createdAt" | "updatedAt" | "publishedAt" | "adoptedAt"> & {
  _id: ObjectId;
};

/** `_id` = `{listingId}_{applicantId}` : une seule candidature par annonce et par candidat. */
export type ApplicationDoc = WithDates<
  AdoptionApplication,
  "createdAt" | "updatedAt" | "reviewedAt" | "decidedAt" | "adoptedAt" | "withdrawnAt"
> & { _id: string };

/** `_id` = `{userId}_{listingId}`. */
export type FavoriteDoc = { _id: string; userId: string; listingId: string; createdAt: Date };

/** `_id` = id de l'annonce : une histoire par adoption. */
export type HappyTailDoc = WithDates<HappyTail, "createdAt"> & { _id: string };

export type ReportDoc = {
  _id: ObjectId;
  reporterId: string;
  targetType: ReportTarget;
  targetId: string;
  reason: ReportReason;
  comment: string;
  createdAt: Date;
};

const cache = globalThis as unknown as { _petcareAdoptionIndexes?: Promise<void> };

async function collection<T extends { _id: unknown }>(name: string): Promise<Collection<T>> {
  const db = await mongo();
  cache._petcareAdoptionIndexes ??= Promise.all([
    db.collection("adoptionListings").createIndex({ status: 1, publishedAt: -1 }),
    db.collection("adoptionListings").createIndex({ ownerId: 1 }),
    db.collection("adoptionApplications").createIndex({ listingId: 1 }),
    db.collection("adoptionApplications").createIndex({ applicantId: 1 }),
    db.collection("adoptionApplications").createIndex({ ownerId: 1 }),
    db.collection("adoptionFavorites").createIndex({ userId: 1, createdAt: -1 }),
  ])
    .then(() => undefined)
    .catch((error) => {
      cache._petcareAdoptionIndexes = undefined;
      throw error;
    });
  await cache._petcareAdoptionIndexes;
  return db.collection<T>(name);
}

export const listings = () => collection<ListingDoc>("adoptionListings");
export const applications = () => collection<ApplicationDoc>("adoptionApplications");
export const favorites = () => collection<FavoriteDoc>("adoptionFavorites");
export const happyTails = () => collection<HappyTailDoc>("happyTails");
export const reports = () => collection<ReportDoc>("adoptionReports");

/** Document → JSON pour le navigateur : `_id` devient `id`, les dates deviennent des chaînes ISO. */
export function toJson<T>(doc: { _id: unknown } & Record<string, unknown>): T {
  const { _id, ...rest } = doc;
  const json: Record<string, unknown> = { id: _id instanceof ObjectId ? _id.toHexString() : String(_id) };
  for (const [key, value] of Object.entries(rest)) json[key] = value instanceof Date ? value.toISOString() : value;
  return json as T;
}

export const listingJson = (doc: ListingDoc) => toJson<AdoptionListing>(doc);

/** Dans les listes, seule la première photo est envoyée (les cartes n'affichent que la couverture). */
export const LIST_PROJECTION = { photos: { $slice: 1 } } as const;
export const applicationJson = (doc: ApplicationDoc) => toJson<AdoptionApplication>(doc);
export const happyTailJson = (doc: HappyTailDoc) => toJson<HappyTail>(doc);

// ---------------------------------------------------------------------------
// Accès
// ---------------------------------------------------------------------------

export function listingObjectId(id: string): ObjectId {
  if (!ObjectId.isValid(id) || id.length !== 24) throw notFound();
  return new ObjectId(id);
}

/** Profil MongoDB de l'utilisateur connecté (obligatoire pour agir dans le module). */
export async function requireProfile(uid: string): Promise<UserDoc> {
  const profile = await (await users()).findOne({ _id: uid });
  if (!profile) throw badRequest("Complétez votre profil avant d'utiliser le module Adoption.");
  return profile;
}

export async function isAdmin(uid: string | undefined): Promise<boolean> {
  if (!uid) return false;
  return Boolean(await (await users()).countDocuments({ _id: uid, role: "admin" }, { limit: 1 }));
}

/** Une annonce en ligne est visible par tous ; un brouillon ou une archive seulement par son auteur. */
export function canRead(listing: ListingDoc, uid: string | undefined, admin: boolean): boolean {
  return PUBLIC_LISTING_STATUSES.includes(listing.status) || listing.ownerId === uid || admin;
}

/** Annonce gérée par l'utilisateur (auteur ou administrateur), sinon 404. */
export async function findOwnListing(id: string, uid: string): Promise<ListingDoc> {
  const listing = await (await listings()).findOne({ _id: listingObjectId(id) });
  if (!listing || (listing.ownerId !== uid && !(await isAdmin(uid)))) throw notFound();
  return listing;
}

// ---------------------------------------------------------------------------
// Validation des données reçues
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function onlyKeys(value: Record<string, unknown>, allowed: string[], label: string) {
  const extra = Object.keys(value).find((key) => !allowed.includes(key));
  if (extra) throw badRequest(`${label} : champ « ${extra} » non autorisé.`);
}

function str(value: unknown, label: string, max: number, { required = false, min = 0 } = {}): string {
  if (typeof value !== "string") throw badRequest(`${label} : valeur invalide.`);
  const text = value.trim();
  if (required && !text) throw badRequest(`${label} est obligatoire.`);
  if (text && text.length < min) throw badRequest(`${label} : ${min} caractères minimum.`);
  if (text.length > max) throw badRequest(`${label} : ${max} caractères maximum.`);
  return text;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (!allowed.includes(value as T)) throw badRequest(`${label} : valeur invalide.`);
  return value as T;
}

function bool(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw badRequest(`${label} : valeur invalide.`);
  return value;
}

function int(value: unknown, label: string, min: number, max: number): number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    throw badRequest(`${label} : nombre entre ${min} et ${max} attendu.`);
  }
  return value as number;
}

const IMAGE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;

function photo(value: unknown, label: string, maxBytes: number): string {
  if (typeof value !== "string" || !IMAGE.test(value)) throw badRequest(`${label} : image invalide.`);
  if (value.length > maxBytes) throw badRequest(`${label} : image trop lourde.`);
  return value;
}

/** Marge au-dessus de la limite appliquée dans le navigateur (lib/images.ts). */
const MAX_LISTING_PHOTOS_BYTES = 1_200_000;
const MAX_SINGLE_PHOTO_BYTES = 600_000;

const LISTING_KEYS: (keyof ListingInput)[] = [
  "name", "title", "species", "breed", "sex", "ageGroup", "ageLabel", "size", "city", "photos", "thumbnail",
  "story", "needs", "conditions", "personality", "compatibility", "energy", "aloneHours", "adoptMe",
];

/** Champs d'une annonce ; `publish` exige une annonce complète (comme le formulaire). */
export function parseListingInput(value: unknown, publish: boolean): ListingInput {
  if (!isRecord(value)) throw badRequest("Annonce invalide.");
  onlyKeys(value, LISTING_KEYS, "Annonce");

  if (!Array.isArray(value.photos) || value.photos.length > MAX_PHOTOS) {
    throw badRequest(`Photos : ${MAX_PHOTOS} maximum.`);
  }
  const photos = value.photos.map((p, i) => photo(p, `Photo ${i + 1}`, MAX_SINGLE_PHOTO_BYTES));
  if (photos.reduce((sum, p) => sum + p.length, 0) > MAX_LISTING_PHOTOS_BYTES) {
    throw badRequest("Les photos sont trop lourdes : retirez-en une.");
  }

  if (!Array.isArray(value.personality) || value.personality.length > 12) throw badRequest("Personnalité invalide.");
  const traits = Object.keys(PERSONALITY) as (keyof typeof PERSONALITY)[];
  const personality = [...new Set(value.personality.map((t) => oneOf(t, traits, "Personnalité")))];

  if (!isRecord(value.compatibility)) throw badRequest("Compatibilité invalide.");
  onlyKeys(value.compatibility, ["kids", "cats", "dogs", "garden"], "Compatibilité");
  const c = value.compatibility;

  const input: ListingInput = {
    name: str(value.name, "Le nom de l'animal", 40, { required: true }),
    title: str(value.title, "Le titre", 80),
    species: oneOf(value.species, Object.keys(SPECIES) as (keyof typeof SPECIES)[], "Espèce"),
    breed: str(value.breed, "La race", 60),
    sex: oneOf(value.sex, Object.keys(SEXES) as (keyof typeof SEXES)[], "Sexe"),
    ageGroup: oneOf(value.ageGroup, Object.keys(AGE_GROUPS) as (keyof typeof AGE_GROUPS)[], "Âge"),
    ageLabel: str(value.ageLabel, "L'âge", 30),
    size: oneOf(value.size, Object.keys(SIZES) as (keyof typeof SIZES)[], "Taille"),
    city: str(value.city, "La ville", 60),
    photos,
    thumbnail: value.thumbnail === "" ? "" : photo(value.thumbnail, "Miniature", MAX_SINGLE_PHOTO_BYTES),
    story: str(value.story, "L'histoire", STORY_MAX_LENGTH),
    needs: str(value.needs, "Les besoins", TEXT_MAX_LENGTH),
    conditions: str(value.conditions, "Les conditions", TEXT_MAX_LENGTH),
    personality,
    compatibility: {
      kids: bool(c.kids, "Compatibilité enfants"),
      cats: bool(c.cats, "Compatibilité chats"),
      dogs: bool(c.dogs, "Compatibilité chiens"),
      garden: bool(c.garden, "Besoin d'un jardin"),
    },
    energy: oneOf(value.energy, Object.keys(ENERGY_LEVELS) as (keyof typeof ENERGY_LEVELS)[], "Énergie"),
    aloneHours: int(value.aloneHours, "Heures seul", 0, MAX_ALONE_HOURS),
    adoptMe: bool(value.adoptMe, "Mise en avant"),
  };

  if (publish) {
    if (!input.ageLabel) throw badRequest("Indiquez l'âge (ex. « 2 ans »).");
    if (!input.city) throw badRequest("La ville est obligatoire.");
    if (!input.photos.length) throw badRequest("Ajoutez au moins une photo.");
    if (input.story.length < 30) throw badRequest("Racontez son histoire en quelques phrases (30 caractères minimum).");
  }
  return input;
}

/** Réponses du formulaire de candidature (Logement / Foyer / Mode de vie). */
export function parseAnswers(value: unknown): ApplicationAnswers {
  if (!isRecord(value)) throw badRequest("Candidature invalide.");
  onlyKeys(value, ["housing", "household", "lifestyle"], "Candidature");
  const { housing: h, household: f, lifestyle: l } = value;
  if (!isRecord(h) || !isRecord(f) || !isRecord(l)) throw badRequest("Candidature incomplète.");
  onlyKeys(h, ["type", "outdoor", "tenure", "landlordOk", "city"], "Logement");
  onlyKeys(f, ["adults", "children", "childAges", "cats", "dogs", "others", "allergies"], "Foyer");
  onlyKeys(l, ["aloneHours", "activity", "experience", "motivation"], "Mode de vie");

  const tenure = oneOf(h.tenure, ["proprietaire", "locataire"] as const, "Statut du logement");
  const children = int(f.children, "Enfants", 0, 20);
  if (!Array.isArray(f.childAges)) throw badRequest("Âges des enfants invalides.");
  const childAges = [...new Set(f.childAges.map((a) => oneOf(a, CHILD_AGE_RANGES, "Âge des enfants")))];

  return {
    housing: {
      type: oneOf(h.type, ["appartement", "maison"] as const, "Type de logement"),
      outdoor: bool(h.outdoor, "Extérieur"),
      tenure,
      landlordOk: tenure === "locataire" && bool(h.landlordOk, "Accord du propriétaire"),
      city: str(h.city, "La ville", 60, { required: true }),
    },
    household: {
      adults: int(f.adults, "Adultes", 1, 20),
      children,
      childAges: children ? childAges : [],
      cats: int(f.cats, "Chats", 0, 50),
      dogs: int(f.dogs, "Chiens", 0, 50),
      others: int(f.others, "Autres animaux", 0, 50),
      allergies: bool(f.allergies, "Allergies"),
    },
    lifestyle: {
      aloneHours: int(l.aloneHours, "Heures seul", 0, MAX_ALONE_HOURS),
      activity: oneOf(l.activity, Object.keys(ACTIVITY_LEVELS) as (keyof typeof ACTIVITY_LEVELS)[], "Activité"),
      experience: oneOf(l.experience, Object.keys(EXPERIENCE_LEVELS) as (keyof typeof EXPERIENCE_LEVELS)[], "Expérience"),
      motivation: str(l.motivation, "La motivation", MOTIVATION_MAX_LENGTH, { required: true, min: MOTIVATION_MIN_LENGTH }),
    },
  };
}

export function parseHappyTail(value: Record<string, unknown>): { afterPhoto: string; story: string } {
  onlyKeys(value, ["listingId", "afterPhoto", "story"], "Histoire");
  return {
    afterPhoto: photo(value.afterPhoto, "Photo « après »", MAX_SINGLE_PHOTO_BYTES),
    story: str(value.story, "L'histoire", HAPPY_TAIL_MAX_LENGTH, { required: true, min: 30 }),
  };
}
