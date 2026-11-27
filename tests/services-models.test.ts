// npm test — module Services : validation, créneaux, fuseau horaire et transitions (src/lib/services-models.ts).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  availableSlots,
  canChangeBooking,
  EMPTY_WEEK,
  fitsAvailability,
  formatDuration,
  formatPrice,
  hoursSummary,
  openingStatus,
  validateAvailability,
  validateBooking,
  validateCategory,
  validateProvider,
  validateService,
  zonedDate,
  zonedParts,
  type DayAvailability,
} from "../src/lib/services-models";

const PROVIDER = {
  name: "Clinique du Lac",
  category: "Vétérinaires",
  city: "Tunis",
  description: "Consultations et urgences.",
  phone: "+216 71 000 000",
  email: "contact@clinique.tn",
  address: "12 rue du Lac",
  photo: "",
};

describe("validation d'un prestataire", () => {
  it("accepte un profil complet", () => {
    assert.deepEqual(Object.values(validateProvider(PROVIDER).errors).filter(Boolean), []);
  });
  it("téléphone obligatoire et valide", () => {
    assert.ok(validateProvider({ ...PROVIDER, phone: "" }).errors.phone);
    assert.ok(validateProvider({ ...PROVIDER, phone: "abc" }).errors.phone);
  });
  it("e-mail valide", () => {
    assert.ok(validateProvider({ ...PROVIDER, email: "pas-un-email" }).errors.email);
    assert.ok(validateProvider({ ...PROVIDER, email: "" }).errors.email);
  });
  it("nom, ville, catégorie, description", () => {
    assert.ok(validateProvider({ ...PROVIDER, name: "A" }).errors.name);
    assert.ok(validateProvider({ ...PROVIDER, city: "" }).errors.city);
    assert.ok(validateProvider({ ...PROVIDER, category: "" }).errors.category);
    assert.ok(validateProvider({ ...PROVIDER, description: "x".repeat(1001) }).errors.description);
    assert.ok(validateProvider({ ...PROVIDER, photo: "javascript:alert(1)" }).errors.photo);
  });
});

describe("validation d'une prestation", () => {
  const SERVICE = { name: "Consultation", category: "Vétérinaires", durationMinutes: 30, price: 45, description: "" };
  it("accepte une prestation valide, prix avec virgule", () => {
    assert.deepEqual(Object.values(validateService(SERVICE).errors).filter(Boolean), []);
    assert.equal(validateService({ ...SERVICE, price: "12,5" }).value.price, 12.5);
  });
  it("durée de 5 minutes à 24 heures (une nuit)", () => {
    assert.ok(validateService({ ...SERVICE, durationMinutes: 4 }).errors.durationMinutes);
    assert.ok(validateService({ ...SERVICE, durationMinutes: 1441 }).errors.durationMinutes);
    assert.ok(validateService({ ...SERVICE, durationMinutes: 30.5 }).errors.durationMinutes);
    assert.equal(validateService({ ...SERVICE, durationMinutes: 1440 }).errors.durationMinutes, undefined);
  });
  it("prix positif, 2 décimales maximum", () => {
    assert.ok(validateService({ ...SERVICE, price: -1 }).errors.price);
    assert.ok(validateService({ ...SERVICE, price: 12.345 }).errors.price);
    assert.ok(validateService({ ...SERVICE, price: "abc" }).errors.price);
    assert.equal(validateService({ ...SERVICE, price: 0 }).errors.price, undefined);
  });
  it("description : 500 caractères maximum", () => {
    assert.ok(validateService({ ...SERVICE, description: "x".repeat(501) }).errors.description);
  });
});

describe("validation d'une catégorie", () => {
  it("nom de 2 à 40 caractères, icône connue", () => {
    assert.deepEqual(validateCategory({ name: "Dresseurs", icon: "education" }).errors, {});
    assert.ok(validateCategory({ name: "D", icon: "education" }).errors.name);
    assert.ok(validateCategory({ name: "x".repeat(41), icon: "education" }).errors.name);
    assert.ok(validateCategory({ name: "Dresseurs", icon: "fusée" }).errors.icon);
  });
});

describe("validation des disponibilités (plages horaires)", () => {
  const day = (ranges: { start: string; end: string }[], enabled = true) => [{ weekday: 1, enabled, ranges }];
  it("complète la semaine (jours absents fermés)", () => {
    const { value, error } = validateAvailability(day([{ start: "09:00", end: "12:00" }]));
    assert.equal(error, undefined);
    assert.equal(value.length, 7);
    assert.equal(value[6].enabled, false);
  });
  it("format HH:MM, début avant fin", () => {
    assert.ok(validateAvailability(day([{ start: "9h", end: "12:00" }])).error);
    assert.ok(validateAvailability(day([{ start: "12:00", end: "09:00" }])).error);
    assert.ok(validateAvailability(day([{ start: "24:00", end: "25:00" }])).error);
  });
  it("6 plages maximum, sans chevauchement", () => {
    const seven = Array.from({ length: 7 }, (_, i) => ({ start: `0${i}:00`, end: `0${i}:30` }));
    assert.ok(validateAvailability(day(seven)).error);
    assert.ok(validateAvailability(day([{ start: "09:00", end: "12:00" }, { start: "11:00", end: "14:00" }])).error);
    assert.equal(validateAvailability(day([{ start: "14:00", end: "18:00" }, { start: "09:00", end: "12:00" }])).error, undefined);
  });
  it("jour ouvert sans plage refusé, jour en double refusé", () => {
    assert.ok(validateAvailability(day([])).error);
    assert.ok(validateAvailability([...day([{ start: "09:00", end: "10:00" }]), ...day([{ start: "11:00", end: "12:00" }])]).error);
    assert.ok(validateAvailability([{ weekday: 8, enabled: false, ranges: [] }]).error);
  });
});

describe("validation d'une réservation", () => {
  const NOW = new Date("2026-11-07T10:00:00Z");
  const BOOKING = { serviceId: "s1", dateTime: "2026-11-10T09:00:00.000Z", animalName: "Milo", notes: "" };
  it("accepte une demande à venir", () => {
    assert.deepEqual(validateBooking(BOOKING, NOW).errors, {});
  });
  it("date passée refusée", () => {
    assert.ok(validateBooking({ ...BOOKING, dateTime: "2026-11-01T09:00:00.000Z" }, NOW).errors.dateTime);
    assert.ok(validateBooking({ ...BOOKING, dateTime: "pas une date" }, NOW).errors.dateTime);
  });
  it("animal et prestation obligatoires, notes 500 caractères", () => {
    assert.ok(validateBooking({ ...BOOKING, animalName: "" }, NOW).errors.animalName);
    assert.ok(validateBooking({ ...BOOKING, serviceId: "" }, NOW).errors.serviceId);
    assert.ok(validateBooking({ ...BOOKING, notes: "x".repeat(501) }, NOW).errors.notes);
  });
});

describe("transitions d'une réservation", () => {
  it("seule une demande en attente change de statut", () => {
    assert.ok(canChangeBooking("pending", "confirmed", "provider"));
    assert.ok(canChangeBooking("pending", "declined", "provider"));
    assert.ok(canChangeBooking("pending", "cancelled", "client"));
    assert.ok(!canChangeBooking("confirmed", "cancelled", "client"));
    assert.ok(!canChangeBooking("declined", "confirmed", "provider"));
    assert.ok(!canChangeBooking("cancelled", "pending", "client"));
  });
  it("chacun son rôle : le client n'accepte pas, le prestataire n'annule pas", () => {
    assert.ok(!canChangeBooking("pending", "confirmed", "client"));
    assert.ok(!canChangeBooking("pending", "cancelled", "provider"));
  });
});

describe("créneaux et fuseau horaire (Tunis, UTC+1)", () => {
  const WEEK: DayAvailability[] = EMPTY_WEEK.map((d) =>
    d.weekday === 2 ? { weekday: 2, enabled: true, ranges: [{ start: "09:00", end: "11:00" }] } : d,
  );
  const TUESDAY = "2026-11-10";
  const NOW = new Date("2026-11-07T10:00:00Z");

  it("heure de Tunis ↔ instant UTC", () => {
    assert.equal(zonedDate(TUESDAY, 9 * 60).toISOString(), "2026-11-10T08:00:00.000Z");
    assert.deepEqual(zonedParts(new Date("2026-11-10T08:00:00Z")), { day: TUESDAY, weekday: 2, minutes: 540 });
  });

  it("créneaux toutes les 30 min, la prestation tient dans la plage", () => {
    const slots = availableSlots({ day: TUESDAY, week: WEEK, durationMinutes: 60, busy: [], now: NOW });
    assert.deepEqual(
      slots.map((s) => zonedParts(s).minutes),
      [540, 570, 600],
    );
  });

  it("jour fermé : aucun créneau ; créneaux passés exclus", () => {
    assert.equal(availableSlots({ day: "2026-11-09", week: WEEK, durationMinutes: 30, busy: [], now: NOW }).length, 0);
    const now = new Date("2026-11-10T08:45:00Z"); // 09:45 à Tunis
    assert.equal(availableSlots({ day: TUESDAY, week: WEEK, durationMinutes: 30, busy: [], now }).length, 2);
  });

  it("réservations existantes du prestataire exclues (pas de double réservation)", () => {
    const busy = [{ start: zonedDate(TUESDAY, 9 * 60 + 30), end: zonedDate(TUESDAY, 10 * 60) }];
    const slots = availableSlots({ day: TUESDAY, week: WEEK, durationMinutes: 60, busy, now: NOW });
    assert.deepEqual(slots.map((s) => zonedParts(s).minutes), [600]);
  });

  it("pension (à la nuit) : seule l'heure d'arrivée compte", () => {
    const start = zonedDate(TUESDAY, 10 * 60);
    assert.ok(fitsAvailability(start, 1440, WEEK));
    assert.ok(!fitsAvailability(start, 90, WEEK));
    assert.ok(fitsAvailability(zonedDate(TUESDAY, 9 * 60), 120, WEEK));
    assert.ok(!fitsAvailability(zonedDate(TUESDAY, 8 * 60), 30, WEEK));
  });
});

describe("affichage", () => {
  it("prix et durée", () => {
    assert.equal(formatPrice(45), "45 DT");
    assert.equal(formatPrice(12.5), "12,50 DT");
    assert.equal(formatPrice(0), "Gratuit");
    assert.equal(formatDuration(30), "30 min");
    assert.equal(formatDuration(90), "1 h 30");
    assert.equal(formatDuration(1440), "1 nuit");
  });
});

describe("horaires affichés (annuaire et fiche)", () => {
  const WEEK: DayAvailability[] = EMPTY_WEEK.map((d) =>
    d.weekday === 1 ? d : { weekday: d.weekday, enabled: true, ranges: [{ start: "09:00", end: "18:30" }] },
  );
  it("ouvert, fermé avant l'ouverture, fermé le lundi", () => {
    assert.deepEqual(openingStatus(WEEK, new Date("2026-11-10T09:00:00Z")), { open: true, label: "Ouvert • Ferme à 18:30" });
    assert.deepEqual(openingStatus(WEEK, new Date("2026-11-10T06:00:00Z")), { open: false, label: "Fermé • Ouvre à 09:00" });
    assert.equal(openingStatus(WEEK, new Date("2026-11-09T10:00:00Z")).label, "Fermé aujourd'hui");
  });
  it("résumé « Mar – Dim : 09:00 – 18:30 », fermé le lundi", () => {
    assert.deepEqual(hoursSummary(WEEK), { open: "Mar – Dim : 09:00 – 18:30", closed: "Fermé le lundi" });
    assert.equal(hoursSummary(EMPTY_WEEK).open, "Horaires non renseignés");
  });
});
