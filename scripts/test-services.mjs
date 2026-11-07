// Teste les routes /api/services (catégories, profils et validation, prestations, disponibilités, créneaux,
// réservations et agenda) sur le serveur lancé. Crée des comptes Firebase temporaires, puis supprime tout.
// Lancement : npm run dev   (dans un autre terminal)   puis   npm run test:services
import { deleteApp, initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, deleteUser, getAuth } from "firebase/auth";
import { MongoClient } from "mongodb";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let passed = 0;
let failed = 0;

async function call(who, method, path, body) {
  const headers = {};
  if (who) headers.Authorization = `Bearer ${await who.user.getIdToken()}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(BASE_URL + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : undefined };
}

async function expectStatus(label, expected, request) {
  try {
    const { status, data } = await request();
    if (status === expected) {
      console.log(`  ✅ ${label}${status >= 400 ? ` (refusé : ${status})` : ""}`);
      passed++;
    } else {
      console.log(`  ❌ ${label} — statut ${status} au lieu de ${expected}${data?.error ? ` : ${data.error}` : ""}`);
      failed++;
    }
    return data;
  } catch (error) {
    console.log(`  ❌ ${label} — ${error.message}`);
    failed++;
  }
}

function check(label, condition) {
  console.log(`  ${condition ? "✅" : "❌"} ${label}`);
  if (condition) passed++;
  else failed++;
}

async function createTestUser(name, role) {
  const app = initializeApp(config, name);
  const email = `test-services-${name}-${Date.now()}@example.com`;
  const { user } = await createUserWithEmailAndPassword(getAuth(app), email, "MotDePasseTest!2026");
  const u = { app, user, uid: user.uid, name };
  const res = await call(u, "POST", "/api/users/me", { displayName: `Test ${name}`, city: "Tunis", role: role === "admin" ? "proprietaire" : role });
  if (res.status !== 201) throw new Error(`profil ${name} : ${res.status} ${res.data?.error ?? ""}`);
  return u;
}

/** Jour AAAA-MM-JJ à Tunis, décalé de `offset` jours. */
const tunisDay = (offset = 0) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Tunis" }).format(new Date(Date.now() + offset * 86_400_000));

const profile = (extra = {}) => ({
  name: "Clinique Test du Lac",
  category: "Vétérinaires",
  city: "Tunis",
  description: "Consultations, vaccins et urgences.",
  phone: "+216 71 000 000",
  email: "contact@clinique-test.tn",
  address: "12 rue du Lac",
  photo: "",
  ...extra,
});
const consultation = (extra = {}) => ({ name: "Consultation", category: "Vétérinaires", durationMinutes: 60, price: 45, description: "", ...extra });
const week = (ranges = [{ start: "08:00", end: "20:00" }]) => [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, enabled: true, ranges }));

const users = [];
const mongo = new MongoClient(process.env.MONGODB_URI);
let db;
let categoriesBefore = 0;
const TEST_CATEGORY = `Test-${Date.now()}`;

try {
  console.log(`Serveur : ${BASE_URL}\n`);
  try {
    await fetch(BASE_URL);
  } catch {
    throw new Error(`serveur injoignable sur ${BASE_URL} : lancez d'abord « npm run dev ».`);
  }
  db = (await mongo.connect()).db(process.env.MONGODB_DB || "petcare");
  categoriesBefore = await db.collection("serviceCategories").countDocuments();

  const admin = await createTestUser("admin", "admin");
  const presta = await createTestUser("presta", "prestataire");
  const presta2 = await createTestUser("presta2", "prestataire");
  const client = await createTestUser("client", "proprietaire");
  users.push(admin, presta, presta2, client);
  await db.collection("users").updateOne({ _id: admin.uid }, { $set: { role: "admin" } });
  console.log("Comptes temporaires créés (admin, presta, presta2, client).\n");
  const notifications = (who, title) => db.collection("notifications").countDocuments({ userId: who.uid, type: "service", title: { $regex: title } });

  console.log("Catégories :");
  const cats = await expectStatus("Lecture publique (visiteur)", 200, () => call(null, "GET", "/api/services/categories"));
  check("…catégories par défaut ou enregistrées, avec Vétérinaires", Array.isArray(cats) && cats.some((c) => c.name === "Vétérinaires"));
  await expectStatus("Visiteur ne crée pas de catégorie", 401, () => call(null, "POST", "/api/services/categories", { name: TEST_CATEGORY, icon: "education" }));
  await expectStatus("Un prestataire ne crée pas de catégorie", 403, () => call(presta, "POST", "/api/services/categories", { name: TEST_CATEGORY, icon: "education" }));
  await expectStatus("Nom d'une lettre refusé", 400, () => call(admin, "POST", "/api/services/categories", { name: "D", icon: "education" }));
  await expectStatus("Icône inconnue refusée", 400, () => call(admin, "POST", "/api/services/categories", { name: TEST_CATEGORY, icon: "fusee" }));
  const afterCreate = await expectStatus("L'admin ajoute une catégorie", 201, () => call(admin, "POST", "/api/services/categories", { name: TEST_CATEGORY, icon: "education" }));
  await expectStatus("Catégorie en double refusée", 409, () => call(admin, "POST", "/api/services/categories", { name: TEST_CATEGORY.toLowerCase(), icon: "autre" }));
  const testCat = afterCreate?.find((c) => c.name === TEST_CATEGORY);
  const renamed = await expectStatus("Renommer la catégorie", 200, () =>
    call(admin, "PUT", `/api/services/categories/${testCat?.id}`, { name: `${TEST_CATEGORY}-bis`, icon: "education" }),
  );
  check("…nouveau nom enregistré", renamed?.some((c) => c.name === `${TEST_CATEGORY}-bis`));

  console.log("\nProfil prestataire et validation :");
  await expectStatus("Un client (propriétaire) ne crée pas de profil prestataire", 403, () => call(client, "PUT", "/api/services/providers/me", profile()));
  check("Pas encore de profil : null", (await call(presta, "GET", "/api/services/providers/me")).data === null);
  await expectStatus("Téléphone invalide refusé", 400, () => call(presta, "PUT", "/api/services/providers/me", profile({ phone: "abc" })));
  await expectStatus("E-mail invalide refusé", 400, () => call(presta, "PUT", "/api/services/providers/me", profile({ email: "pas-un-email" })));
  await expectStatus("Catégorie inconnue refusée", 400, () => call(presta, "PUT", "/api/services/providers/me", profile({ category: "Dragons" })));
  await expectStatus("Champ non autorisé refusé (status)", 400, () => call(presta, "PUT", "/api/services/providers/me", { ...profile(), status: "published" }));
  const created = await expectStatus("Créer son profil", 201, () => call(presta, "PUT", "/api/services/providers/me", profile({ category: `${TEST_CATEGORY}-bis` })));
  check("…en attente de validation", created?.status === "pending");
  const providerId = created?.id;
  await expectStatus("Catégorie utilisée : suppression refusée", 409, () => call(admin, "DELETE", `/api/services/categories/${testCat?.id}`));
  await expectStatus("Remettre le profil en Vétérinaires", 200, () => call(presta, "PUT", "/api/services/providers/me", profile()));
  await expectStatus("Supprimer la catégorie de test (plus utilisée)", 200, () => call(admin, "DELETE", `/api/services/categories/${testCat?.id}`));
  check("Profil en attente absent de l'annuaire", !(await call(null, "GET", "/api/services/providers")).data?.some((p) => p.id === providerId));
  await expectStatus("Fiche en attente invisible pour un visiteur", 404, () => call(null, "GET", `/api/services/providers/${providerId}`));
  await expectStatus("…visible par son propriétaire", 200, () => call(presta, "GET", `/api/services/providers/${providerId}`));
  await expectStatus("…visible par l'admin", 200, () => call(admin, "GET", `/api/services/providers/${providerId}`));
  await expectStatus("Liste « en attente » refusée à un non-admin", 403, () => call(presta, "GET", "/api/services/providers?status=pending"));
  check("L'admin voit le profil en attente", (await call(admin, "GET", "/api/services/providers?status=pending")).data?.some((p) => p.id === providerId));
  await expectStatus("Un prestataire ne valide pas un profil", 403, () => call(presta, "PUT", `/api/services/providers/${providerId}/status`, { status: "published" }));
  await expectStatus("Refus sans motif refusé", 400, () => call(admin, "PUT", `/api/services/providers/${providerId}/status`, { status: "rejected" }));
  const rejected = await expectStatus("L'admin refuse le profil (avec motif)", 200, () =>
    call(admin, "PUT", `/api/services/providers/${providerId}/status`, { status: "rejected", reason: "Ajoutez une adresse complète." }),
  );
  check("…statut refusé et motif", rejected?.status === "rejected" && rejected?.rejectionReason === "Ajoutez une adresse complète.");
  check("…le prestataire est notifié", (await notifications(presta, "à corriger")) === 1);
  await expectStatus("Refuser à nouveau : plus en attente (409)", 409, () =>
    call(admin, "PUT", `/api/services/providers/${providerId}/status`, { status: "rejected", reason: "Encore" }),
  );
  const corrected = await expectStatus("Le prestataire corrige son profil", 200, () =>
    call(presta, "PUT", "/api/services/providers/me", profile({ address: "12 rue du Lac, Les Berges du Lac 1053" })),
  );
  check("…il repart en validation, sans motif", corrected?.status === "pending" && !corrected?.rejectionReason);
  const published = await expectStatus("L'admin publie le profil", 200, () => call(admin, "PUT", `/api/services/providers/${providerId}/status`, { status: "published" }));
  check("…publié et notifié", published?.status === "published" && (await notifications(presta, "publié")) === 1);
  check("Annuaire : présent", (await call(null, "GET", "/api/services/providers")).data?.some((p) => p.id === providerId));
  check("Filtre catégorie", (await call(null, "GET", `/api/services/providers?categorie=${encodeURIComponent("Vétérinaires")}`)).data?.some((p) => p.id === providerId));
  check("Filtre autre catégorie : absent", !(await call(null, "GET", "/api/services/providers?categorie=Pensions")).data?.some((p) => p.id === providerId));
  check("Filtre ville (sans accents ni majuscules)", (await call(null, "GET", "/api/services/providers?ville=TUNIS")).data?.some((p) => p.id === providerId));
  check("Recherche texte", (await call(null, "GET", "/api/services/providers?q=urgences")).data?.some((p) => p.id === providerId));

  console.log("\nPrestations :");
  await expectStatus("Un client ne crée pas de prestation", 403, () => call(client, "POST", "/api/services/providers/me/services", consultation()));
  await expectStatus("Prestataire sans profil : 404", 404, () => call(presta2, "POST", "/api/services/providers/me/services", consultation()));
  await expectStatus("Durée de 4 min refusée", 400, () => call(presta, "POST", "/api/services/providers/me/services", consultation({ durationMinutes: 4 })));
  await expectStatus("Durée de plus de 24 h refusée", 400, () => call(presta, "POST", "/api/services/providers/me/services", consultation({ durationMinutes: 1441 })));
  await expectStatus("Prix négatif refusé", 400, () => call(presta, "POST", "/api/services/providers/me/services", consultation({ price: -5 })));
  await expectStatus("Prix à 3 décimales refusé", 400, () => call(presta, "POST", "/api/services/providers/me/services", consultation({ price: 12.345 })));
  const service = await expectStatus("Créer « Consultation » (60 min, 45 DT)", 201, () => call(presta, "POST", "/api/services/providers/me/services", consultation()));
  const night = await expectStatus("Créer « Garde de nuit » (1 nuit)", 201, () =>
    call(presta, "POST", "/api/services/providers/me/services", consultation({ name: "Garde de nuit", durationMinutes: 1440, price: 30 })),
  );
  const old = await expectStatus("Créer une prestation à archiver", 201, () => call(presta, "POST", "/api/services/providers/me/services", consultation({ name: "Ancienne" })));
  await expectStatus("Archiver la prestation", 200, () => call(presta, "PUT", `/api/services/providers/me/services/${old?.id}`, consultation({ name: "Ancienne", status: "archived" })));
  await expectStatus("Un autre prestataire ne modifie pas mes prestations", 404, () =>
    call(presta2, "PUT", `/api/services/providers/me/services/${service?.id}`, consultation()),
  );
  check("Fiche publique : prestations publiées seulement (2)", (await call(null, "GET", `/api/services/providers/${providerId}`)).data?.services?.length === 2);
  check("Mon espace : archivées comprises (3)", (await call(presta, "GET", "/api/services/providers/me/services")).data?.length === 3);

  console.log("\nDisponibilités :");
  await expectStatus("Début après la fin refusé", 400, () => call(presta, "PUT", "/api/services/providers/me/availability", { days: week([{ start: "18:00", end: "09:00" }]) }));
  await expectStatus("Heure mal écrite refusée", 400, () => call(presta, "PUT", "/api/services/providers/me/availability", { days: week([{ start: "9h", end: "12:00" }]) }));
  await expectStatus("Plages qui se chevauchent refusées", 400, () =>
    call(presta, "PUT", "/api/services/providers/me/availability", { days: week([{ start: "09:00", end: "12:00" }, { start: "11:00", end: "13:00" }]) }),
  );
  await expectStatus("7 plages dans un jour refusées", 400, () =>
    call(presta, "PUT", "/api/services/providers/me/availability", { days: week(Array.from({ length: 7 }, (_, i) => ({ start: `1${i}:00`, end: `1${i}:30` }))) }),
  );
  const saved = await expectStatus("Enregistrer 08:00–20:00 tous les jours", 200, () => call(presta, "PUT", "/api/services/providers/me/availability", { days: week() }));
  check("…7 jours ouverts", saved?.length === 7 && saved.every((d) => d.enabled));

  console.log("\nCréneaux :");
  const day = tunisDay(2);
  await expectStatus("Jour mal écrit refusé", 400, () => call(null, "GET", `/api/services/providers/${providerId}/slots?serviceId=${service?.id}&day=demain`));
  await expectStatus("Prestation archivée : pas de créneaux", 404, () => call(null, "GET", `/api/services/providers/${providerId}/slots?serviceId=${old?.id}&day=${day}`));
  const slots = (await call(null, "GET", `/api/services/providers/${providerId}/slots?serviceId=${service?.id}&day=${day}`)).data ?? [];
  check("Créneaux toutes les 30 min de 08:00 à 19:00 (23 créneaux)", slots.length === 23);

  console.log("\nRéservations :");
  const booking = (extra = {}) => ({ serviceId: service?.id, dateTime: slots[0], animalName: "Milo", notes: "Vaccin annuel", ...extra });
  await expectStatus("Visiteur ne réserve pas", 401, () => call(null, "POST", "/api/services/bookings", booking()));
  await expectStatus("Date passée refusée", 400, () => call(client, "POST", "/api/services/bookings", booking({ dateTime: "2020-01-01T09:00:00.000Z" })));
  await expectStatus("Hors disponibilités refusé (22:00)", 400, () => call(client, "POST", "/api/services/bookings", booking({ dateTime: `${day}T21:00:00.000Z` })));
  await expectStatus("Prestation archivée refusée", 404, () => call(client, "POST", "/api/services/bookings", booking({ serviceId: old?.id })));
  await expectStatus("Réserver ses propres services refusé", 400, () => call(presta, "POST", "/api/services/bookings", booking()));
  await expectStatus("Animal inconnu de « Mes animaux » refusé", 400, () =>
    call(client, "POST", "/api/services/bookings", booking({ petId: "000000000000000000000000" })),
  );
  const b1 = await expectStatus("Le client réserve (en attente)", 201, () => call(client, "POST", "/api/services/bookings", booking()));
  check("…statut en attente, rendez-vous lié", b1?.status === "pending" && Boolean(b1?.appointmentId));
  check("…le prestataire est notifié", (await notifications(presta, "Nouvelle demande")) === 1);
  const agenda = (await call(client, "GET", "/api/appointments")).data ?? [];
  const rdv = agenda.find((a) => a.id === b1?.appointmentId);
  check("Agenda du client : rendez-vous « planned » avec le prestataire", rdv?.status === "planned" && rdv?.providerId === presta.uid);
  check("Agenda du prestataire : même rendez-vous", (await call(presta, "GET", "/api/appointments")).data?.some((a) => a.id === b1?.appointmentId));
  await expectStatus("Même créneau pour un autre animal : déjà pris (409)", 409, () => call(client, "POST", "/api/services/bookings", booking({ animalName: "Nala" })));
  check("Le créneau n'est plus proposé", !(await call(null, "GET", `/api/services/providers/${providerId}/slots?serviceId=${service?.id}&day=${day}`)).data?.includes(slots[0]));
  await expectStatus("Statut inconnu refusé", 400, () => call(presta, "PATCH", `/api/services/bookings/${b1?.id}/status`, { status: "pending" }));
  await expectStatus("Le client ne confirme pas", 403, () => call(client, "PATCH", `/api/services/bookings/${b1?.id}/status`, { status: "confirmed" }));
  await expectStatus("Le prestataire n'annule pas à la place du client", 403, () => call(presta, "PATCH", `/api/services/bookings/${b1?.id}/status`, { status: "cancelled" }));
  await expectStatus("Un autre prestataire ne voit pas la demande", 404, () => call(presta2, "PATCH", `/api/services/bookings/${b1?.id}/status`, { status: "confirmed" }));
  const confirmed = await expectStatus("Le prestataire confirme", 200, () => call(presta, "PATCH", `/api/services/bookings/${b1?.id}/status`, { status: "confirmed" }));
  check("…confirmée, client notifié", confirmed?.status === "confirmed" && (await notifications(client, "confirmée")) === 1);
  check("…rendez-vous confirmé dans l'agenda", (await call(client, "GET", "/api/appointments")).data?.find((a) => a.id === b1?.appointmentId)?.status === "confirmed");
  await expectStatus("Refuser une réservation confirmée (409)", 409, () => call(presta, "PATCH", `/api/services/bookings/${b1?.id}/status`, { status: "declined" }));
  await expectStatus("Annuler une réservation confirmée (409)", 409, () => call(client, "PATCH", `/api/services/bookings/${b1?.id}/status`, { status: "cancelled" }));

  const b2 = await expectStatus("Deuxième demande", 201, () => call(client, "POST", "/api/services/bookings", booking({ dateTime: slots[4] })));
  const cancelled = await expectStatus("Le client annule sa demande en attente", 200, () => call(client, "PATCH", `/api/services/bookings/${b2?.id}/status`, { status: "cancelled" }));
  check("…annulée, prestataire notifié, rendez-vous annulé",
    cancelled?.status === "cancelled" &&
      (await notifications(presta, "annulée")) === 1 &&
      (await call(client, "GET", "/api/appointments")).data?.find((a) => a.id === b2?.appointmentId)?.status === "cancelled");
  check("Créneau libéré après annulation", (await call(null, "GET", `/api/services/providers/${providerId}/slots?serviceId=${service?.id}&day=${day}`)).data?.includes(slots[4]));

  const b3 = await expectStatus("Troisième demande", 201, () => call(client, "POST", "/api/services/bookings", booking({ dateTime: slots[8] })));
  const declined = await expectStatus("Le prestataire refuse", 200, () => call(presta, "PATCH", `/api/services/bookings/${b3?.id}/status`, { status: "declined" }));
  check("…refusée, client notifié", declined?.status === "declined" && (await notifications(client, "refusée")) === 1);

  const b4 = await expectStatus("Quatrième demande (pension, 1 nuit à 19:30)", 201, () =>
    call(client, "POST", "/api/services/bookings", booking({ serviceId: night?.id, dateTime: `${day}T18:30:00.000Z` })),
  );
  const rdv4 = (await call(client, "GET", "/api/appointments")).data?.find((a) => a.id === b4?.appointmentId);
  await expectStatus("Le client annule le rendez-vous depuis l'agenda", 200, () =>
    call(client, "PATCH", `/api/appointments/${b4?.appointmentId}`, { action: "cancel", version: rdv4?.version, reason: "Imprévu" }),
  );
  check("La réservation suit l'agenda : annulée", (await call(client, "GET", "/api/services/bookings?as=client")).data?.find((b) => b.id === b4?.id)?.status === "cancelled");
  await expectStatus("…et ne peut plus changer (409)", 409, () => call(presta, "PATCH", `/api/services/bookings/${b4?.id}/status`, { status: "confirmed" }));

  await expectStatus("Paramètre « as » obligatoire", 400, () => call(client, "GET", "/api/services/bookings"));
  check("Demandes reçues par le prestataire (4)", (await call(presta, "GET", "/api/services/bookings?as=provider")).data?.length === 4);
  check("Réservations du client (4)", (await call(client, "GET", "/api/services/bookings?as=client")).data?.length === 4);
  check("Un autre prestataire ne reçoit rien", (await call(presta2, "GET", "/api/services/bookings?as=provider")).data?.length === 0);
} catch (error) {
  console.error("\nErreur pendant le test :", error.code ?? error.message);
  failed++;
} finally {
  console.log("\nNettoyage…");
  try {
    db ??= (await mongo.connect()).db(process.env.MONGODB_DB || "petcare");
    const uids = users.map((u) => u.uid);
    const providerIds = (await db.collection("serviceProviders").find({ ownerId: { $in: uids } }).toArray()).map((p) => p._id.toHexString());
    await db.collection("serviceBookings").deleteMany({ $or: [{ clientId: { $in: uids } }, { providerOwnerId: { $in: uids } }] });
    await db.collection("appointments").deleteMany({ $or: [{ ownerId: { $in: uids } }, { providerId: { $in: uids } }] });
    await db.collection("providerServices").deleteMany({ providerId: { $in: providerIds } });
    await db.collection("providerAvailability").deleteMany({ providerId: { $in: providerIds } });
    await db.collection("serviceProviders").deleteMany({ ownerId: { $in: uids } });
    await db.collection("notifications").deleteMany({ $or: [{ userId: { $in: uids } }, { senderId: { $in: uids } }] });
    await db.collection("users").deleteMany({ _id: { $in: uids } });
    // Catégories : on revient à l'état initial (catégories par défaut si rien n'était enregistré).
    if (categoriesBefore === 0) await db.collection("serviceCategories").deleteMany({});
    else await db.collection("serviceCategories").deleteMany({ name: { $regex: `^${TEST_CATEGORY}` } });
  } catch (error) {
    console.log("  MongoDB :", error.message);
  }
  await mongo.close();
  for (const u of users) {
    await deleteUser(u.user).catch((e) => console.log("  compte :", e.code));
    await deleteApp(u.app);
  }
  console.log(`\nRésultat : ${passed} réussi(s), ${failed} échoué(s)`);
  process.exit(failed ? 1 : 0);
}
