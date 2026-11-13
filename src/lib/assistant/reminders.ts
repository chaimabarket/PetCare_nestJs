import { api } from "../api";

/** Rappels du module Rendez-vous et rappels (`POST /api/reminders`, MongoDB). */
export type ReminderCategory = "medicament" | "soin" | "veterinaire" | "traitement" | "hygiene" | "controle";

export const REMINDER_CATEGORIES: Record<ReminderCategory, string> = {
  medicament: "Médicament",
  soin: "Soin",
  veterinaire: "Vétérinaire",
  traitement: "Traitement",
  hygiene: "Hygiène",
  controle: "Contrôle",
};

/** Catégorie du rappel devinée d'après son intitulé (modifiable dans la fenêtre). */
export function guessReminderCategory(title: string): ReminderCategory {
  const t = title.toLowerCase();
  if (t.includes("vaccin")) return "veterinaire";
  if (["vermifug", "antiparasit", "puce", "tique"].some((k) => t.includes(k))) return "traitement";
  if (["contrôle", "controle", "bilan", "visite"].some((k) => t.includes(k))) return "controle";
  if (["toilett", "bain", "griffe", "dent", "brossage"].some((k) => t.includes(k))) return "hygiene";
  if (["médicament", "medicament", "comprimé"].some((k) => t.includes(k))) return "medicament";
  return "soin";
}

export async function createReminder(input: {
  petName: string;
  title: string;
  category: ReminderCategory;
  dueAt: Date;
  description?: string;
}): Promise<void> {
  await api("/api/reminders", {
    method: "POST",
    body: {
      petName: input.petName.trim(),
      title: input.title.trim(),
      description: input.description ?? "Conseillé par l'assistant PetCare",
      category: input.category,
      dueAt: input.dueAt.toISOString(),
    },
  });
}
