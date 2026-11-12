/** Enregistre une action confirmée avec les mêmes routes /api (et donc les mêmes contrôles) que les formulaires. */
import { api, ApiError } from "../api";
import { createHealthRecord } from "../health-records-api";
import { addWeight } from "../pets";
import { actionDate, actionNumber, actionStartsAt, type AssistantAction } from "./actions";
import type { AssistantPet } from "./pets-model";
import { isoDay } from "./prompt";
import { createReminder, type ReminderCategory } from "./reminders";

const NOTE = "Ajouté depuis l'assistant PetCare";
const REMINDER_CATEGORIES: ReminderCategory[] = ["medicament", "soin", "veterinaire", "traitement", "hygiene", "controle"];

/** Lève une `Error` dont le message est affichable tel quel. */
export async function runAction(a: AssistantAction, pet: AssistantPet): Promise<void> {
  try {
    await run(a, pet);
  } catch (error) {
    if (error instanceof ApiError) {
      throw new Error(Object.values(error.fieldErrors).find(Boolean) ?? error.message);
    }
    console.error("Action de l'assistant :", error);
    throw new Error("L'enregistrement a échoué. Vérifiez votre connexion et réessayez.");
  }
}

async function run(a: AssistantAction, pet: AssistantPet): Promise<void> {
  const text = (key: string) => String(a.args[key] ?? "").trim();
  const day = (key: string) => {
    const date = actionDate(a, key);
    return date ? isoDay(date) : "";
  };
  const record = {
    petId: pet.id,
    petName: pet.name,
    veterinarian: text("veterinaire"),
    clinic: text("clinique"),
    lotNumber: "",
    nextDueDate: "",
    dosage: "",
    endDate: "",
  };

  switch (a.type) {
    case "ajouter_soin":
      await createHealthRecord(
        {
          ...record,
          type: text("type") as "visite" | "vaccin" | "examen" | "allergie" | "note",
          title: text("titre"),
          date: day("date"),
          notes: text("notes") || NOTE,
          nextDueDate: text("type") === "vaccin" ? day("prochain_rappel") : "",
        },
        [],
      );
      return;
    case "ajouter_traitement":
      await createHealthRecord(
        { ...record, type: "traitement", title: text("nom"), date: day("debut"), notes: NOTE, dosage: text("posologie"), endDate: day("fin") },
        [],
      );
      return;
    case "creer_rendez_vous":
      await api("/api/appointments", {
        method: "POST",
        body: {
          pet: { id: pet.id, name: pet.name, breed: pet.breed },
          title: text("titre"),
          type: text("type"),
          startsAt: actionStartsAt(a)!.toISOString(),
          durationMinutes: Math.round(actionNumber(a, "duree_minutes") ?? 30),
          place: "autre",
          location: text("lieu"),
          notes: NOTE,
          reminderMinutes: 24 * 60,
          pushReminder: true,
        },
      });
      return;
    case "ajouter_pesee":
      await addWeight(pet.id, { day: day("date") || isoDay(new Date()), weightKg: actionNumber(a, "poids_kg")!, note: NOTE });
      return;
    case "creer_rappel": {
      const due = actionDate(a, "date")!;
      const category = REMINDER_CATEGORIES.find((c) => c === text("categorie")) ?? "soin";
      await createReminder({
        petName: pet.name,
        title: text("titre"),
        category,
        description: NOTE,
        dueAt: new Date(due.getFullYear(), due.getMonth(), due.getDate(), 9),
      });
    }
  }
}
