// npm test — analyse du texte d'une ordonnance ou d'une vignette scannée (src/lib/scan-parse.ts).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findDates, parseScannedText } from "../src/lib/scan-parse";

const TODAY = "2026-11-07";

describe("dates", () => {
  it("JJ/MM/AAAA, JJ.MM.AA, JJ-MM-AAAA", () => {
    assert.deepEqual(findDates("Le 03/11/2026"), ["2026-11-03"]);
    assert.deepEqual(findDates("fait le 3.11.26"), ["2026-11-03"]);
    assert.deepEqual(findDates("12-01-2025 et 31/02/2025"), ["2025-01-12"]); // 31 février ignoré
  });
});

describe("vignette vaccinale", () => {
  const label = [
    "NOBIVAC DHPPi",
    "Lot : A123B45",
    "EXP 05/2027 · Exp. 30/05/2027",
    "Clinique des Jasmins - Dr Sami Trabelsi",
    "Vacciné le 02/11/2026",
  ].join("\n");

  it("nom du vaccin, lot, date, vétérinaire", () => {
    assert.deepEqual(parseScannedText(label, "vaccin", TODAY), {
      title: "NOBIVAC DHPPi",
      lotNumber: "A123B45",
      date: "2026-11-02",
      veterinarian: "Dr Sami Trabelsi",
    });
  });

  it("ignore les dates de péremption et les dates futures", () => {
    const r = parseScannedText("Rabisin\nN° de lot 77812\nExp 30/05/2027\n15/12/2026", "vaccin", TODAY);
    assert.equal(r.date, undefined);
    assert.equal(r.lotNumber, "77812");
    assert.equal(r.title, "Rabisin");
  });

  it("ne renvoie rien d'inventé", () => {
    assert.deepEqual(parseScannedText("illisible ###", "vaccin", TODAY), {});
  });
});

describe("ordonnance", () => {
  const prescription = [
    "Cabinet Vétérinaire du Lac",
    "Docteur Ines Hammami",
    "Ordonnance du 04/11/2026",
    "Animal : Mimi",
    "1) Clavaseptin 50 mg comprimés",
    "1 comprimé matin et soir pendant 7 jours",
  ].join("\n");

  it("nom du médicament sans la posologie", () => {
    const r = parseScannedText(prescription, "traitement", TODAY);
    assert.equal(r.title, "Clavaseptin");
    assert.equal(r.date, "2026-11-04");
    assert.equal(r.veterinarian, "Dr Ines Hammami");
    assert.equal(r.lotNumber, undefined);
    assert.ok(!Object.values(r).some((v) => /matin|soir|comprimé/i.test(v ?? "")), "aucune posologie recopiée");
  });
});
