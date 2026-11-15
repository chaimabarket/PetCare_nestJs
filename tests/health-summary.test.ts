// npm test — règles de l'onglet Santé (src/lib/health-summary.ts) et validation des prises (src/lib/health-records.ts).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateHealthRecord } from "../src/lib/health-records";
import {
  compareUrgency,
  doseScheduleLabel,
  doseTimesForDay,
  dueVaccines,
  isActiveTreatment,
  latestVaccines,
  vaccineStatus,
} from "../src/lib/health-summary";

const TODAY = "2026-11-07";
let n = 0;
const rec = (fields: Record<string, unknown>) => ({
  id: `r${++n}`,
  type: "vaccin" as const,
  title: "Rage",
  date: "2025-11-01",
  createdAt: "2025-11-01T10:00:00.000Z",
  nextDueDate: null as string | null,
  endDate: null as string | null,
  doseTimes: [] as string[],
  doseEveryDays: 1,
  ...fields,
});

describe("statut vaccinal", () => {
  it("aucun vaccin", () => {
    assert.equal(vaccineStatus([rec({ type: "visite" })], TODAY).status, "none");
  });

  it("en retard si l'échéance est passée", () => {
    const r = vaccineStatus([rec({ nextDueDate: "2026-11-01" })], TODAY);
    assert.equal(r.status, "overdue");
    assert.equal(r.next?.daysLeft, -6);
  });

  it("bientôt dans les 30 jours, à jour au-delà", () => {
    assert.equal(vaccineStatus([rec({ nextDueDate: "2026-12-07" })], TODAY).status, "soon");
    assert.equal(vaccineStatus([rec({ nextDueDate: TODAY })], TODAY).status, "soon");
    assert.equal(vaccineStatus([rec({ nextDueDate: "2026-12-08" })], TODAY).status, "ok");
  });

  it("à jour si le vaccin n'a pas de rappel", () => {
    assert.equal(vaccineStatus([rec({})], TODAY).status, "ok");
  });

  it("une injection refaite remplace l'ancienne (titre sans tenir compte de la casse)", () => {
    const old = rec({ title: "Rage", date: "2025-01-10", nextDueDate: "2026-01-10" });
    const redone = rec({ title: " rage ", date: "2026-01-12", nextDueDate: "2027-01-12" });
    assert.deepEqual(latestVaccines([old, redone]).map((r) => r.id), [redone.id]);
    assert.equal(vaccineStatus([old, redone], TODAY).status, "ok");
  });

  it("le vaccin le plus urgent l'emporte", () => {
    const records = [rec({ title: "CHPPiL", nextDueDate: "2027-03-01" }), rec({ title: "Leucose", nextDueDate: "2026-10-30" })];
    assert.equal(vaccineStatus(records, TODAY).next?.title, "Leucose");
    assert.deepEqual(dueVaccines(records, TODAY).map((v) => v.title), ["Leucose", "CHPPiL"]);
  });
});

describe("prises de traitement", () => {
  const treatment = (fields: Record<string, unknown>) =>
    rec({ type: "traitement", title: "Antibiotique", date: "2026-11-01", doseTimes: ["20:00", "08:00"], ...fields });

  it("traitement en cours : commencé, pas fini (fin incluse)", () => {
    assert.ok(isActiveTreatment(treatment({}), TODAY));
    assert.ok(isActiveTreatment(treatment({ endDate: TODAY }), TODAY));
    assert.ok(!isActiveTreatment(treatment({ endDate: "2026-11-06" }), TODAY));
    assert.ok(!isActiveTreatment(treatment({ date: "2026-11-08" }), TODAY));
  });

  it("prises du jour triées par heure", () => {
    assert.deepEqual(doseTimesForDay(treatment({}), TODAY), ["08:00", "20:00"]);
  });

  it("rythme tous les N jours à partir du début", () => {
    const weekly = treatment({ doseTimes: ["09:00"], doseEveryDays: 7, date: "2026-10-31" });
    assert.deepEqual(doseTimesForDay(weekly, TODAY), ["09:00"]);
    assert.deepEqual(doseTimesForDay(weekly, "2026-11-08"), []);
    const everyThree = treatment({ doseTimes: ["09:00"], doseEveryDays: 3, date: "2026-11-01" });
    assert.deepEqual(doseTimesForDay(everyThree, TODAY), ["09:00"]); // J+6
    assert.deepEqual(doseTimesForDay(everyThree, "2026-11-08"), []);
  });

  it("aucune prise sans horaires ou pour un autre type", () => {
    assert.deepEqual(doseTimesForDay(treatment({ doseTimes: [] }), TODAY), []);
    assert.deepEqual(doseTimesForDay(rec({ doseTimes: ["08:00"] }), TODAY), []);
  });

  it("libellé du rythme", () => {
    assert.equal(doseScheduleLabel({ doseTimes: ["08:00", "20:00"], doseEveryDays: 1 }), "08:00 · 20:00, tous les jours");
    assert.equal(doseScheduleLabel({ doseTimes: ["09:00"], doseEveryDays: 7 }), "09:00, une fois par semaine");
  });
});

describe("validation des prises", () => {
  const base = { petId: "p", type: "traitement", title: "Antibiotique", date: "2026-11-01", doseTimes: ["20:00", "08:00", "08:00"] };

  it("trie et dédoublonne les heures, rythme par défaut quotidien", () => {
    const { value, errors } = validateHealthRecord(base, { today: TODAY });
    assert.deepEqual(errors, {});
    assert.deepEqual(value.doseTimes, ["08:00", "20:00"]);
    assert.equal(value.doseEveryDays, 1);
  });

  it("refuse une heure invalide, plus de 6 prises, un rythme hors 1–30", () => {
    assert.ok(validateHealthRecord({ ...base, doseTimes: ["25:00"] }, { today: TODAY }).errors.doseTimes);
    const seven = ["01:00", "02:00", "03:00", "04:00", "05:00", "06:00", "07:00"];
    assert.ok(validateHealthRecord({ ...base, doseTimes: seven }, { today: TODAY }).errors.doseTimes);
    assert.ok(validateHealthRecord({ ...base, doseEveryDays: 0 }, { today: TODAY }).errors.doseEveryDays);
    assert.ok(validateHealthRecord({ ...base, doseEveryDays: 31 }, { today: TODAY }).errors.doseEveryDays);
    assert.ok(validateHealthRecord({ ...base, doseEveryDays: 1.5 }, { today: TODAY }).errors.doseEveryDays);
  });

  it("ignore les prises pour un autre type d'acte", () => {
    const { value } = validateHealthRecord({ ...base, type: "vaccin", veterinarian: "Dr X" }, { today: TODAY });
    assert.deepEqual(value.doseTimes, []);
  });
});

describe("tri des animaux", () => {
  it("retard, puis prises restantes, puis bientôt, puis nom", () => {
    const pets = [
      { name: "Zoé", status: "ok" as const, dosesLeft: 0 },
      { name: "Bella", status: "soon" as const, dosesLeft: 0 },
      { name: "Milo", status: "ok" as const, dosesLeft: 2 },
      { name: "Rex", status: "overdue" as const, dosesLeft: 0 },
      { name: "Alfred", status: "none" as const, dosesLeft: 0 },
    ];
    assert.deepEqual([...pets].sort(compareUrgency).map((p) => p.name), ["Rex", "Milo", "Bella", "Alfred", "Zoé"]);
  });
});
