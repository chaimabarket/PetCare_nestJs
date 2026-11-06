import { addDays, addMinutes, dayOnly } from "./format";
import type { Appointment, AppointmentChange, PetOption, Reminder } from "./types";

/**
 * Données fictives en attendant l'API MongoDB.
 * Les dates sont calculées à partir d'aujourd'hui pour que l'agenda ait toujours du contenu.
 */

/** Utilisateur fictif connecté (propriétaire des animaux). */
export const CURRENT_USER_ID = "moi";

export const MOCK_PETS: PetOption[] = [
  { id: "pet-milo", name: "Milo", breed: "Chat européen" },
  { id: "pet-nala", name: "Nala", breed: "Golden Retriever" },
  { id: "pet-rocky", name: "Rocky", breed: "Berger allemand" },
];

const CLINIC = {
  providerId: "prov-clinique",
  providerName: "Clinique Vétérinaire du Lac",
  providerAddress: "12 rue du Lac Léman, Les Berges du Lac, Tunis",
  providerPhone: "+216 71 860 200",
};

const SALON = {
  providerId: "prov-salon",
  providerName: "Toilettage Câlin",
  providerAddress: "45 avenue Habib Bourguiba, La Marsa",
  providerPhone: "+216 71 774 310",
};

/** Le prochain créneau à la demi-heure, au moins `minutes` après `now`. */
function nextHalfHour(now: Date, minutes: number) {
  const d = addMinutes(now, minutes);
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() <= 30 ? 30 : 60);
  return d;
}

const at = (day: Date, hours: number, minutes = 0) =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);

const created = (when: Date, by = CURRENT_USER_ID): AppointmentChange => ({ action: "create", at: when, by });

const pet = (name: string) => {
  const p = MOCK_PETS.find((x) => x.name === name)!;
  return { petId: p.id, petName: p.name, petBreed: p.breed };
};

const personal = { place: "domicile" as const, location: "", notes: "", pushReminder: true, version: 1 };

export function createMockData(now: Date): { appointments: Appointment[]; reminders: Reminder[] } {
  const today = dayOnly(now);
  const tomorrow = addDays(today, 1);
  // Les deux prochains rendez-vous restent dans les horaires d'ouverture : le soir, ils passent au lendemain.
  const soon = nextHalfHour(now, 90);
  const vaccineStart = soon.getHours() >= 9 && soon.getHours() < 17 && soon < tomorrow ? soon : at(tomorrow, 9, 30);
  const groomingStart = vaccineStart.getHours() < 15 ? addMinutes(vaccineStart, 150) : at(tomorrow, 11);

  const appointments: Appointment[] = [
    {
      id: "rdv-1",
      ownerId: CURRENT_USER_ID,
      ...pet("Milo"),
      ...CLINIC,
      serviceId: "srv-vaccin",
      title: "Rappel vaccin typhus-coryza",
      description: "Vaccination annuelle",
      type: "vaccin",
      startsAt: vaccineStart,
      endsAt: addMinutes(vaccineStart, 30),
      status: "confirmed",
      price: 45,
      place: "autre",
      location: CLINIC.providerAddress,
      notes: "Milo est stressé en voiture : prévoir la caisse de transport avec sa couverture.",
      reminderMinutes: 1440,
      pushReminder: true,
      version: 2,
      changes: [
        created(at(addDays(today, -6), 17, 42)),
        { action: "confirm", at: at(addDays(today, -5), 14, 25), by: CLINIC.providerId },
      ],
    },
    {
      id: "rdv-2",
      ownerId: CURRENT_USER_ID,
      ...pet("Nala"),
      ...SALON,
      serviceId: "srv-toilettage",
      title: "Bain & coupe d'été",
      description: "Toilettage complet",
      type: "toilettage",
      startsAt: groomingStart,
      endsAt: addMinutes(groomingStart, 90),
      status: "planned",
      price: 60,
      place: "autre",
      location: SALON.providerAddress,
      notes: "Peau sensible : shampoing hypoallergénique s'il vous plaît.",
      reminderMinutes: 60,
      pushReminder: true,
      version: 1,
      changes: [created(at(addDays(today, -2), 15, 34))],
    },
    {
      id: "rdv-3",
      ownerId: CURRENT_USER_ID,
      ...pet("Milo"),
      ...personal,
      title: "Brossage approfondi & coupe des griffes",
      type: "soin",
      startsAt: at(tomorrow, 15, 30),
      endsAt: at(tomorrow, 16, 15),
      status: "confirmed",
      notes: "Prévoir serviette absorbante et friandises.",
      reminderMinutes: 60,
      changes: [created(at(addDays(today, -1), 12, 17))],
    },
    {
      id: "rdv-4",
      ownerId: CURRENT_USER_ID,
      ...pet("Rocky"),
      ...personal,
      title: "Séance d'éducation au rappel",
      type: "education",
      startsAt: at(tomorrow, 10),
      endsAt: at(tomorrow, 11),
      status: "cancelled",
      place: "exterieur",
      location: "Parc du Belvédère, Tunis",
      cancelReason: "Pluie annoncée toute la matinée",
      reminderMinutes: 1440,
      version: 2,
      changes: [
        created(at(addDays(today, -4), 11, 8)),
        { action: "cancel", at: at(addDays(today, -1), 12, 17), by: CURRENT_USER_ID, reason: "Pluie annoncée toute la matinée" },
      ],
    },
    {
      id: "rdv-5",
      ownerId: CURRENT_USER_ID,
      ...pet("Nala"),
      ...CLINIC,
      serviceId: "srv-consultation",
      title: "Contrôle annuel",
      description: "Consultation générale",
      type: "veterinaire",
      startsAt: at(addDays(today, 3), 9),
      endsAt: at(addDays(today, 3), 9, 30),
      status: "planned",
      price: 50,
      place: "autre",
      location: CLINIC.providerAddress,
      notes: "",
      reminderMinutes: 1440,
      pushReminder: true,
      version: 1,
      changes: [created(at(addDays(today, -1), 12, 17))],
    },
    {
      id: "rdv-6",
      ownerId: CURRENT_USER_ID,
      ...pet("Rocky"),
      ...personal,
      title: "Grande promenade en forêt",
      type: "garde",
      startsAt: at(addDays(today, 6), 14),
      endsAt: at(addDays(today, 6), 16),
      status: "confirmed",
      place: "exterieur",
      location: "Forêt de Gammarth",
      notes: "Emporter la gourde et la longe de 10 m.",
      reminderMinutes: 2880,
      changes: [created(at(addDays(today, -3), 18, 51))],
    },
    {
      id: "rdv-7",
      ownerId: CURRENT_USER_ID,
      ...pet("Milo"),
      ...CLINIC,
      serviceId: "srv-consultation",
      title: "Consultation de contrôle",
      description: "Suivi après stérilisation",
      type: "veterinaire",
      startsAt: at(addDays(today, -2), 11),
      endsAt: at(addDays(today, -2), 11, 30),
      status: "completed",
      price: 40,
      place: "autre",
      location: CLINIC.providerAddress,
      notes: "",
      reminderMinutes: 1440,
      pushReminder: true,
      reminderDoneAt: at(addDays(today, -3), 11),
      version: 3,
      changes: [
        created(at(addDays(today, -10), 9, 50)),
        { action: "confirm", at: at(addDays(today, -9), 16, 33), by: CLINIC.providerId },
        { action: "complete", at: at(addDays(today, -2), 11, 40), by: CURRENT_USER_ID },
      ],
    },
    {
      id: "rdv-8",
      ownerId: CURRENT_USER_ID,
      ...pet("Nala"),
      ...personal,
      title: "Nettoyage des yeux",
      type: "soin",
      startsAt: at(addDays(today, -1), 16),
      endsAt: at(addDays(today, -1), 16, 30),
      status: "confirmed",
      reminderMinutes: 0,
      pushReminder: false,
      changes: [created(at(addDays(today, -5), 14, 25))],
    },
    {
      id: "rdv-9",
      ownerId: CURRENT_USER_ID,
      ...pet("Rocky"),
      ...CLINIC,
      serviceId: "srv-vaccin",
      title: "Vaccin antirabique",
      description: "Rappel annuel obligatoire",
      type: "vaccin",
      startsAt: at(addDays(today, 10), 17, 30),
      endsAt: at(addDays(today, 10), 18),
      status: "confirmed",
      price: 45,
      place: "autre",
      location: CLINIC.providerAddress,
      notes: "",
      reminderMinutes: 1440,
      pushReminder: true,
      version: 4,
      changes: [
        created(at(addDays(today, -8), 13, 16)),
        { action: "confirm", at: at(addDays(today, -8), 13, 16), by: CLINIC.providerId },
        {
          action: "reschedule",
          at: at(addDays(today, -3), 18, 51),
          by: CURRENT_USER_ID,
          reason: "Empêchement professionnel",
          oldStart: at(addDays(today, 8), 9),
          newStart: at(addDays(today, 10), 17, 30),
        },
        { action: "confirm", at: at(addDays(today, -2), 15, 34), by: CLINIC.providerId },
      ],
    },
  ];

  const reminders: Reminder[] = [
    {
      id: "rap-1",
      ownerId: CURRENT_USER_ID,
      petName: "Milo",
      petBreed: "Chat européen",
      title: "Vermifuge Milbemax",
      description: "Comprimé à donner pendant le repas du matin.",
      detail: "1 comprimé",
      category: "medicament",
      dueAt: at(today, 8),
      done: false,
    },
    {
      id: "rap-2",
      ownerId: CURRENT_USER_ID,
      petName: "Nala",
      petBreed: "Golden Retriever",
      title: "Nettoyage des oreilles",
      description: "Lotion auriculaire, oreille gauche surtout.",
      detail: "5 gouttes par oreille",
      category: "soin",
      dueAt: at(today, 20),
      done: false,
    },
    {
      id: "rap-3",
      ownerId: CURRENT_USER_ID,
      petName: "Rocky",
      petBreed: "Berger allemand",
      title: "Brossage des dents",
      category: "hygiene",
      dueAt: at(today, 7, 30),
      done: true,
      doneAt: at(today, 7, 45),
    },
    {
      id: "rap-4",
      ownerId: CURRENT_USER_ID,
      petName: "Rocky",
      petBreed: "Berger allemand",
      title: "Pipette antiparasitaire",
      description: "Entre les omoplates, ne pas baigner pendant 48 h.",
      detail: "Protection 1 mois",
      category: "traitement",
      dueAt: at(addDays(today, 2), 19),
      done: false,
    },
    {
      id: "rap-5",
      ownerId: CURRENT_USER_ID,
      petName: "Milo",
      petBreed: "Chat européen",
      title: "Pesée mensuelle",
      description: "Noter le poids dans le carnet de santé.",
      category: "controle",
      dueAt: at(addDays(today, 20), 10),
      done: false,
    },
  ];

  return { appointments, reminders };
}
