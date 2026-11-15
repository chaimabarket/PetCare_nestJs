/**
 * Services PetCare proposés à l'assistant : bloc « PRESTATIONS » envoyé au modèle, prestation choisie
 * recopiée dans l'action et créneau vérifié comme sur la page de réservation (sans Firebase : testé avec `npm test`).
 */
import {
  fromMinutes,
  hoursSummary,
  normalizeText,
  WEEKDAY_LABELS,
  weekdayOf,
  zonedDate,
  zonedParts,
  type DayAvailability,
} from "../services-models";
import type { AssistantAction } from "./actions";

/** Prestation publiée et son prestataire, tels que l'assistant les connaît. */
export type CatalogService = {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
  providerId: string;
  providerName: string;
  category: string;
  city: string;
  address: string;
  availability: DayAvailability[];
};

/** Nombre maximal de prestations envoyées au modèle. */
export const SERVICE_CONTEXT_MAX = 40;

const SERVICE_KEYWORDS = [
  "réserv",
  "reserv",
  "vétérin",
  "veterin",
  "véto",
  "veto",
  "vet ",
  "clinique",
  "toilett",
  "groom",
  "salon",
  "pension",
  "garde",
  "promen",
  "dressage",
  "éducat",
  "prestataire",
  "prestation",
  "service",
  "rendez-vous",
  "rdv",
  "book",
  "appointment",
];

/** Vrai si la conversation parle d'un service ou d'une réservation : on joint alors les PRESTATIONS. */
export function isServiceQuestion(text: string): boolean {
  const lower = ` ${text.toLowerCase()} `;
  return SERVICE_KEYWORDS.some((k) => lower.includes(k));
}

const clean = (value: string) => value.replace(/[\s|]+/g, " ").trim();

const dayName = (weekday: number) => WEEKDAY_LABELS[weekday].slice(0, 3).toLowerCase();

/** « lun 09:00-12:00 14:00-18:00 ; mar … ; fermé dim » : les jours fermés sont écrits pour que le modèle ne les propose pas. */
function hoursLine(week: DayAvailability[]): string {
  const days = [...week].sort((a, b) => a.weekday - b.weekday);
  const isOpen = (d: DayAvailability) => d.enabled && d.ranges.length > 0;
  const open = days.filter(isOpen).map((d) => `${dayName(d.weekday)} ${d.ranges.map((r) => `${r.start}-${r.end}`).join(" ")}`);
  if (!open.length) return hoursSummary(week).open || "aucun horaire";
  const closed = [1, 2, 3, 4, 5, 6, 7].filter((w) => !days.some((d) => d.weekday === w && isOpen(d))).map(dayName);
  return [...open, ...(closed.length ? [`fermé ${closed.join(", ")}`] : [])].join(" ; ");
}

/** Bloc « PRESTATIONS » : une ligne par prestation publiée, sans coordonnées personnelles. */
export function buildServiceContext(catalog: CatalogService[]): string {
  const list = catalog.slice(0, SERVICE_CONTEXT_MAX);
  if (!list.length) return "PRESTATIONS (services PetCare réservables) : aucune pour le moment.";
  const lines = list.map((s) =>
    [
      `- id=${s.id}`,
      clean(s.name),
      `${clean(s.providerName)} (${clean(s.category)}, ${clean(s.city)})`,
      `${s.durationMinutes} min`,
      `${s.price} DT`,
      `horaires : ${hoursLine(s.availability)}`,
    ].join(" | "),
  );
  return `PRESTATIONS (services PetCare réservables, heures de Tunis) :\n${lines.join("\n")}`;
}

/** Recopie la prestation choisie dans l'action (prestataire, prix…) ; inchangée si l'identifiant est inconnu. */
export function withServiceDetails(a: AssistantAction, catalog: CatalogService[]): AssistantAction {
  if (a.type !== "reserver_service") return a;
  const service = catalog.find((s) => s.id === String(a.args.service_id ?? "").trim());
  if (!service) return a;
  return {
    ...a,
    args: {
      ...a.args,
      prestataire: service.providerName,
      prestation: service.name,
      duree: service.durationMinutes,
      prix: service.price,
      // La ville n'est ajoutée que si l'adresse ne la contient pas déjà.
      adresse: normalizeText(service.address).includes(normalizeText(service.city))
        ? service.address.trim()
        : [service.address, service.city].filter((v) => v.trim()).join(", "),
    },
  };
}

/** Début de la réservation, à l'heure de Tunis comme les disponibilités des prestataires. */
export function bookingStart(a: AssistantAction): Date | undefined {
  const day = String(a.args.date ?? "").trim();
  const match = /^(\d{1,2})[:hH](\d{2})$/.exec(String(a.args.heure ?? "").trim());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !match) return undefined;
  return zonedDate(day, Number(match[1]) * 60 + Number(match[2]));
}

/**
 * Le créneau demandé est-il parmi les créneaux libres (`GET …/slots`) ? Sinon, phrase qui propose ceux du jour.
 * `undefined` = créneau libre.
 */
export function slotProblem(a: AssistantAction, freeSlots: string[], week: DayAvailability[] = []): string | undefined {
  const start = bookingStart(a);
  if (!start) return "L'heure de la réservation n'est pas valide. À quelle heure souhaitez-vous venir ?";
  if (freeSlots.some((iso) => new Date(iso).getTime() === start.getTime())) return undefined;
  const provider = String(a.args.prestataire ?? "le prestataire");
  const day = String(a.args.date);
  const label = `${day.slice(8, 10)}/${day.slice(5, 7)}`;
  const weekday = weekdayOf(day);
  const openDays = week.filter((d) => d.enabled && d.ranges.length).sort((x, y) => x.weekday - y.weekday);
  if (week.length && !openDays.some((d) => d.weekday === weekday)) {
    const days = openDays.map((d) => WEEKDAY_LABELS[d.weekday].toLowerCase()).join(", ");
    return `${provider} est fermé le ${WEEKDAY_LABELS[weekday].toLowerCase()}${days ? ` (ouvert : ${days})` : ""}. Quel autre jour vous convient ?`;
  }
  if (!freeSlots.length) {
    return `${provider} n'a plus de créneau libre le ${label} pour cette prestation. Voulez-vous un autre jour ?`;
  }
  const times = freeSlots.slice(0, 10).map((iso) => fromMinutes(zonedParts(new Date(iso)).minutes));
  return `${a.args.heure} n'est pas disponible chez ${provider} le ${label}. Créneaux libres ce jour-là : ${times.join(", ")}${
    freeSlots.length > times.length ? "…" : ""
  }. Lequel souhaitez-vous ?`;
}
