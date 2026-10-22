import type { Timestamp } from "firebase/firestore";

const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });

/** « il y a 2 heures », « hier », « il y a 3 mois »… */
export function timeAgo(date: Timestamp | Date, now = Date.now()): string {
  const millis = date instanceof Date ? date.getTime() : date.toMillis();
  const minutes = Math.round((millis - now) / 60_000);
  if (minutes > -1) return "à l'instant";
  if (minutes > -60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours > -24) return rtf.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (days > -30) return rtf.format(days, "day");
  const months = Math.round(days / 30);
  if (months > -12) return rtf.format(months, "month");
  return rtf.format(Math.round(days / 365), "year");
}

export function isToday(date: Timestamp, now = new Date()): boolean {
  return date.toDate().toDateString() === now.toDateString();
}
