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
import { parseAnswer } from "../src/lib/assistant/parser";
import {
  bookingStart,
  buildServiceContext,
  isServiceQuestion,
  slotProblem,
  withServiceDetails,
  type CatalogService,
} from "../src/lib/assistant/service-catalog";
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

describe("parseAnswer : action écrite en texte au lieu d'un appel de fonction", () => {
  const ids = new Set<string>();
  const RAW =
    "Pour le rendez-vous chez le vétérinaire lundi (16/11/2026), à quelle heure souhaitez-vous le fixer ?\n" +
    "Vérifiez et confirmez la carte ci-dessous :\n\n[[creer_rendez-vous:Rocky|Toilettage|toilettage|2026-11-16|15:00]]";

  it("le tag n'est pas affiché et devient le même appel que la fonction", () => {
    const parsed = parseAnswer(RAW, ids, { now: NOW });
    assert.doesNotMatch(parsed.text, /\[\[|\]\]/);
    assert.deepEqual(parsed.textCalls, [
      { name: "creer_rendez_vous", args: { animal: "Rocky", titre: "Toilettage", type: "toilettage", date: "2026-11-16", heure: "15:00" } },
    ]);
    const a = call(parsed.textCalls[0].name, parsed.textCalls[0].args);
    const pets: AssistantPet[] = [{ id: "r", name: "Rocky", species: "dog" }];
    assert.ok(isActionReady(checkAction(a, pets, NOW)));
  });

  it("valeurs « clé=valeur », tag inconnu retiré, rappels et annonces inchangés", () => {
    const parsed = parseAnswer(
      "Ok [[ajouter_pesee:poids_kg=12.5|animal=Rex]] [[supprimer:Rex]] [[rappel:Vermifuger Rex|2026-12-01]] [[annonce:a1]]",
      new Set(["a1"]),
      { allowReminders: true, now: NOW },
    );
    assert.equal(parsed.text, "Ok");
    assert.deepEqual(parsed.textCalls, [{ name: "ajouter_pesee", args: { poids_kg: "12.5", animal: "Rex" } }]);
    assert.equal(parsed.reminders.length, 1);
    assert.deepEqual(parsed.listingIds, ["a1"]);
    assert.ok(isActionReady(checkAction(call("ajouter_pesee", parsed.textCalls[0].args), PETS, NOW)));
  });
});

describe("reserver_service : réservation chez un prestataire", () => {
  const WEEK = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
    weekday,
    enabled: weekday === 1,
    ranges: weekday === 1 ? [{ start: "09:00", end: "12:00" }] : [],
  }));
  const CATALOG: CatalogService[] = [
    {
      id: "s1",
      name: "Consultation générale",
      durationMinutes: 30,
      price: 45,
      providerId: "p1",
      providerName: "Clinique des Oliviers",
      category: "Vétérinaires",
      city: "Tunis",
      address: "12 rue de Marseille",
      availability: WEEK,
    },
  ];
  const PETS_R: AssistantPet[] = [{ id: "r", name: "Rocky", species: "dog" }];
  const booking = (args: object) => withServiceDetails(call("reserver_service", args), CATALOG);

  it("le modèle ne peut pas fixer le prix ni le prestataire ; la carte reprend la prestation du catalogue", () => {
    const a = booking({ animal: "Rocky", service_id: "s1", date: "2026-11-16", heure: "10:00", prix: 1, prestataire: "Faux" });
    assert.equal(a.args.prix, 45);
    assert.ok(isActionReady(checkAction(a, PETS_R, NOW)));
    assert.deepEqual(describeAction(a), [
      ["Prestataire", "Clinique des Oliviers"],
      ["Prestation", "Consultation générale"],
      ["Animal", "Rocky"],
      ["Date", "16/11/2026"],
      ["Heure", "10:00"],
      ["Durée", "30 min"],
      ["Prix", "45 DT"],
      ["Adresse", "12 rue de Marseille, Tunis"],
    ]);
  });

  it("prestation inconnue ou heure manquante : une question, pas de carte", () => {
    const unknown = checkAction(booking({ animal: "Rocky", service_id: "zz", date: "2026-11-16", heure: "10:00" }), PETS_R, NOW);
    assert.match(unknown.error ?? "", /Je ne trouve pas cette prestation/);
    const noTime = checkAction(booking({ animal: "Rocky", service_id: "s1", date: "2026-11-16" }), PETS_R, NOW);
    assert.deepEqual(noTime.missing, ["heure"]);
  });

  it("créneau : heure de Tunis, créneaux libres proposés sinon", () => {
    const a = booking({ animal: "Rocky", service_id: "s1", date: "2026-11-16", heure: "10:00" });
    // 10:00 à Tunis (UTC+1) = 09:00 UTC.
    assert.equal(bookingStart(a)?.toISOString(), "2026-11-16T09:00:00.000Z");
    assert.equal(slotProblem(a, ["2026-11-16T08:00:00.000Z", "2026-11-16T09:00:00.000Z"]), undefined);
    assert.match(slotProblem(a, ["2026-11-16T08:00:00.000Z", "2026-11-16T08:30:00.000Z"]) ?? "", /Créneaux libres ce jour-là : 09:00, 09:30/);
    assert.match(slotProblem(a, []) ?? "", /plus de créneau libre le 16\/11/);
    // Mardi 17/11 : fermé (seul le lundi est ouvert).
    const tuesday = booking({ animal: "Rocky", service_id: "s1", date: "2026-11-17", heure: "10:00" });
    assert.equal(
      slotProblem(tuesday, [], WEEK),
      "Clinique des Oliviers est fermé le mardi (ouvert : lundi). Quel autre jour vous convient ?",
    );
  });

  it("bloc PRESTATIONS et détection des questions de service", () => {
    assert.equal(
      buildServiceContext(CATALOG),
      "PRESTATIONS (services PetCare réservables, heures de Tunis) :\n" +
        "- id=s1 | Consultation générale | Clinique des Oliviers (Vétérinaires, Tunis) | 30 min | 45 DT | horaires : lun 09:00-12:00 ; fermé mar, mer, jeu, ven, sam, dim",
    );
    assert.ok(isServiceQuestion("Je veux réserver un toilettage pour Rocky"));
    assert.ok(isServiceQuestion("book a vet monday"));
    assert.ok(!isServiceQuestion("Combien de croquettes pour Rocky ?"));
  });

  it("tag écrit en texte : champs du modèle seulement, dans l'ordre", () => {
    const parsed = parseAnswer("[[reserver_service:Rocky|s1|2026-11-16|10:00]]", new Set(), { now: NOW });
    assert.deepEqual(parsed.textCalls, [
      { name: "reserver_service", args: { animal: "Rocky", service_id: "s1", date: "2026-11-16", heure: "10:00" } },
    ]);
  });
});
