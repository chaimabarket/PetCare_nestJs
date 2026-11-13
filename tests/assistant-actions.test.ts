// npm test — actions de l'assistant IA et contexte envoyé au modèle (src/lib/assistant/actions.ts, context.ts).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { HealthRecord } from "../src/lib/health-records";
import {
  actionFromCall,
  actionFromJson,
  actionHistoryText,
  actionProblem,
  actionStartsAt,
  checkAction,
  describeAction,
  isActionReady,
  type AssistantAction,
} from "../src/lib/assistant/actions";
import { buildDateContext, buildHealthSummary, buildPetsListContext } from "../src/lib/assistant/context";
import type { AssistantPet } from "../src/lib/assistant/pets-model";

const NOW = new Date(2026, 10, 12, 14, 5);
const PETS: AssistantPet[] = [
  { id: "p1", name: "Nala", species: "rabbit" },
  { id: "p2", name: "Rex", species: "dog" },
];
const call = (name: string, args: object) => actionFromCall(name, args)!;

describe("actionFromCall", () => {
  it("ignore une fonction inconnue et les champs inconnus ou vides", () => {
    assert.equal(actionFromCall("supprimer_animal", { animal: "Rex" }), null);
    const a = call("ajouter_pesee", { animal: " Rex ", poids_kg: 12.5, couleur: "brun", date: "" });
    assert.deepEqual(a.args, { animal: "Rex", poids_kg: 12.5 });
    assert.equal(a.status, "pending");
  });

  it("se relit depuis l'historique avec son état", () => {
    const a: AssistantAction = { ...call("creer_rappel", { animal: "Rex", titre: "Vermifuger Rex", date: "2026-12-01" }), status: "done" };
    assert.deepEqual(actionFromJson(JSON.parse(JSON.stringify(a))), a);
    assert.equal(actionFromJson({ type: "inconnue", args: {} }), null);
  });
});

describe("checkAction", () => {
  it("rendez-vous sans heure : demande l'heure au lieu de l'inventer", () => {
    const a = call("creer_rendez_vous", { animal: "Rex", titre: "Vaccin rage", type: "vaccin", date: "2026-11-13" });
    const check = checkAction(a, PETS, NOW);
    assert.equal(isActionReady(check), false);
    assert.deepEqual(check.missing, ["heure"]);
    assert.equal(actionProblem(a, check), "Pour créer ce rendez-vous, il me manque : heure. Pouvez-vous me les donner ?");
  });

  it("liste toutes les informations manquantes en une fois", () => {
    assert.deepEqual(checkAction(call("creer_rendez_vous", { animal: "Rex" }), PETS, NOW).missing, ["intitulé", "type", "date", "heure"]);
  });

  it("visite, vaccin ou examen : le nom du vétérinaire est obligatoire (comme le formulaire)", () => {
    const a = call("ajouter_soin", { animal: "Rex", type: "vaccin", titre: "Rage", date: "2026-11-10" });
    assert.deepEqual(checkAction(a, PETS, NOW).missing, ["nom du vétérinaire"]);
    const allergy = call("ajouter_soin", { animal: "Nala", type: "allergie", titre: "Pollen", date: "2026-11-12" });
    assert.equal(isActionReady(checkAction(allergy, PETS, NOW)), true);
  });

  it("rendez-vous complet dans le futur : valide, animal trouvé sans tenir compte des majuscules", () => {
    const a = call("creer_rendez_vous", { animal: "rex", titre: "Vaccin rage", type: "vaccin", date: "2026-11-13", heure: "10:30" });
    const check = checkAction(a, PETS, NOW);
    assert.equal(isActionReady(check), true);
    assert.equal(check.pet?.id, "p2");
    assert.deepEqual(actionStartsAt(a), new Date(2026, 10, 13, 10, 30));
  });

  it("animal inconnu : propose la liste des animaux", () => {
    assert.match(checkAction(call("ajouter_pesee", { animal: "Milo", poids_kg: 4 }), PETS, NOW).error!, /Nala, Rex/);
  });

  it("refuse les dates incohérentes et les valeurs invalides", () => {
    const future = call("ajouter_soin", { animal: "Nala", type: "note", titre: "Contrôle", date: "2026-11-20" });
    assert.match(checkAction(future, PETS, NOW).error!, /rendez-vous/);
    const past = call("creer_rendez_vous", { animal: "Rex", titre: "Toilettage", type: "toilettage", date: "2026-11-12", heure: "09:00" });
    assert.match(checkAction(past, PETS, NOW).error!, /futur/);
    const badDate = call("creer_rappel", { animal: "Rex", titre: "Vermifuger Rex", date: "2026-02-31" });
    assert.match(checkAction(badDate, PETS, NOW).error!, /pas valide/);
    const treatment = call("ajouter_traitement", { animal: "Rex", nom: "Milbemax", posologie: "1 comprimé", debut: "2026-11-10", fin: "2026-11-01" });
    assert.match(checkAction(treatment, PETS, NOW).error!, /après son début/);
    assert.match(checkAction(call("ajouter_pesee", { animal: "Rex", poids_kg: "0" }), PETS, NOW).error!, /500 kg/);
  });
});

describe("affichage et historique", () => {
  it("carte de confirmation lisible", () => {
    const a = call("creer_rendez_vous", {
      animal: "Rex",
      titre: "Vaccin rage",
      type: "veterinaire",
      date: "2026-11-13",
      heure: "10:30",
      duree_minutes: 45,
    });
    assert.deepEqual(describeAction(a), [
      ["Animal", "Rex"],
      ["Intitulé", "Vaccin rage"],
      ["Type", "Vétérinaire"],
      ["Date", "13/11/2026"],
      ["Heure", "10:30"],
      ["Durée", "45 min"],
    ]);
  });

  it("l'historique indique au modèle si l'action a été confirmée", () => {
    const a = call("ajouter_soin", { animal: "Nala", type: "allergie", titre: "Pollen", date: "2026-11-12" });
    assert.match(actionHistoryText(a), /pas encore confirmée/);
    assert.match(actionHistoryText({ ...a, status: "done" }), /confirmée et enregistrée/);
  });

  it("contexte : date avec le jour de la semaine, liste des animaux", () => {
    assert.equal(buildDateContext(NOW), "DATE DU JOUR : 2026-11-12 (jeudi), HEURE : 14:05");
    assert.equal(buildPetsListContext(PETS), "ANIMAUX DE L'UTILISATEUR : Nala (lapin), Rex (chien)");
  });

  it("résumé du carnet : allergies, dernier vaccin par nom, traitements en cours, dernière visite", () => {
    const record = (r: Partial<HealthRecord>) => ({ nextDueDate: null, dosage: "", endDate: null, ...r }) as HealthRecord;
    const lines = buildHealthSummary(
      [
        record({ type: "allergie", title: "Poulet", date: "2025-01-01" }),
        record({ type: "vaccin", title: "Rage", date: "2025-03-01", nextDueDate: "2026-03-01" }),
        record({ type: "vaccin", title: "Rage", date: "2026-03-02", nextDueDate: "2027-03-02" }),
        record({ type: "vaccin", title: "CHPPi", date: "2025-06-01", nextDueDate: "2026-06-01" }),
        record({ type: "traitement", title: "Milbemax", date: "2026-11-01", dosage: "1 comprimé", endDate: "2026-11-15" }),
        record({ type: "traitement", title: "Fini", date: "2026-01-01", endDate: "2026-01-10" }),
        record({ type: "visite", title: "Bilan annuel", date: "2026-09-10" }),
      ],
      NOW,
    );
    assert.deepEqual(lines, [
      "Allergie : Poulet",
      "Vaccin Rage : fait le 02/03/2026, prochain rappel le 02/03/2027",
      "Vaccin CHPPi : fait le 01/06/2025, rappel en retard depuis le 01/06/2026",
      "Traitement en cours : Milbemax (1 comprimé) jusqu'au 15/11/2026",
      "Dernière visite : Bilan annuel le 10/09/2026",
    ]);
  });
});
