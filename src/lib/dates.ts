const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });

/** Les dates de l'API arrivent au format ISO ; les objets Date sont aussi acceptés. */
export type DateInput = string | Date;

export function toDate(date: DateInput): Date {
  return date instanceof Date ? date : new Date(date);
}

/** « il y a 2 heures », « hier », « il y a 3 mois »… */
export function timeAgo(date: DateInput, now = Date.now()): string {
  const millis = toDate(date).getTime();
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

export function isToday(date: DateInput, now = new Date()): boolean {
  return toDate(date).toDateString() === now.toDateString();
}
