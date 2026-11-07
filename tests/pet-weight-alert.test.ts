// npm test — cas de l'alerte intelligente de poids (src/lib/pet-weight-alert.ts).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { alertKey, analyzeWeights, shouldNotify, type WeightSample } from "../src/lib/pet-weight-alert";
import { shiftDay, type PetSpecies, type PetStatus } from "../src/lib/pets-models";

const TODAY = "2026-11-07";

/** Pesées décrites par [jours avant aujourd'hui, poids]. */
function series(points: [number, number][]): WeightSample[] {
  return points.map(([daysAgo, weightKg], i) => ({ id: `w${i}`, day: shiftDay(TODAY, -daysAgo), weightKg }));
}

function analyze(
  points: [number, number][],
  { species = "dog", birthDate = "2020-01-01", status = "active", today = TODAY }: {
    species?: PetSpecies;
    birthDate?: string;
    status?: PetStatus;
    today?: string;
  } = {},
) {
  return analyzeWeights({ weights: series(points), species, birthDate, status, today });
}

describe("alerte de poids", () => {
  it("perte brutale : 5 % ou plus en 7 jours → rapid-loss", () => {
    const alert = analyze([[6, 20], [0, 18.8]]);
    assert.equal(alert?.rule, "rapid-loss");
    assert.equal(alert?.level, "consult");
    assert.equal(alert?.changePct, -6);
    assert.equal(alert?.referenceId, "w0");
  });

  it("perte lente : 10 % ou plus en 90 jours → loss-10", () => {
    const alert = analyze([[80, 10], [50, 9.6], [20, 9.2], [0, 8.9]]);
    assert.equal(alert?.rule, "loss-10");
    assert.equal(alert?.windowDays, 90);
  });

  it("perte modérée : 5 % ou plus en 30 jours → loss-5 (surveiller)", () => {
    const alert = analyze([[25, 10], [0, 9.4]]);
    assert.equal(alert?.rule, "loss-5");
    assert.equal(alert?.level, "watch");
  });

  it("petit animal : 3 % en 7 jours suffit pour un lapin, pas pour un chien", () => {
    assert.equal(analyze([[5, 2], [0, 1.93]], { species: "rabbit" })?.rule, "rapid-loss");
    assert.equal(analyze([[5, 2], [0, 1.93]], { species: "rodent" })?.rule, "rapid-loss");
    assert.equal(analyze([[5, 2], [0, 1.93]], { species: "bird" })?.rule, "rapid-loss");
    assert.equal(analyze([[5, 20], [0, 19.3]], { species: "dog" }), null);
  });

  it("croissance : pas d'alerte de prise avant 1 an", () => {
    const birthDate = shiftDay(TODAY, -200);
    assert.equal(analyze([[60, 5], [0, 7]], { birthDate }), null);
  });

  it("adulte : prise de 20 % → gain-20, de 10 % → gain-10", () => {
    assert.equal(analyze([[60, 10], [0, 12.2]])?.rule, "gain-20");
    const watch = analyze([[60, 10], [0, 11.1]]);
    assert.equal(watch?.rule, "gain-10");
    assert.equal(watch?.level, "watch");
  });

  it("date de naissance inconnue : l'animal est considéré adulte", () => {
    assert.equal(analyze([[60, 10], [0, 12.2]], { birthDate: "" })?.rule, "gain-20");
  });

  it("variation extrême : 30 % ou plus en 7 jours, perte ou prise, même chez un jeune", () => {
    assert.equal(analyze([[3, 10], [0, 6.5]])?.rule, "extreme");
    assert.equal(analyze([[5, 10], [0, 13.5]], { birthDate: shiftDay(TODAY, -100) })?.rule, "extreme");
  });

  it("retour à la normale : pas d'alerte quand l'animal reprend son poids habituel", () => {
    assert.equal(analyze([[80, 10], [40, 8.8], [0, 10]]), null);
  });

  it("une seule pesée : pas d'analyse", () => {
    assert.equal(analyze([[0, 10]]), null);
  });

  it("animal archivé : pas d'analyse", () => {
    assert.equal(analyze([[6, 20], [0, 15]], { status: "archived" }), null);
  });

  it("dernière pesée de plus de 30 jours : pas d'analyse", () => {
    assert.equal(analyze([[40, 20], [31, 15]]), null);
    assert.ok(analyze([[39, 20], [30, 15]]));
  });

  it("pesées de plus de 90 jours ignorées", () => {
    assert.equal(analyze([[120, 20], [0, 15]]), null);
  });

  it("poids stable : pas d'alerte", () => {
    assert.equal(analyze([[60, 10], [30, 10.1], [0, 9.9]]), null);
  });
});

describe("notification de l'alerte de poids", () => {
  const PET = "pet1";
  const rapid = analyze([[6, 20], [0, 18.8]])!;
  const slow = analyze([[25, 10], [0, 9.4]])!;
  const severe = analyze([[80, 10], [50, 9.6], [20, 9.2], [0, 8.9]])!;

  it("nouvel épisode : notification", () => {
    assert.equal(shouldNotify(PET, null, rapid, []), true);
  });

  it("pas de doublon : épisode déjà notifié", () => {
    assert.equal(shouldNotify(PET, null, rapid, [alertKey(PET, rapid)]), false);
    assert.equal(shouldNotify(PET, rapid, rapid, [alertKey(PET, rapid)]), false);
  });

  it("alerte en cours qui ne s'aggrave pas : pas de nouvelle notification", () => {
    assert.equal(shouldNotify(PET, rapid, slow, []), false);
  });

  it("alerte qui s'aggrave : nouvelle notification", () => {
    assert.equal(shouldNotify(PET, slow, severe, [alertKey(PET, slow)]), true);
  });

  it("plus d'alerte : rien à notifier", () => {
    assert.equal(shouldNotify(PET, rapid, null, []), false);
  });
});
