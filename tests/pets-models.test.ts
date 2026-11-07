// npm test — validation des champs et affichage (src/lib/pets-models.ts).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ageLabel,
  daysAgoLabel,
  maskChip,
  shareText,
  validateContacts,
  validatePetInput,
  validateWeight,
} from "../src/lib/pets-models";

const TODAY = "2026-11-07";
const VALID = { name: "Milo", species: "cat", sex: "male", breed: "Européen", birthDate: "2022-05-12" };

describe("validation d'un animal", () => {
  it("accepte un animal complet", () => {
    const { value, errors } = validatePetInput({ ...VALID, chipNumber: "250 269 608 123 456" }, { today: TODAY });
    assert.deepEqual(errors, {});
    assert.equal(value.chipNumber, "250269608123456");
  });

  it("nom : 2 à 80 caractères", () => {
    assert.ok(validatePetInput({ ...VALID, name: "M" }, { today: TODAY }).errors.name);
    assert.ok(validatePetInput({ ...VALID, name: "x".repeat(81) }, { today: TODAY }).errors.name);
  });

  it("espèce et sexe : valeurs connues uniquement", () => {
    assert.ok(validatePetInput({ ...VALID, species: "dragon" }, { today: TODAY }).errors.species);
    assert.ok(validatePetInput({ ...VALID, sex: "x" }, { today: TODAY }).errors.sex);
    assert.ok(validatePetInput({ ...VALID, sex: "" }, { today: TODAY }).errors.sex);
  });

  it("espèce « autre » : l'animal doit être précisé", () => {
    assert.ok(validatePetInput({ ...VALID, species: "other", breed: "" }, { today: TODAY }).errors.breed);
    assert.deepEqual(validatePetInput({ ...VALID, species: "other", breed: "Ours" }, { today: TODAY }).errors, {});
  });

  it("race : 80 caractères maximum", () => {
    assert.ok(validatePetInput({ ...VALID, breed: "x".repeat(81) }, { today: TODAY }).errors.breed);
  });

  it("date de naissance : jamais dans le futur", () => {
    assert.ok(validatePetInput({ ...VALID, birthDate: "2026-11-08" }, { today: TODAY }).errors.birthDate);
    assert.ok(validatePetInput({ ...VALID, birthDate: "2026-02-30" }, { today: TODAY }).errors.birthDate);
  });

  it("puce : 15 chiffres", () => {
    assert.ok(validatePetInput({ ...VALID, chipNumber: "12345" }, { today: TODAY }).errors.chipNumber);
    assert.ok(validatePetInput({ ...VALID, chipNumber: "25026960812345A" }, { today: TODAY }).errors.chipNumber);
  });

  it("notes : 500 caractères maximum", () => {
    assert.ok(validatePetInput({ ...VALID, notes: "x".repeat(501) }, { today: TODAY }).errors.notes);
  });

  it("brouillon : seul le nom est exigé", () => {
    const { errors } = validatePetInput({ name: "Rex", species: "other" }, { today: TODAY, draft: true });
    assert.deepEqual(errors, {});
    assert.ok(validatePetInput({ name: "R" }, { today: TODAY, draft: true }).errors.name);
  });
});

describe("validation des contacts", () => {
  const contact = { name: "Dr Martin", detail: "Vétérinaire", phone: "+216 71 000 000", emergency: true };
  it("5 contacts maximum", () => {
    assert.equal(validateContacts(Array(5).fill(contact)).error, undefined);
    assert.ok(validateContacts(Array(6).fill(contact)).error);
  });
  it("nom et téléphone obligatoires", () => {
    assert.ok(validateContacts([{ ...contact, name: "" }]).error);
    assert.ok(validateContacts([{ ...contact, phone: "abc" }]).error);
  });
});

describe("validation d'une pesée", () => {
  it("poids entre 0 et 500 kg", () => {
    assert.ok(validateWeight({ day: TODAY, weightKg: 0 }, { today: TODAY }).errors.weightKg);
    assert.ok(validateWeight({ day: TODAY, weightKg: 501 }, { today: TODAY }).errors.weightKg);
    assert.deepEqual(validateWeight({ day: TODAY, weightKg: "4,2" }, { today: TODAY }).errors, {});
  });
  it("jamais dans le futur, jamais avant la naissance", () => {
    assert.ok(validateWeight({ day: "2026-11-08", weightKg: 4 }, { today: TODAY }).errors.day);
    assert.ok(validateWeight({ day: "2020-01-01", weightKg: 4 }, { today: TODAY, birthDate: "2021-01-01" }).errors.day);
  });
});

describe("affichage", () => {
  it("âge", () => {
    assert.equal(ageLabel("2022-01-07", TODAY), "4 ans et 10 mois");
    assert.equal(ageLabel("2024-11-07", TODAY), "2 ans");
    assert.equal(ageLabel("2026-03-01", TODAY), "8 mois");
    assert.equal(ageLabel("2026-10-17", TODAY), "3 semaines");
    assert.equal(ageLabel("2026-11-05", TODAY), "2 jours");
    assert.equal(ageLabel("", TODAY), "");
  });
  it("dernière pesée", () => {
    assert.equal(daysAgoLabel("2026-10-26", TODAY), "il y a 12 j");
    assert.equal(daysAgoLabel(TODAY, TODAY), "aujourd'hui");
  });
  it("puce tronquée", () => {
    assert.equal(maskChip("250269608123456"), "250 269 ••• ••• 456");
  });
  it("partage limité : ni puce ni notes", () => {
    const text = shareText({ name: "Milo", species: "cat", breed: "Européen", sex: "male", birthDate: "2022-05-12" }, TODAY);
    assert.equal(text, "🐱 Milo · Chat · Européen · Mâle · 4 ans et 5 mois");
  });
});
