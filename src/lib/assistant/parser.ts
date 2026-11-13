import { isoDay, MAX_LISTING_SUGGESTIONS, MAX_REMINDERS } from "./prompt";

/** Rappel proposé par l'assistant, à confirmer par l'utilisateur. */
export type ReminderSuggestion = { title: string; dueAt: Date };

export type ParsedAnswer = { text: string; listingIds: string[]; reminders: ReminderSuggestion[] };

const LISTING_TAG = /\[\[\s*annonce\s*:\s*([A-Za-z0-9_-]+)\s*\]\]/g;
const REMINDER_TAG = /\[\[\s*rappel\s*:\s*([^|\]]+)\|\s*(\d{4}-\d{2}-\d{2})\s*\]\]/g;
/** Début de tag pas encore terminé à la fin d'une réponse en cours d'écriture. */
const PARTIAL_TAG = /\[\[?[^\]]*$/;

/** « 2027-01-30 » → date locale (minuit). */
export function parseDay(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) || isoDay(date) !== value ? undefined : date;
}

/**
 * Retire les tags du texte et garde ce qui est valide.
 *
 * - `[[annonce:ID]]` : seulement si ID est dans `knownIds` (jamais d'animal inventé), 3 au plus.
 * - `[[rappel:Intitulé|AAAA-MM-JJ]]` : seulement si `allowReminders`, date dans les 2 ans à venir, 2 au plus.
 *
 * `streaming` masque aussi un tag en cours d'écriture.
 */
export function parseAnswer(
  raw: string,
  knownIds: Set<string>,
  { allowReminders = false, streaming = false, now = new Date() } = {},
): ParsedAnswer {
  const listingIds: string[] = [];
  for (const match of raw.matchAll(LISTING_TAG)) {
    const id = match[1];
    if (knownIds.has(id) && !listingIds.includes(id) && listingIds.length < MAX_LISTING_SUGGESTIONS) listingIds.push(id);
  }

  const reminders: ReminderSuggestion[] = [];
  if (allowReminders) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start.getTime() + 731 * 86_400_000);
    for (const match of raw.matchAll(REMINDER_TAG)) {
      const title = match[1].replace(/\s+/g, " ").trim();
      const dueAt = parseDay(match[2]);
      if (title.length < 3 || title.length > 80 || !dueAt) continue;
      if (dueAt < start || dueAt > end) continue;
      if (reminders.length < MAX_REMINDERS) reminders.push({ title, dueAt });
    }
  }

  let text = raw.replace(LISTING_TAG, "").replace(REMINDER_TAG, "");
  if (streaming) text = text.replace(PARTIAL_TAG, "");
  text = text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, listingIds, reminders };
}
