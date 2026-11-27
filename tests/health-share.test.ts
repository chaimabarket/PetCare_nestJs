// npm test — partage sécurisé du carnet (src/lib/health-share.ts).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { HealthRecord } from "../src/lib/health-records";
import { recordsForScope, shareStatus, SHARE_TOKEN_PATTERN, validateShareInput } from "../src/lib/health-share";

const TODAY = "2026-11-07";
let n = 0;
const rec = (fields: Partial<HealthRecord>): HealthRecord => ({
  id: `r${++n}`,
  petId: "p",
  petName: "Rocky",
  type: "visite",
  title: "Bilan",
  date: "2026-01-01",
  veterinarian: "Dr X",
  clinic: "",
  notes: "Note privée",
  lotNumber: "",
  nextDueDate: null,
  dosage: "",
  endDate: null,
  doseTimes: [],
  doseEveryDays: 1,
  attachments: [{ id: "a", name: "ordonnance.pdf", mimeType: "application/pdf", size: 10 }],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...fields,
});

describe("validation d'un lien", () => {
  it("accepte une portée et une durée proposées", () => {
    assert.equal(validateShareInput({ scope: "urgence", durationHours: 24, label: " Pet-sitter " }).error, undefined);
    assert.equal(validateShareInput({ scope: "urgence", durationHours: 24, label: " Pet-sitter " }).value.label, "Pet-sitter");
  });
  it("refuse une portée inconnue, une durée libre, un nom trop long", () => {
    assert.ok(validateShareInput({ scope: "tout", durationHours: 24 }).error);
    assert.ok(validateShareInput({ scope: "complet", durationHours: 99999 }).error);
    assert.ok(validateShareInput({ scope: "complet", durationHours: 24, label: "x".repeat(61) }).error);
  });
});

describe("statut d'un lien", () => {
  const now = new Date("2026-11-07T12:00:00Z");
  it("actif, expiré, révoqué", () => {
    assert.equal(shareStatus({ expiresAt: "2026-11-08T12:00:00Z", revokedAt: null }, now), "active");
    assert.equal(shareStatus({ expiresAt: "2026-11-07T12:00:00Z", revokedAt: null }, now), "expired");
    assert.equal(shareStatus({ expiresAt: "2026-11-08T12:00:00Z", revokedAt: "2026-11-07T10:00:00Z" }, now), "revoked");
  });
  it("format du jeton", () => {
    assert.ok(SHARE_TOKEN_PATTERN.test("a".repeat(43)));
    assert.ok(!SHARE_TOKEN_PATTERN.test("a".repeat(42)));
    assert.ok(!SHARE_TOKEN_PATTERN.test(`${"a".repeat(42)}/`));
  });
});

describe("données selon la portée", () => {
  const records = [
    rec({ type: "visite", title: "Bilan annuel", date: "2026-09-01" }),
    rec({ type: "allergie", title: "Poulet", date: "2025-01-01" }),
    rec({ type: "vaccin", title: "Rage", date: "2025-01-10", nextDueDate: "2026-01-10" }),
    rec({ type: "vaccin", title: "rage", date: "2026-01-12", nextDueDate: "2027-01-12", notes: "Lot à surveiller" }),
    rec({ type: "traitement", title: "Apoquel", date: "2026-11-01", endDate: "2026-11-20" }),
    rec({ type: "traitement", title: "Otite", date: "2026-09-01", endDate: "2026-09-10" }),
  ];

  it("carnet complet : tout, du plus récent au plus ancien, sans pièces jointes", () => {
    const shared = recordsForScope(records, "complet", TODAY);
    assert.equal(shared.length, records.length);
    assert.equal(shared[0].title, "Apoquel");
    assert.ok(shared.every((r) => !("attachments" in r) && !("petId" in r)));
  });

  it("fiche d'urgence : allergies, traitements en cours, dernière injection de chaque vaccin", () => {
    const shared = recordsForScope(records, "urgence", TODAY);
    assert.deepEqual(shared.map((r) => r.title).sort(), ["Apoquel", "Poulet", "rage"]);
    assert.equal(shared.find((r) => r.type === "vaccin")?.notes, "");
  });
});
