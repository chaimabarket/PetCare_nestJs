import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentSnapshot,
  type Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { sendNotification } from "./notifications";
import type { UserProfile, UserRole } from "./users";

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
// Documents Firestore
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

/** Document Firestore `adoptionListings/{id}`. */
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
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  publishedAt?: Timestamp;
  adoptedAt?: Timestamp;
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

/** Document Firestore `adoptionApplications/{listingId}_{applicantId}`. */
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
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  reviewedAt?: Timestamp;
  decidedAt?: Timestamp;
  adoptedAt?: Timestamp;
  withdrawnAt?: Timestamp;
};

/** Document Firestore `happyTails/{listingId}` : une histoire par adoption. */
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
  createdAt?: Timestamp;
};

export const REPORT_REASONS = ["Contenu inapproprié", "Arnaque", "Doublon", "Autre"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export type ReportTarget = "annonce" | "happy-tail";

const LISTINGS = "adoptionListings";
const APPLICATIONS = "adoptionApplications";
const FAVORITES = "adoptionFavorites";
const HAPPY_TAILS = "happyTails";
const REPORTS = "adoptionReports";

function fromSnapshot<T>(snapshot: DocumentSnapshot): T {
  return { id: snapshot.id, ...snapshot.data({ serverTimestamps: "estimate" }) } as T;
}

function millis(date?: Timestamp): number {
  return date ? date.toMillis() : Date.now();
}

/** Plus récents d'abord. */
function byNewest<T extends { createdAt?: Timestamp; publishedAt?: Timestamp }>(a: T, b: T): number {
  return millis(b.publishedAt ?? b.createdAt) - millis(a.publishedAt ?? a.createdAt);
}

/** Nombre de jours depuis la publication (« en ligne depuis »). */
export function daysOnline(listing: AdoptionListing, now = Date.now()): number {
  return Math.max(0, Math.floor((now - millis(listing.publishedAt ?? listing.createdAt)) / 86_400_000));
}

export function formatDate(date?: Timestamp): string {
  if (!date) return "—";
  return date.toDate().toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

/** Les notifications ne doivent jamais bloquer l'action principale. */
function notify(notification: Parameters<typeof sendNotification>[0]): Promise<void> {
  return sendNotification(notification)
    .then(() => undefined)
    .catch((error) => console.error("Notification d'adoption non envoyée :", error));
}

// ---------------------------------------------------------------------------
// Annonces
// ---------------------------------------------------------------------------

/** Annonces visibles dans le fil (disponibles et réservées). */
export async function listPublicListings(): Promise<AdoptionListing[]> {
  const snapshot = await getDocs(
    query(collection(db(), LISTINGS), where("status", "in", ["disponible", "reservee"])),
  );
  return snapshot.docs.map((d) => fromSnapshot<AdoptionListing>(d)).sort(byNewest);
}

export async function getListing(id: string): Promise<AdoptionListing | null> {
  const snapshot = await getDoc(doc(db(), LISTINGS, id));
  return snapshot.exists() ? fromSnapshot<AdoptionListing>(snapshot) : null;
}

export async function listMyListings(ownerId: string): Promise<AdoptionListing[]> {
  const snapshot = await getDocs(query(collection(db(), LISTINGS), where("ownerId", "==", ownerId)));
  return snapshot.docs.map((d) => fromSnapshot<AdoptionListing>(d)).sort(byNewest);
}

export async function countAdoptions(): Promise<number> {
  const snapshot = await getCountFromServer(
    query(collection(db(), LISTINGS), where("status", "==", "adoptee")),
  );
  return snapshot.data().count;
}

export async function createListing(owner: UserProfile, input: ListingInput, publish: boolean): Promise<string> {
  const ref = await addDoc(collection(db(), LISTINGS), {
    ...input,
    ownerId: owner.uid,
    ownerName: owner.displayName,
    ownerRole: owner.role,
    ownerCity: owner.city,
    status: publish ? "disponible" : "brouillon",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...(publish ? { publishedAt: serverTimestamp() } : {}),
  });
  return ref.id;
}

/** Enregistre les modifications ; `publish` publie un brouillon. */
export async function updateListing(listing: AdoptionListing, input: ListingInput, publish = false): Promise<void> {
  const publishing = publish && listing.status === "brouillon";
  await updateDoc(doc(db(), LISTINGS, listing.id), {
    ...input,
    updatedAt: serverTimestamp(),
    ...(publishing ? { status: "disponible", publishedAt: serverTimestamp() } : {}),
  });
}

/** Archive l'annonce et refuse les candidatures en cours (candidats informés). */
export async function archiveListing(listing: AdoptionListing): Promise<void> {
  const open = (await listReceivedApplications(listing.id, listing.ownerId)).filter(
    (a) => PENDING_STATUSES.includes(a.status) || a.status === "acceptee",
  );
  const batch = writeBatch(db());
  batch.update(doc(db(), LISTINGS, listing.id), {
    status: "archivee",
    acceptedApplicationId: deleteField(),
    updatedAt: serverTimestamp(),
  });
  open.forEach((a) =>
    batch.update(doc(db(), APPLICATIONS, a.id), {
      status: "refusee",
      decidedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );
  await batch.commit();
  await Promise.all(
    open.map((a) =>
      notify({
        userId: a.applicantId,
        type: "adoption",
        title: `L'annonce de ${listing.name} a été retirée`,
        body: `${listing.ownerName} a retiré l'annonce : votre candidature est close.`,
        link: ADOPTION_ROUTES.myApplications,
        actionLabel: "Voir mes candidatures",
      }),
    ),
  );
}

/** Remet en ligne une annonce archivée. */
export async function republishListing(listing: AdoptionListing): Promise<void> {
  await updateDoc(doc(db(), LISTINGS, listing.id), {
    status: "disponible",
    publishedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteDraft(listing: AdoptionListing): Promise<void> {
  await deleteDoc(doc(db(), LISTINGS, listing.id));
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

// ---------------------------------------------------------------------------
// Favoris
// ---------------------------------------------------------------------------

const favoriteId = (userId: string, listingId: string) => `${userId}_${listingId}`;

export async function listFavoriteIds(userId: string): Promise<string[]> {
  const snapshot = await getDocs(query(collection(db(), FAVORITES), where("userId", "==", userId)));
  return snapshot.docs
    .map((d) => fromSnapshot<{ listingId: string; createdAt?: Timestamp }>(d))
    .sort((a, b) => millis(b.createdAt) - millis(a.createdAt))
    .map((f) => f.listingId);
}

export async function setFavorite(userId: string, listingId: string, favorite: boolean): Promise<void> {
  const ref = doc(db(), FAVORITES, favoriteId(userId, listingId));
  if (favorite) await setDoc(ref, { userId, listingId, createdAt: serverTimestamp() });
  else await deleteDoc(ref);
}

/** Annonces favorites encore lisibles (une annonce retirée par son auteur est ignorée). */
export async function listFavoriteListings(userId: string): Promise<AdoptionListing[]> {
  const ids = await listFavoriteIds(userId);
  const listings = await Promise.all(ids.map((id) => getListing(id).catch(() => null)));
  return listings.filter((l): l is AdoptionListing => Boolean(l) && l?.status !== "brouillon");
}

// ---------------------------------------------------------------------------
// Candidatures
// ---------------------------------------------------------------------------

export const applicationId = (listingId: string, applicantId: string) => `${listingId}_${applicantId}`;

export async function getMyApplication(listingId: string, applicantId: string): Promise<AdoptionApplication | null> {
  const snapshot = await getDoc(doc(db(), APPLICATIONS, applicationId(listingId, applicantId)));
  return snapshot.exists() ? fromSnapshot<AdoptionApplication>(snapshot) : null;
}

export async function listMyApplications(applicantId: string): Promise<AdoptionApplication[]> {
  const snapshot = await getDocs(query(collection(db(), APPLICATIONS), where("applicantId", "==", applicantId)));
  return snapshot.docs.map((d) => fromSnapshot<AdoptionApplication>(d)).sort(byNewest);
}

export async function listReceivedApplications(listingId: string, ownerId: string): Promise<AdoptionApplication[]> {
  const snapshot = await getDocs(
    query(collection(db(), APPLICATIONS), where("listingId", "==", listingId), where("ownerId", "==", ownerId)),
  );
  return snapshot.docs.map((d) => fromSnapshot<AdoptionApplication>(d)).sort(byNewest);
}

/** Toutes les candidatures reçues par un auteur (compteurs de « Mes annonces »). */
export async function listOwnerApplications(ownerId: string): Promise<AdoptionApplication[]> {
  const snapshot = await getDocs(query(collection(db(), APPLICATIONS), where("ownerId", "==", ownerId)));
  return snapshot.docs.map((d) => fromSnapshot<AdoptionApplication>(d));
}

export async function submitApplication(
  listing: AdoptionListing,
  applicant: UserProfile,
  answers: ApplicationAnswers,
): Promise<void> {
  await setDoc(doc(db(), APPLICATIONS, applicationId(listing.id, applicant.uid)), {
    ...answers,
    listingId: listing.id,
    ownerId: listing.ownerId,
    ownerName: listing.ownerName,
    animalName: listing.name,
    animalThumbnail: listing.thumbnail,
    applicantId: applicant.uid,
    applicantName: applicant.displayName,
    applicantCity: answers.housing.city,
    status: "envoyee",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await notify({
    userId: listing.ownerId,
    type: "adoption",
    title: `Nouvelle candidature pour ${listing.name}`,
    body: `${applicant.displayName} (${answers.housing.city}) souhaite adopter ${listing.name}.`,
    link: ADOPTION_ROUTES.received(listing.id),
    actionLabel: "Voir la candidature",
  });
}

export async function withdrawApplication(application: AdoptionApplication): Promise<void> {
  await updateDoc(doc(db(), APPLICATIONS, application.id), {
    status: "retiree",
    withdrawnAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await notify({
    userId: application.ownerId,
    type: "adoption",
    title: `Candidature retirée pour ${application.animalName}`,
    body: `${application.applicantName} a retiré sa candidature.`,
    link: ADOPTION_ROUTES.received(application.listingId),
    actionLabel: "Voir les candidatures",
  });
}

/** Première ouverture par l'auteur de l'annonce : « Envoyée » → « En étude ». */
export async function markInReview(application: AdoptionApplication): Promise<void> {
  if (application.status !== "envoyee") return;
  await updateDoc(doc(db(), APPLICATIONS, application.id), {
    status: "en-etude",
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await notify({
    userId: application.applicantId,
    type: "adoption",
    title: `Votre candidature pour ${application.animalName} est en étude`,
    body: `${application.ownerName} étudie votre dossier.`,
    link: ADOPTION_ROUTES.myApplications,
    actionLabel: "Suivre ma candidature",
  });
}

/** Accepte une candidature : l'animal devient réservé. */
export async function acceptApplication(listing: AdoptionListing, application: AdoptionApplication): Promise<void> {
  const batch = writeBatch(db());
  batch.update(doc(db(), APPLICATIONS, application.id), {
    status: "acceptee",
    decidedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db(), LISTINGS, listing.id), {
    status: "reservee",
    acceptedApplicationId: application.id,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  await notify({
    userId: application.applicantId,
    type: "adoption",
    title: `Candidature acceptée pour ${listing.name}`,
    body: `${listing.ownerName} a accepté votre candidature : ${listing.name} vous est réservé(e).`,
    link: ADOPTION_ROUTES.myApplications,
    actionLabel: "Voir ma candidature",
  });
}

export async function refuseApplication(application: AdoptionApplication): Promise<void> {
  await updateDoc(doc(db(), APPLICATIONS, application.id), {
    status: "refusee",
    decidedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await notify({
    userId: application.applicantId,
    type: "adoption",
    title: `Candidature non retenue pour ${application.animalName}`,
    body: `${application.ownerName} n'a pas retenu votre candidature. Merci pour votre démarche !`,
    link: ADOPTION_ROUTES.myApplications,
    actionLabel: "Voir mes candidatures",
  });
}

/** Annule l'acceptation : la candidature repasse en étude et l'animal redevient disponible. */
export async function cancelAcceptance(listing: AdoptionListing, application: AdoptionApplication): Promise<void> {
  const batch = writeBatch(db());
  batch.update(doc(db(), APPLICATIONS, application.id), {
    status: "en-etude",
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db(), LISTINGS, listing.id), {
    status: "disponible",
    acceptedApplicationId: deleteField(),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  await notify({
    userId: application.applicantId,
    type: "adoption",
    title: `Réservation de ${listing.name} annulée`,
    body: `${listing.ownerName} a annulé l'acceptation : votre candidature est de nouveau en étude.`,
    link: ADOPTION_ROUTES.myApplications,
    actionLabel: "Voir ma candidature",
  });
}

/**
 * Confirme l'adoption : l'annonce passe « Adopté », la candidature retenue « Adoptée »
 * et toutes les autres candidatures ouvertes sont refusées (candidats informés).
 */
export async function confirmAdoption(
  listing: AdoptionListing,
  application: AdoptionApplication,
  others: AdoptionApplication[],
): Promise<void> {
  const refused = others.filter(
    (a) => a.id !== application.id && (PENDING_STATUSES.includes(a.status) || a.status === "acceptee"),
  );
  const batch = writeBatch(db());
  batch.update(doc(db(), LISTINGS, listing.id), {
    status: "adoptee",
    adopterId: application.applicantId,
    adopterName: application.applicantName,
    adoptedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db(), APPLICATIONS, application.id), {
    status: "adoptee",
    adoptedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  refused.forEach((a) =>
    batch.update(doc(db(), APPLICATIONS, a.id), {
      status: "refusee",
      decidedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );
  await batch.commit();
  await Promise.all([
    notify({
      userId: application.applicantId,
      type: "adoption",
      title: `${listing.name} a trouvé sa famille ! 🎉`,
      body: `${listing.ownerName} a confirmé l'adoption. Partagez votre histoire dans Happy Tails !`,
      link: ADOPTION_ROUTES.shareHappyTail(listing.id),
      actionLabel: "Partager mon Happy Tail",
    }),
    ...refused.map((a) =>
      notify({
        userId: a.applicantId,
        type: "adoption",
        title: `${listing.name} a été adopté(e)`,
        body: `${listing.name} a trouvé une famille : votre candidature est close. Merci pour votre démarche !`,
        link: ADOPTION_ROUTES.feed,
        actionLabel: "Découvrir d'autres animaux",
      }),
    ),
  ]);
}

// ---------------------------------------------------------------------------
// Happy Tails
// ---------------------------------------------------------------------------

export async function listHappyTails(): Promise<HappyTail[]> {
  const snapshot = await getDocs(collection(db(), HAPPY_TAILS));
  return snapshot.docs.map((d) => fromSnapshot<HappyTail>(d)).sort(byNewest);
}

export async function getHappyTail(listingId: string): Promise<HappyTail | null> {
  const snapshot = await getDoc(doc(db(), HAPPY_TAILS, listingId));
  return snapshot.exists() ? fromSnapshot<HappyTail>(snapshot) : null;
}

export async function publishHappyTail(
  listing: AdoptionListing,
  adopter: UserProfile,
  afterPhoto: string,
  story: string,
): Promise<void> {
  await setDoc(doc(db(), HAPPY_TAILS, listing.id), {
    listingId: listing.id,
    adopterId: adopter.uid,
    adopterName: adopter.displayName,
    ownerName: listing.ownerName,
    animalName: listing.name,
    species: listing.species,
    beforePhoto: listing.photos[0] ?? listing.thumbnail,
    afterPhoto,
    story,
    likedBy: [],
    createdAt: serverTimestamp(),
  });
  if (listing.ownerId !== adopter.uid) {
    await notify({
      userId: listing.ownerId,
      type: "adoption",
      title: `Des nouvelles de ${listing.name} 💛`,
      body: `${adopter.displayName} a partagé son histoire d'adoption.`,
      link: ADOPTION_ROUTES.happyTails,
      actionLabel: "Lire l'histoire",
    });
  }
}

export async function setHappyTailLike(tailId: string, userId: string, liked: boolean): Promise<void> {
  await updateDoc(doc(db(), HAPPY_TAILS, tailId), { likedBy: liked ? arrayUnion(userId) : arrayRemove(userId) });
}

// ---------------------------------------------------------------------------
// Signalements (traités par l'administration)
// ---------------------------------------------------------------------------

export async function reportContent(input: {
  reporterId: string;
  targetType: ReportTarget;
  targetId: string;
  reason: ReportReason;
  comment: string;
}): Promise<void> {
  await addDoc(collection(db(), REPORTS), { ...input, createdAt: serverTimestamp() });
}
