/** Dates en français pour le module Rendez-vous (mêmes libellés que l'application Flutter). */

const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const SHORT_DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
const SHORT_MONTHS = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

const two = (n: number) => String(n).padStart(2, "0");

/** 09:30 */
export const formatTime = (d: Date) => `${two(d.getHours())}:${two(d.getMinutes())}`;

/** Mardi 12 novembre 2026 */
export const formatLongDate = (d: Date) => `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

/** Mercredi 13 novembre */
export const formatDayTitle = (d: Date) => `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;

/** Novembre 2026 */
export function formatMonthYear(d: Date) {
  const month = MONTHS[d.getMonth()];
  return `${month[0].toUpperCase()}${month.slice(1)} ${d.getFullYear()}`;
}

/** 12 nov. */
export const formatDayMonth = (d: Date) => `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;

/** Jeu. 14 nov. */
export const formatShortDayMonth = (d: Date) => `${SHORT_DAYS[d.getDay()]}. ${formatDayMonth(d)}`;

/** Lundi 11 nov. à 10:00 */
export const formatReminderMoment = (d: Date) => `${DAYS[d.getDay()]} ${formatDayMonth(d)} à ${formatTime(d)}`;

/** Mar */
export const shortDayName = (d: Date) => SHORT_DAYS[d.getDay()];

/** 45 min, 1 h, 1 h 30 */
export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${two(m)}`;
}

/** 45,00 DT (prix indicatif, aucun paiement en ligne) */
export const formatPrice = (price: number) => `${price.toFixed(2).replace(".", ",")} DT`;

/** Le même jour à minuit, pour comparer des jours sans l'heure. */
export const dayOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);

export const addMinutes = (d: Date, minutes: number) => new Date(d.getTime() + minutes * 60_000);

export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const dayDiff = (d: Date, now: Date) => Math.round((dayOnly(d).getTime() - dayOnly(now).getTime()) / 86_400_000);

/** « Dans 3 jours », « Aujourd'hui », « Demain », « Il y a 2 jours ». */
export function formatRelativeDay(d: Date, now = new Date()) {
  const diff = dayDiff(d, now);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Demain";
  if (diff === -1) return "Hier";
  if (diff > 1) return `Dans ${diff} jours`;
  return `Il y a ${-diff} jours`;
}

/** « Sans rappel », « 1 heure avant », « 1 jour avant », « 2 jours avant ». */
export function formatReminderOffset(minutes: number) {
  if (minutes <= 0) return "Sans rappel";
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1 ? "1 jour avant" : `${days} jours avant`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "1 heure avant" : `${hours} heures avant`;
  }
  return `${minutes} min avant`;
}

/** Numéro de semaine ISO 8601 (« Semaine 46 »). */
export function isoWeekNumber(d: Date) {
  const date = dayOnly(d);
  const weekday = (date.getDay() + 6) % 7; // lundi = 0
  const thursday = addDays(date, 3 - weekday);
  const firstDay = new Date(thursday.getFullYear(), 0, 1);
  return Math.floor(dayDiff(thursday, firstDay) / 7) + 1;
}
