import { addDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Rappels du module 3 (Rendez-vous et rappels), collection `reminders` : même format que
 * la version Flutter, pour que le module 3 web les affiche tels quels.
 */
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
  ownerId: string;
  petName: string;
  petBreed?: string;
  title: string;
  category: ReminderCategory;
  dueAt: Date;
}): Promise<void> {
  await addDoc(collection(db(), "reminders"), {
    ownerId: input.ownerId,
    petName: input.petName.trim(),
    petBreed: input.petBreed ?? null,
    petPhotoUrl: null,
    title: input.title.trim(),
    description: "Conseillé par l'assistant PetCare",
    detail: null,
    category: input.category,
    dueAt: Timestamp.fromDate(input.dueAt),
    done: false,
    doneAt: null,
    createdAt: serverTimestamp(),
  });
}
