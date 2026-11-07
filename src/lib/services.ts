import { api } from "./api";
import type {
  BookingInput,
  BookingStatus,
  CategoryIcon,
  DayAvailability,
  ProviderDetail,
  ProviderInput,
  ProviderService,
  ServiceBooking,
  ServiceCategory,
  ServiceInput,
  ServiceProvider,
} from "./services-models";

// Module Services : fonctions appelées par les pages, via les routes /api/services (MongoDB).
// Types, validation et créneaux : lib/services-models.ts.
export * from "./services-models";

const enc = encodeURIComponent;

// Catégories ---------------------------------------------------------------

export function listCategories(): Promise<ServiceCategory[]> {
  return api<ServiceCategory[]>("/api/services/categories", { public: true });
}

export function createCategory(input: { name: string; icon: CategoryIcon }): Promise<ServiceCategory[]> {
  return api<ServiceCategory[]>("/api/services/categories", { method: "POST", body: input });
}

export function updateCategory(id: string, input: { name: string; icon: CategoryIcon; order?: number }): Promise<ServiceCategory[]> {
  return api<ServiceCategory[]>(`/api/services/categories/${enc(id)}`, { method: "PUT", body: input });
}

export function deleteCategory(id: string): Promise<ServiceCategory[]> {
  return api<ServiceCategory[]>(`/api/services/categories/${enc(id)}`, { method: "DELETE" });
}

// Prestataires --------------------------------------------------------------

/** Annuaire : prestataires publiés, filtrés par catégorie, ville et recherche. */
export function listProviders(filters: { categorie?: string; ville?: string; q?: string } = {}): Promise<ServiceProvider[]> {
  const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]);
  return api<ServiceProvider[]>(`/api/services/providers${params.size ? `?${params}` : ""}`, { public: true });
}

/** Profils en attente de validation (administrateur). */
export function listPendingProviders(): Promise<ServiceProvider[]> {
  return api<ServiceProvider[]>("/api/services/providers?status=pending");
}

export function getProvider(id: string): Promise<ProviderDetail> {
  return api<ProviderDetail>(`/api/services/providers/${enc(id)}`, { public: true });
}

/** Son profil prestataire (tous statuts, toutes les prestations), ou `null` s'il n'est pas encore créé. */
export function getMyProvider(): Promise<ProviderDetail | null> {
  return api<ProviderDetail | null>("/api/services/providers/me");
}

/** Crée ou modifie son profil : il (re)part en validation. */
export function saveMyProvider(input: ProviderInput): Promise<ServiceProvider> {
  return api<ServiceProvider>("/api/services/providers/me", { method: "PUT", body: input });
}

export function setProviderStatus(id: string, status: "published" | "rejected", reason = ""): Promise<ServiceProvider> {
  return api<ServiceProvider>(`/api/services/providers/${enc(id)}/status`, { method: "PUT", body: { status, reason } });
}

// Prestations et disponibilités du prestataire connecté --------------------------------

export function listMyServices(): Promise<ProviderService[]> {
  return api<ProviderService[]>("/api/services/providers/me/services");
}

export function createService(input: ServiceInput): Promise<ProviderService> {
  return api<ProviderService>("/api/services/providers/me/services", { method: "POST", body: input });
}

export function updateService(id: string, input: ServiceInput): Promise<ProviderService> {
  return api<ProviderService>(`/api/services/providers/me/services/${enc(id)}`, { method: "PUT", body: input });
}

export function getMyAvailability(): Promise<DayAvailability[]> {
  return api<DayAvailability[]>("/api/services/providers/me/availability");
}

export function saveMyAvailability(days: DayAvailability[]): Promise<DayAvailability[]> {
  return api<DayAvailability[]>("/api/services/providers/me/availability", { method: "PUT", body: { days } });
}

/** Débuts possibles (ISO) pour une prestation un jour donné (AAAA-MM-JJ). */
export function getSlots(providerId: string, serviceId: string, day: string): Promise<string[]> {
  return api<string[]>(`/api/services/providers/${enc(providerId)}/slots?serviceId=${enc(serviceId)}&day=${enc(day)}`, {
    public: true,
  });
}

// Réservations --------------------------------------------------------------

export function listBookings(as: "client" | "provider"): Promise<ServiceBooking[]> {
  return api<ServiceBooking[]>(`/api/services/bookings?as=${as}`);
}

export function createBooking(input: BookingInput): Promise<ServiceBooking> {
  return api<ServiceBooking>("/api/services/bookings", { method: "POST", body: input });
}

/** `confirmed` / `declined` (prestataire), `cancelled` (client). */
export function setBookingStatus(id: string, status: Exclude<BookingStatus, "pending">): Promise<ServiceBooking> {
  return api<ServiceBooking>(`/api/services/bookings/${enc(id)}/status`, { method: "PATCH", body: { status } });
}
