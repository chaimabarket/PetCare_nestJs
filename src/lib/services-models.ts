// Module 6 « Services » : types, référentiels, validation, créneaux et transitions des réservations,
// partagés entre le navigateur et les routes /api/services (aucune dépendance hors lib/validation).
// Dates de l'API au format ISO ; heures des disponibilités au format HH:MM, heure de Tunis.
import { validateEmail, validatePhone, type FieldErrors } from "./validation";

// ---------------------------------------------------------------------------
// Référentiels
// ---------------------------------------------------------------------------

export const CATEGORY_ICONS = [
  "veterinaire",
  "toilettage",
  "promenade",
  "pension",
  "boutique",
  "education",
  "pharmacie",
  "transport",
  "autre",
] as const;
export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

/** Icône Material Symbols et libellé de chaque type de catégorie. */
export const CATEGORY_ICON_INFO: Record<CategoryIcon, { label: string; symbol: string }> = {
  veterinaire: { label: "Vétérinaire", symbol: "stethoscope" },
  toilettage: { label: "Toilettage", symbol: "content_cut" },
  promenade: { label: "Promenade", symbol: "directions_walk" },
  pension: { label: "Pension", symbol: "night_shelter" },
  boutique: { label: "Boutique", symbol: "storefront" },
  education: { label: "Éducation", symbol: "school" },
  pharmacie: { label: "Pharmacie", symbol: "medication" },
  transport: { label: "Transport", symbol: "local_taxi" },
  autre: { label: "Autre", symbol: "pets" },
};

export type ServiceCategory = { id: string; name: string; icon: CategoryIcon; order: number };

/** Catégories proposées tant que l'administrateur n'en a pas enregistré (identifiants `default-…`). */
export const DEFAULT_CATEGORIES: ServiceCategory[] = [
  { name: "Vétérinaires", icon: "veterinaire" as const },
  { name: "Toiletteurs", icon: "toilettage" as const },
  { name: "Promeneurs", icon: "promenade" as const },
  { name: "Pensions", icon: "pension" as const },
  { name: "Boutiques", icon: "boutique" as const },
  { name: "Autres", icon: "autre" as const },
].map((c, order) => ({ ...c, id: `default-${order}`, order }));

export const PROVIDER_STATUSES = ["pending", "published", "rejected"] as const;
export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];
export const PROVIDER_STATUS_INFO: Record<ProviderStatus, { label: string; tone: "amber" | "green" | "red" }> = {
  pending: { label: "En attente de validation", tone: "amber" },
  published: { label: "Publié", tone: "green" },
  rejected: { label: "Refusé", tone: "red" },
};

export const SERVICE_STATUSES = ["published", "archived"] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

export const BOOKING_STATUSES = ["pending", "confirmed", "declined", "cancelled"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export const BOOKING_STATUS_INFO: Record<BookingStatus, { label: string; tone: "amber" | "green" | "red" | "grey" }> = {
  pending: { label: "En attente", tone: "amber" },
  confirmed: { label: "Confirmée", tone: "green" },
  declined: { label: "Refusée", tone: "red" },
  cancelled: { label: "Annulée", tone: "grey" },
};

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export const WEEKDAY_LABELS: Record<number, string> = {
  1: "Lundi",
  2: "Mardi",
  3: "Mercredi",
  4: "Jeudi",
  5: "Vendredi",
  6: "Samedi",
  7: "Dimanche",
};

/** Fuseau des disponibilités : les heures saisies par un prestataire sont celles de Tunis. */
export const APP_TIME_ZONE = "Africa/Tunis";

export const CATEGORY_NAME_MIN = 2;
export const CATEGORY_NAME_MAX = 40;
export const PROVIDER_NAME_MAX = 80;
export const CITY_MAX = 60;
export const ADDRESS_MAX = 200;
export const PROVIDER_DESCRIPTION_MAX = 1000;
export const SERVICE_NAME_MAX = 80;
export const SERVICE_DESCRIPTION_MAX = 500;
export const DURATION_MIN = 5;
/** Une pension se compte à la nuit : 24 h maximum par prestation. */
export const DURATION_MAX = 1440;
/** À partir de 12 h, une prestation se compte « à la nuit » : seule l'heure d'arrivée doit être dans une plage. */
export const OVERNIGHT_MINUTES = 12 * 60;
export const PRICE_MAX = 100_000;
export const MAX_RANGES = 6;
export const BOOKING_NOTES_MAX = 500;
export const ANIMAL_NAME_MAX = 60;
export const REJECTION_REASON_MAX = 300;
/** Pas des créneaux proposés à la réservation. */
export const SLOT_STEP_MINUTES = 30;

export const SERVICES_ROUTES = {
  directory: "/services",
  category: (name: string) => `/services?categorie=${encodeURIComponent(name)}`,
  provider: (id: string) => `/services/${id}`,
  book: (id: string, serviceId?: string) => `/services/${id}/reserver${serviceId ? `?prestation=${serviceId}` : ""}`,
  mySpace: "/services/mon-espace",
  myBookings: "/services/mes-reservations",
  admin: "/services/admin",
};

// ---------------------------------------------------------------------------
// Types (format JSON de l'API)
// ---------------------------------------------------------------------------

export type ProviderInput = {
  name: string;
  category: string;
  city: string;
  description: string;
  phone: string;
  email: string;
  address: string;
  /** Photo compressée (data URL JPEG) ou "". */
  photo: string;
};

export const EMPTY_PROVIDER_INPUT: ProviderInput = {
  name: "",
  category: "",
  city: "",
  description: "",
  phone: "",
  email: "",
  address: "",
  photo: "",
};

export type ServiceProvider = ProviderInput & {
  id: string;
  ownerId: string;
  status: ProviderStatus;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
};

export type ServiceInput = {
  name: string;
  category: string;
  durationMinutes: number;
  /** Prix indicatif en dinars (pas de paiement en ligne). */
  price: number;
  description: string;
  status: ServiceStatus;
};

export type ProviderService = ServiceInput & { id: string; providerId: string; createdAt: string; updatedAt: string };

export type TimeRange = { start: string; end: string };
export type DayAvailability = { weekday: number; enabled: boolean; ranges: TimeRange[] };

export type BookingInput = {
  serviceId: string;
  /** Début ISO, choisi parmi les créneaux proposés. */
  dateTime: string;
  animalName: string;
  /** Identifiant de l'animal dans « Mes animaux », s'il a été choisi dans la liste. */
  petId?: string;
  notes: string;
};

export type ServiceBooking = {
  id: string;
  providerId: string;
  clientId: string;
  clientName: string;
  providerName: string;
  serviceId: string;
  serviceName: string;
  durationMinutes: number;
  price: number;
  animalName: string;
  petId?: string;
  dateTime: string;
  endsAt: string;
  notes: string;
  status: BookingStatus;
  /** Rendez-vous créé dans l'agenda (module Rendez-vous). */
  appointmentId?: string;
  createdAt: string;
  updatedAt: string;
};

/** Fiche publique d'un prestataire : prestations publiées (toutes pour son propriétaire) et disponibilités. */
export type ProviderDetail = ServiceProvider & { services: ProviderService[]; availability: DayAvailability[] };

/** Carte de l'annuaire : prestataire, horaires, nombre de prestations publiées et prix de la moins chère. */
export type ProviderSummary = ServiceProvider & {
  availability: DayAvailability[];
  serviceCount: number;
  /** Prix minimum des prestations publiées (absent s'il n'y en a pas). */
  minPrice?: number;
  /** Prestation la moins chère (« Consultation dès 45 DT »). */
  cheapestService?: string;
};

// ---------------------------------------------------------------------------
// Validation (même code dans les formulaires et dans les routes)
// ---------------------------------------------------------------------------

type Raw = Record<string, unknown>;
const isRecord = (v: unknown): v is Raw => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const firstError = (errors: Record<string, string | undefined>) => Object.values(errors).find(Boolean);
export { firstError };

export type CategoryField = "name" | "icon";

export function validateCategory(raw: unknown): { value: { name: string; icon: CategoryIcon }; errors: FieldErrors<CategoryField> } {
  const d = isRecord(raw) ? raw : {};
  const icon = CATEGORY_ICONS.includes(d.icon as CategoryIcon) ? (d.icon as CategoryIcon) : null;
  const value = { name: str(d.name), icon: icon ?? "autre" };
  const errors: FieldErrors<CategoryField> = {};
  if (value.name.length < CATEGORY_NAME_MIN || value.name.length > CATEGORY_NAME_MAX) {
    errors.name = `Le nom contient ${CATEGORY_NAME_MIN} à ${CATEGORY_NAME_MAX} caractères.`;
  }
  if (!icon) errors.icon = "Icône inconnue.";
  return { value, errors };
}

export type ProviderField = keyof ProviderInput;

export function validateProvider(raw: unknown): { value: ProviderInput; errors: FieldErrors<ProviderField> } {
  const d = isRecord(raw) ? raw : {};
  const value: ProviderInput = {
    name: str(d.name),
    category: str(d.category),
    city: str(d.city),
    description: str(d.description),
    phone: str(d.phone),
    email: str(d.email).toLowerCase(),
    address: str(d.address),
    photo: typeof d.photo === "string" ? d.photo : "",
  };
  const errors: FieldErrors<ProviderField> = {};
  if (value.name.length < 2 || value.name.length > PROVIDER_NAME_MAX) errors.name = `Le nom contient 2 à ${PROVIDER_NAME_MAX} caractères.`;
  if (!value.category) errors.category = "Choisissez une catégorie.";
  else if (value.category.length > CATEGORY_NAME_MAX) errors.category = "Catégorie inconnue.";
  if (value.city.length < 2 || value.city.length > CITY_MAX) errors.city = "Indiquez la ville.";
  if (value.description.length > PROVIDER_DESCRIPTION_MAX) errors.description = `${PROVIDER_DESCRIPTION_MAX} caractères maximum.`;
  if (!value.phone) errors.phone = "Le téléphone est obligatoire.";
  else errors.phone = validatePhone(value.phone);
  errors.email = validateEmail(value.email);
  if (value.address.length > ADDRESS_MAX) errors.address = `${ADDRESS_MAX} caractères maximum.`;
  if (value.photo && !/^data:image\/(jpeg|png|webp);base64,/.test(value.photo)) errors.photo = "Photo invalide.";
  return { value, errors };
}

export type ServiceField = keyof ServiceInput;

export function validateService(raw: unknown): { value: ServiceInput; errors: FieldErrors<ServiceField> } {
  const d = isRecord(raw) ? raw : {};
  const num = (v: unknown) => (typeof v === "number" ? v : Number(String(v ?? "").replace(",", ".")));
  const durationMinutes = num(d.durationMinutes);
  const price = num(d.price);
  const value: ServiceInput = {
    name: str(d.name),
    category: str(d.category),
    durationMinutes,
    price: Math.round(price * 100) / 100,
    description: str(d.description),
    status: d.status === "archived" ? "archived" : "published",
  };
  const errors: FieldErrors<ServiceField> = {};
  if (value.name.length < 2 || value.name.length > SERVICE_NAME_MAX) errors.name = `Le nom contient 2 à ${SERVICE_NAME_MAX} caractères.`;
  if (!value.category) errors.category = "Choisissez une catégorie.";
  else if (value.category.length > CATEGORY_NAME_MAX) errors.category = "Catégorie inconnue.";
  if (!Number.isInteger(durationMinutes) || durationMinutes < DURATION_MIN || durationMinutes > DURATION_MAX) {
    errors.durationMinutes = `La durée est comprise entre ${DURATION_MIN} minutes et 24 heures (une nuit).`;
  }
  const moreThanTwoDecimals = Math.abs(price * 100 - Math.round(price * 100)) > 1e-6;
  if (!Number.isFinite(price) || price < 0 || price > PRICE_MAX || moreThanTwoDecimals) {
    errors.price = `Le prix est un montant entre 0 et ${PRICE_MAX.toLocaleString("fr-FR")} DT (2 décimales maximum).`;
  }
  if (d.status !== undefined && !SERVICE_STATUSES.includes(d.status as ServiceStatus)) errors.status = "Statut inconnu.";
  if (value.description.length > SERVICE_DESCRIPTION_MAX) errors.description = `${SERVICE_DESCRIPTION_MAX} caractères maximum.`;
  return { value, errors };
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
export const fromMinutes = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** Valide les disponibilités de la semaine : 7 jours, 6 plages maximum par jour, HH:MM, début avant fin, sans chevauchement. */
export function validateAvailability(raw: unknown): { value: DayAvailability[]; error?: string } {
  if (!Array.isArray(raw)) return { value: [], error: "Disponibilités invalides." };
  const byDay = new Map<number, DayAvailability>();
  for (const item of raw) {
    const d = isRecord(item) ? item : {};
    const weekday = d.weekday;
    if (typeof weekday !== "number" || !WEEKDAYS.includes(weekday as (typeof WEEKDAYS)[number])) {
      return { value: [], error: "Jour invalide (1 = lundi … 7 = dimanche)." };
    }
    if (byDay.has(weekday)) return { value: [], error: `${WEEKDAY_LABELS[weekday]} est indiqué deux fois.` };
    if (!Array.isArray(d.ranges)) return { value: [], error: `${WEEKDAY_LABELS[weekday]} : plages invalides.` };
    if (d.ranges.length > MAX_RANGES) return { value: [], error: `${WEEKDAY_LABELS[weekday]} : ${MAX_RANGES} plages maximum.` };
    const ranges: TimeRange[] = [];
    for (const r of d.ranges) {
      const range = isRecord(r) ? { start: str(r.start), end: str(r.end) } : { start: "", end: "" };
      if (!TIME.test(range.start) || !TIME.test(range.end)) {
        return { value: [], error: `${WEEKDAY_LABELS[weekday]} : heure invalide (format HH:MM).` };
      }
      if (toMinutes(range.start) >= toMinutes(range.end)) {
        return { value: [], error: `${WEEKDAY_LABELS[weekday]} : le début (${range.start}) doit être avant la fin (${range.end}).` };
      }
      ranges.push(range);
    }
    ranges.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    for (let i = 1; i < ranges.length; i++) {
      if (toMinutes(ranges[i].start) < toMinutes(ranges[i - 1].end)) {
        return { value: [], error: `${WEEKDAY_LABELS[weekday]} : les plages ${ranges[i - 1].start}–${ranges[i - 1].end} et ${ranges[i].start}–${ranges[i].end} se chevauchent.` };
      }
    }
    const enabled = d.enabled === true;
    if (enabled && !ranges.length) return { value: [], error: `${WEEKDAY_LABELS[weekday]} : ajoutez au moins une plage ou fermez ce jour.` };
    byDay.set(weekday, { weekday, enabled, ranges });
  }
  return { value: WEEKDAYS.map((w) => byDay.get(w) ?? { weekday: w, enabled: false, ranges: [] }) };
}

export const EMPTY_WEEK: DayAvailability[] = WEEKDAYS.map((weekday) => ({ weekday, enabled: false, ranges: [] }));

export type BookingField = "serviceId" | "dateTime" | "animalName" | "petId" | "notes";

/** Champs d'une demande de réservation ; `now` : la date doit être à venir. */
export function validateBooking(raw: unknown, now = new Date()): { value: BookingInput; errors: FieldErrors<BookingField> } {
  const d = isRecord(raw) ? raw : {};
  const value: BookingInput = {
    serviceId: str(d.serviceId),
    dateTime: str(d.dateTime),
    animalName: str(d.animalName),
    ...(str(d.petId) && { petId: str(d.petId) }),
    notes: str(d.notes),
  };
  const errors: FieldErrors<BookingField> = {};
  if (!value.serviceId) errors.serviceId = "Choisissez une prestation.";
  const date = new Date(value.dateTime);
  if (!value.dateTime || Number.isNaN(date.getTime())) errors.dateTime = "Choisissez une date et un horaire.";
  else if (date <= now) errors.dateTime = "La date de la réservation doit être à venir.";
  if (!value.animalName) errors.animalName = "Indiquez l'animal concerné.";
  else if (value.animalName.length > ANIMAL_NAME_MAX) errors.animalName = `${ANIMAL_NAME_MAX} caractères maximum.`;
  if (value.petId && value.petId.length > 128) errors.petId = "Animal invalide.";
  if (value.notes.length > BOOKING_NOTES_MAX) errors.notes = `${BOOKING_NOTES_MAX} caractères maximum.`;
  return { value, errors };
}

// ---------------------------------------------------------------------------
// Transitions d'une réservation : seule une demande en attente change de statut.
// ---------------------------------------------------------------------------

export type BookingActor = "client" | "provider";

/** Statuts que chaque partie peut donner à une réservation en attente. */
export const BOOKING_TRANSITIONS: Record<BookingActor, BookingStatus[]> = {
  provider: ["confirmed", "declined"],
  client: ["cancelled"],
};

export function canChangeBooking(current: BookingStatus, next: BookingStatus, actor: BookingActor): boolean {
  return current === "pending" && BOOKING_TRANSITIONS[actor].includes(next);
}

// ---------------------------------------------------------------------------
// Fuseau horaire et créneaux
// ---------------------------------------------------------------------------

const parts = (date: Date, timeZone: string) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour, minute: +p.minute };
};

/** Jour (AAAA-MM-JJ), jour de la semaine (1 = lundi) et minutes depuis minuit d'une date, à l'heure de `timeZone`. */
export function zonedParts(date: Date, timeZone = APP_TIME_ZONE): { day: string; weekday: number; minutes: number } {
  const p = parts(date, timeZone);
  const day = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  return { day, weekday: weekdayOf(day), minutes: p.hour * 60 + p.minute };
}

/** Jour de la semaine d'un jour AAAA-MM-JJ (1 = lundi … 7 = dimanche). */
export function weekdayOf(day: string): number {
  return ((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
}

/** Instant correspondant à `day` à `minutes` (heure locale de `timeZone`). */
export function zonedDate(day: string, minutes: number, timeZone = APP_TIME_ZONE): Date {
  const [y, m, d] = day.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  const p = parts(new Date(guess), timeZone);
  const offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - guess;
  return new Date(guess - offset);
}

export const isOvernight = (durationMinutes: number) => durationMinutes >= OVERNIGHT_MINUTES;

/**
 * La réservation [start, start + durée] tient-elle dans une plage du jour ? Pour une prestation « à la nuit »
 * (12 h ou plus, pension), seule l'heure d'arrivée doit être dans une plage.
 */
export function fitsAvailability(start: Date, durationMinutes: number, week: DayAvailability[], timeZone = APP_TIME_ZONE): boolean {
  const { weekday, minutes } = zonedParts(start, timeZone);
  const day = week.find((d) => d.weekday === weekday);
  if (!day?.enabled) return false;
  return day.ranges.some(
    (r) => minutes >= toMinutes(r.start) && (isOvernight(durationMinutes) ? minutes < toMinutes(r.end) : minutes + durationMinutes <= toMinutes(r.end)),
  );
}

/**
 * Créneaux libres d'un jour (toutes les 30 min dans les plages), à venir et sans chevauchement avec les
 * réservations en attente ou confirmées du prestataire (`busy`).
 */
export function availableSlots({
  day,
  week,
  durationMinutes,
  busy,
  now = new Date(),
  timeZone = APP_TIME_ZONE,
}: {
  day: string;
  week: DayAvailability[];
  durationMinutes: number;
  busy: { start: Date; end: Date }[];
  now?: Date;
  timeZone?: string;
}): Date[] {
  const availability = week.find((d) => d.weekday === weekdayOf(day));
  if (!availability?.enabled) return [];
  const slots: Date[] = [];
  for (const range of availability.ranges) {
    const from = toMinutes(range.start);
    const to = toMinutes(range.end);
    const last = isOvernight(durationMinutes) ? to - 1 : to - durationMinutes;
    for (let t = from; t <= last; t += SLOT_STEP_MINUTES) {
      const start = zonedDate(day, t, timeZone);
      const end = new Date(start.getTime() + durationMinutes * 60_000);
      if (start <= now) continue;
      if (busy.some((b) => b.start < end && start < b.end)) continue;
      slots.push(start);
    }
  }
  return slots;
}

/**
 * État d'ouverture à un instant donné (heure de Tunis) : « Ouvert • Ferme à 20:00 », « Fermé • Ouvre à 14:00 »,
 * « Fermé aujourd'hui ».
 */
export function openingStatus(week: DayAvailability[], now = new Date(), timeZone = APP_TIME_ZONE): { open: boolean; label: string } {
  const { weekday, minutes } = zonedParts(now, timeZone);
  const day = week.find((d) => d.weekday === weekday);
  if (!day?.enabled || !day.ranges.length) return { open: false, label: "Fermé aujourd'hui" };
  const current = day.ranges.find((r) => minutes >= toMinutes(r.start) && minutes < toMinutes(r.end));
  if (current) return { open: true, label: `Ouvert • Ferme à ${current.end}` };
  const next = day.ranges.find((r) => toMinutes(r.start) > minutes);
  return { open: false, label: next ? `Fermé • Ouvre à ${next.start}` : "Fermé pour aujourd'hui" };
}

/** Résumé des horaires : « Lun – Ven : 09:00 – 18:30 », jours fermés listés à part. */
export function hoursSummary(week: DayAvailability[]): { open: string; closed: string } {
  const short = (w: number) => WEEKDAY_LABELS[w].slice(0, 3);
  const openDays = week.filter((d) => d.enabled && d.ranges.length);
  if (!openDays.length) return { open: "Horaires non renseignés", closed: "" };
  const same = openDays.every((d) => JSON.stringify(d.ranges) === JSON.stringify(openDays[0].ranges));
  const consecutive = openDays.every((d, i) => i === 0 || d.weekday === openDays[i - 1].weekday + 1);
  const ranges = (d: DayAvailability) => d.ranges.map((r) => `${r.start} – ${r.end}`).join(", ");
  const closed = week.filter((d) => !d.enabled || !d.ranges.length).map((d) => WEEKDAY_LABELS[d.weekday].toLowerCase());
  const days = same && consecutive && openDays.length > 1
    ? `${short(openDays[0].weekday)} – ${short(openDays[openDays.length - 1].weekday)}`
    : openDays.map((d) => short(d.weekday)).join(", ");
  return {
    open: same ? `${days} : ${ranges(openDays[0])}` : "Horaires variables selon les jours",
    closed: closed.length ? `Fermé le ${closed.join(", ")}` : "Ouvert 7 jours sur 7",
  };
}

// ---------------------------------------------------------------------------
// Affichage
// ---------------------------------------------------------------------------

/** « 45 DT », « 12,50 DT », « Gratuit ». */
export function formatPrice(price: number): string {
  if (price === 0) return "Gratuit";
  return `${price.toLocaleString("fr-FR", { minimumFractionDigits: Number.isInteger(price) ? 0 : 2, maximumFractionDigits: 2 })} DT`;
}

/** « 30 min », « 1 h 30 », « 1 nuit ». */
export function formatDuration(minutes: number): string {
  if (minutes >= DURATION_MAX) return "1 nuit";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

/** « mardi 19 novembre à 14:30 » (heure de Tunis). */
export function formatDateTime(iso: string | Date, timeZone = APP_TIME_ZONE): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  const day = new Intl.DateTimeFormat("fr-FR", { timeZone, weekday: "long", day: "numeric", month: "long" }).format(date);
  const time = new Intl.DateTimeFormat("fr-FR", { timeZone, hour: "2-digit", minute: "2-digit" }).format(date);
  return `${day} à ${time}`;
}

/** Recherche sans accents ni majuscules. */
export const normalizeText = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
