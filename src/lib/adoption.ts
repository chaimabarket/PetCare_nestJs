// Module Adoption : fonctions appelées par les pages. Les données sont dans MongoDB et passent par
// les routes /api/adoption/* ; les règles d'accès et les notifications sont gérées par le serveur.
//
// Certains paramètres (ownerId, userId…) ne sont plus utilisés : le serveur les déduit de l'utilisateur
// connecté. Ils sont conservés pour ne pas modifier les pages qui appellent ces fonctions.
/* eslint-disable @typescript-eslint/no-unused-vars */
import { api } from "./api";
import {
  applicationId,
  type AdoptionApplication,
  type AdoptionListing,
  type ApplicationAnswers,
  type HappyTail,
  type ListingInput,
  type ReportReason,
  type ReportTarget,
} from "./adoption-models";
import type { UserProfile } from "./users";

// Référentiels, types et fonctions utilitaires (filtres, dates…) partagés avec le serveur.
export * from "./adoption-models";

// ---------------------------------------------------------------------------
// Annonces
// ---------------------------------------------------------------------------

/** Annonces visibles dans le fil (disponibles et réservées). */
export function listPublicListings(): Promise<AdoptionListing[]> {
  return api("/api/adoption/listings", { public: true });
}

/** Une annonce, ou `null` si elle n'existe pas ou n'est pas visible par l'utilisateur. */
export function getListing(id: string): Promise<AdoptionListing | null> {
  return api(`/api/adoption/listings/${encodeURIComponent(id)}`, { public: true });
}

/** Annonces de l'utilisateur connecté (`ownerId` est conservé pour les appelants). */
export function listMyListings(ownerId: string): Promise<AdoptionListing[]> {
  return api("/api/adoption/listings/mine");
}

export async function countAdoptions(): Promise<number> {
  return (await api<{ adopted: number }>("/api/adoption/stats", { public: true })).adopted;
}

/** Crée l'annonce au nom de l'utilisateur connecté (le serveur reprend son nom, son rôle et sa ville). */
export async function createListing(owner: UserProfile, input: ListingInput, publish: boolean): Promise<string> {
  return (await api<AdoptionListing>("/api/adoption/listings", { method: "POST", body: { input, publish } })).id;
}

/** Enregistre les modifications ; `publish` publie un brouillon. */
export async function updateListing(listing: AdoptionListing, input: ListingInput, publish = false): Promise<void> {
  await listingAction(listing.id, { action: "update", input, publish });
}

/** Archive l'annonce et refuse les candidatures en cours (candidats informés). */
export async function archiveListing(listing: AdoptionListing): Promise<void> {
  await listingAction(listing.id, { action: "archive" });
}

/** Remet en ligne une annonce archivée. */
export async function republishListing(listing: AdoptionListing): Promise<void> {
  await listingAction(listing.id, { action: "republish" });
}

export async function deleteDraft(listing: AdoptionListing): Promise<void> {
  await api(`/api/adoption/listings/${encodeURIComponent(listing.id)}`, { method: "DELETE" });
}

function listingAction(id: string, body: Record<string, unknown>) {
  return api<AdoptionListing>(`/api/adoption/listings/${encodeURIComponent(id)}`, { method: "PATCH", body });
}

// ---------------------------------------------------------------------------
// Favoris (de l'utilisateur connecté ; `userId` est conservé pour les appelants)
// ---------------------------------------------------------------------------

export function listFavoriteIds(userId: string): Promise<string[]> {
  return api("/api/adoption/favorites");
}

export async function setFavorite(userId: string, listingId: string, favorite: boolean): Promise<void> {
  await api(`/api/adoption/favorites/${encodeURIComponent(listingId)}`, { method: favorite ? "PUT" : "DELETE" });
}

/** Annonces favorites encore visibles (une annonce retirée par son auteur est ignorée). */
export function listFavoriteListings(userId: string): Promise<AdoptionListing[]> {
  return api("/api/adoption/favorites?include=listings");
}

// ---------------------------------------------------------------------------
// Candidatures
// ---------------------------------------------------------------------------

/** Ma candidature pour une annonce (`applicantId` = utilisateur connecté), ou `null`. */
export async function getMyApplication(listingId: string, applicantId: string): Promise<AdoptionApplication | null> {
  const mine = await api<AdoptionApplication[]>(
    `/api/adoption/applications?scope=mine&listingId=${encodeURIComponent(listingId)}`,
  );
  return mine.find((a) => a.id === applicationId(listingId, applicantId)) ?? null;
}

export function listMyApplications(applicantId: string): Promise<AdoptionApplication[]> {
  return api("/api/adoption/applications?scope=mine");
}

/** Candidatures reçues pour une de mes annonces. */
export function listReceivedApplications(listingId: string, ownerId: string): Promise<AdoptionApplication[]> {
  return api(`/api/adoption/applications?scope=received&listingId=${encodeURIComponent(listingId)}`);
}

/** Toutes les candidatures reçues par l'utilisateur connecté (compteurs de « Mes annonces »). */
export function listOwnerApplications(ownerId: string): Promise<AdoptionApplication[]> {
  return api("/api/adoption/applications?scope=received");
}

/** Envoie la candidature de l'utilisateur connecté ; l'auteur de l'annonce est notifié par le serveur. */
export async function submitApplication(
  listing: AdoptionListing,
  applicant: UserProfile,
  answers: ApplicationAnswers,
): Promise<void> {
  await api("/api/adoption/applications", { method: "POST", body: { listingId: listing.id, answers } });
}

function applicationAction(application: AdoptionApplication, action: string) {
  return api<AdoptionApplication>(`/api/adoption/applications/${encodeURIComponent(application.id)}`, {
    method: "PATCH",
    body: { action },
  });
}

export async function withdrawApplication(application: AdoptionApplication): Promise<void> {
  await applicationAction(application, "withdraw");
}

/** Première ouverture par l'auteur de l'annonce : « Envoyée » → « En étude ». */
export async function markInReview(application: AdoptionApplication): Promise<void> {
  if (application.status !== "envoyee") return;
  await applicationAction(application, "review");
}

/** Accepte une candidature : l'animal devient réservé. */
export async function acceptApplication(listing: AdoptionListing, application: AdoptionApplication): Promise<void> {
  await applicationAction(application, "accept");
}

export async function refuseApplication(application: AdoptionApplication): Promise<void> {
  await applicationAction(application, "refuse");
}

/** Annule l'acceptation : la candidature repasse en étude et l'animal redevient disponible. */
export async function cancelAcceptance(listing: AdoptionListing, application: AdoptionApplication): Promise<void> {
  await applicationAction(application, "cancel-acceptance");
}

/**
 * Confirme l'adoption : l'annonce passe « Adopté », la candidature retenue « Adoptée »
 * et toutes les autres candidatures ouvertes sont refusées (le serveur s'en charge et informe les candidats).
 */
export async function confirmAdoption(
  listing: AdoptionListing,
  application: AdoptionApplication,
  others: AdoptionApplication[],
): Promise<void> {
  await applicationAction(application, "confirm-adoption");
}

// ---------------------------------------------------------------------------
// Happy Tails
// ---------------------------------------------------------------------------

export function listHappyTails(): Promise<HappyTail[]> {
  return api("/api/adoption/happy-tails", { public: true });
}

export function getHappyTail(listingId: string): Promise<HappyTail | null> {
  return api(`/api/adoption/happy-tails/${encodeURIComponent(listingId)}`, { public: true });
}

export async function publishHappyTail(
  listing: AdoptionListing,
  adopter: UserProfile,
  afterPhoto: string,
  story: string,
): Promise<void> {
  await api("/api/adoption/happy-tails", { method: "POST", body: { listingId: listing.id, afterPhoto, story } });
}

export async function setHappyTailLike(tailId: string, userId: string, liked: boolean): Promise<void> {
  await api(`/api/adoption/happy-tails/${encodeURIComponent(tailId)}/like`, { method: liked ? "PUT" : "DELETE" });
}

// ---------------------------------------------------------------------------
// Signalements (traités par l'administration)
// ---------------------------------------------------------------------------

/** Le signalement est enregistré au nom de l'utilisateur connecté (`reporterId` est ignoré). */
export async function reportContent(input: {
  reporterId: string;
  targetType: ReportTarget;
  targetId: string;
  reason: ReportReason;
  comment: string;
}): Promise<void> {
  const { targetType, targetId, reason, comment } = input;
  await api("/api/adoption/reports", { method: "POST", body: { targetType, targetId, reason, comment } });
}
