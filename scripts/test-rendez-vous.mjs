// Teste les routes /api/appointments et /api/reminders (règles RG-12 à RG-21, droits d'accès) sur le serveur lancé.
// Crée deux comptes Firebase temporaires, vérifie chaque règle, puis supprime tout.
// Lancement : npm run dev   (dans un autre terminal)   puis   npm run test:rendez-vous
import { deleteApp, initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, deleteUser, getAuth } from "firebase/auth";
import { MongoClient, ObjectId } from "mongodb";

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

async function createTestUser(name) {
  const app = initializeApp(config, name);
  const email = `test-rdv-${name}-${Date.now()}@example.com`;
  const { user } = await createUserWithEmailAndPassword(getAuth(app), email, "MotDePasseTest!2026");
  const u = { app, user, uid: user.uid };
  const res = await call(u, "POST", "/api/users/me", { displayName: `Test ${name}`, city: "Tunis", role: "proprietaire" });
  if (res.status !== 201) throw new Error(`profil ${name} : ${res.status}`);
  return u;
}

/** Demain à hh:mm (heure locale), au format ISO. */
const tomorrowAt = (h, m = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(h, m, 0, 0);
  return d;
};

const appointment = (extra = {}) => ({
  pet: { name: "Milo", breed: "Chat européen" },
  title: "Toilettage",
  type: "soin",
  startsAt: tomorrowAt(10).toISOString(),
  durationMinutes: 60,
  place: "domicile",
  location: "Tunis",
  notes: "",
  reminderMinutes: 1440,
  pushReminder: true,
  ...extra,
});

const patch = (who, a, body) => call(who, "PATCH", `/api/appointments/${a.id}`, { version: a.version, ...body });
const users = [];
const mongo = new MongoClient(process.env.MONGODB_URI);

try {
  console.log(`Serveur : ${BASE_URL}\n`);
  try {
    await fetch(BASE_URL);
  } catch {
    throw new Error(`serveur injoignable sur ${BASE_URL} : lancez d'abord « npm run dev ».`);
  }
  await mongo.connect();
  const db = mongo.db(process.env.MONGODB_DB || "petcare");
  const a = await createTestUser("a");
  const b = await createTestUser("b");
  users.push(a, b);
  console.log("Comptes temporaires créés.\n");

  console.log("Création (RG-13 à RG-16) :");
  await expectStatus("Visiteur sans jeton", 401, () => call(null, "GET", "/api/appointments"));
  await expectStatus("Rendez-vous dans le passé refusé", 400, () =>
    call(a, "POST", "/api/appointments", appointment({ startsAt: new Date(Date.now() - 3600_000).toISOString() })),
  );
  await expectStatus("Intitulé vide refusé", 400, () => call(a, "POST", "/api/appointments", appointment({ title: " " })));
  await expectStatus("Durée nulle refusée", 400, () => call(a, "POST", "/api/appointments", appointment({ durationMinutes: 0 })));
  await expectStatus("Type inconnu refusé", 400, () => call(a, "POST", "/api/appointments", appointment({ type: "pub" })));
  let rdv = await expectStatus("A crée un rendez-vous personnel", 201, () => call(a, "POST", "/api/appointments", appointment()));
  check("Statut « Confirmé », version 1, historique « créé » par A", rdv?.status === "confirmed" && rdv.version === 1 && rdv.changes[0]?.by === a.uid);
  await expectStatus("Même animal, créneau qui chevauche → conflit", 409, () =>
    call(a, "POST", "/api/appointments", appointment({ startsAt: tomorrowAt(10, 30).toISOString() })),
  );
  await expectStatus("Conflit insensible à la casse (« milo »)", 409, () =>
    call(a, "POST", "/api/appointments", appointment({ pet: { name: "milo" }, startsAt: tomorrowAt(10, 15).toISOString() })),
  );
  await expectStatus("Créneau qui commence à la fin exacte du précédent : libre", 201, () =>
    call(a, "POST", "/api/appointments", appointment({ startsAt: tomorrowAt(11).toISOString() })),
  );
  await expectStatus("Autre animal au même moment : libre", 201, () =>
    call(a, "POST", "/api/appointments", appointment({ pet: { name: "Nala" } })),
  );

  console.log("\nDroits et versions (RG-20) :");
  check("B ne voit pas l'agenda de A", (await call(b, "GET", "/api/appointments")).data?.length === 0);
  check("A voit ses 3 rendez-vous", (await call(a, "GET", "/api/appointments")).data?.length === 3);
  await expectStatus("B ne peut pas modifier le rendez-vous de A", 404, () => patch(b, rdv, { action: "cancel" }));
  await expectStatus("Version périmée refusée", 409, () => patch(a, { ...rdv, version: 99 }, { action: "cancel" }));
  await expectStatus("A ne peut pas « confirmer » (réservé au prestataire)", 403, () => patch(a, rdv, { action: "confirm" }));

  console.log("\nReport, rappel, annulation (RG-17, RG-18, RG-21) :");
  await expectStatus("Report sans motif refusé", 400, () => patch(a, rdv, { action: "reschedule", startsAt: tomorrowAt(14).toISOString(), reason: "" }));
  await expectStatus("Report au même horaire refusé", 400, () =>
    patch(a, rdv, { action: "reschedule", startsAt: rdv.startsAt, reason: "Imprévu" }),
  );
  await expectStatus("Report sur un créneau occupé par le même animal refusé", 409, () =>
    patch(a, rdv, { action: "reschedule", startsAt: tomorrowAt(11, 30).toISOString(), reason: "Imprévu" }),
  );
  rdv = await expectStatus("Rappel marqué « Fait »", 200, () => patch(a, rdv, { action: "reminder-done", done: true }));
  check("reminderDoneAt enregistré, version 2", Boolean(rdv?.reminderDoneAt) && rdv.version === 2);
  rdv = await expectStatus("Report à 14 h avec motif", 200, () =>
    patch(a, rdv, { action: "reschedule", startsAt: tomorrowAt(14).toISOString(), reason: "Imprévu au travail" }),
  );
  const last = rdv?.changes.at(-1);
  check("Historique « reporté » avec ancien et nouvel horaire", last?.action === "reschedule" && last.reason === "Imprévu au travail" && Boolean(last.oldStart && last.newStart));
  check("Le rappel « Fait » est remis à zéro après un report (RG-21)", rdv && rdv.reminderDoneAt === undefined);
  rdv = await expectStatus("Désactiver le rappel", 200, () => patch(a, rdv, { action: "reminder", minutes: 0 }));
  check("reminderMinutes = 0", rdv?.reminderMinutes === 0);
  await expectStatus("Terminer avant l'heure de fin refusé (RG-19)", 400, () => patch(a, rdv, { action: "complete" }));
  rdv = await expectStatus("Annuler avec un motif", 200, () => patch(a, rdv, { action: "cancel", reason: "Plus nécessaire" }));
  check("Statut « Annulé » et motif enregistré", rdv?.status === "cancelled" && rdv.cancelReason === "Plus nécessaire");
  await expectStatus("Annuler deux fois refusé (CANCELLED définitif)", 400, () => patch(a, rdv, { action: "cancel" }));
  await expectStatus("Régler le rappel d'un rendez-vous annulé refusé", 400, () => patch(a, rdv, { action: "reminder", minutes: 60 }));

  console.log("\nRéservation d'un prestataire et rendez-vous passé :");
  // Le module Services n'existe pas encore : réservation et rendez-vous passé insérés directement.
  const bookingId = new ObjectId();
  const start = tomorrowAt(16);
  await db.collection("appointments").insertOne({
    _id: bookingId, ownerId: a.uid, providerId: b.uid, providerName: "Clinique B", petName: "Rocky", title: "Vaccin rage",
    type: "vaccin", startsAt: start, endsAt: new Date(start.getTime() + 30 * 60_000), status: "planned", place: "autre",
    location: "", notes: "", reminderMinutes: 1440, pushReminder: true, version: 1, changes: [{ action: "create", at: new Date(), by: a.uid }],
  });
  let booking = (await call(b, "GET", "/api/appointments")).data?.find((x) => x.id === bookingId.toHexString());
  check("Le prestataire voit la réservation dans son agenda", Boolean(booking));
  booking = await expectStatus("Le prestataire confirme", 200, () => patch(b, booking, { action: "confirm" }));
  check("Statut « Confirmé », confirmé par le prestataire", booking?.status === "confirmed" && booking.changes.at(-1)?.by === b.uid);
  await expectStatus("Le prestataire ne règle pas le rappel du client", 403, () => patch(b, booking, { action: "reminder", minutes: 0 }));
  booking = await expectStatus("Le client reporte la réservation", 200, () =>
    patch(a, booking, { action: "reschedule", startsAt: tomorrowAt(17).toISOString(), reason: "Indisponible" }),
  );
  check("Une réservation reportée repasse « En attente » (RG-18)", booking?.status === "planned");
  const pastId = new ObjectId();
  const pastStart = new Date(Date.now() - 3 * 3600_000);
  await db.collection("appointments").insertOne({
    _id: pastId, ownerId: a.uid, petName: "Milo", title: "Promenade", type: "garde", startsAt: pastStart,
    endsAt: new Date(pastStart.getTime() + 3600_000), status: "confirmed", place: "exterieur", location: "", notes: "",
    reminderMinutes: 0, pushReminder: false, version: 1, changes: [{ action: "create", at: pastStart, by: a.uid }],
  });
  const past = { id: pastId.toHexString(), version: 1 };
  await expectStatus("Annuler un rendez-vous commencé refusé (RG-17)", 400, () => patch(a, past, { action: "cancel" }));
  const done = await expectStatus("Terminer un rendez-vous confirmé et fini (RG-19)", 200, () => patch(a, past, { action: "complete" }));
  check("Statut « Terminé »", done?.status === "completed");

  console.log("\nRappels de soins :");
  await expectStatus("Rappel sans intitulé refusé", 400, () =>
    call(a, "POST", "/api/reminders", { petName: "Milo", title: "", description: "", detail: "", category: "soin", dueAt: tomorrowAt(9).toISOString() }),
  );
  await expectStatus("Catégorie inconnue refusée", 400, () =>
    call(a, "POST", "/api/reminders", { petName: "Milo", title: "X", description: "", detail: "", category: "pub", dueAt: tomorrowAt(9).toISOString() }),
  );
  const reminder = await expectStatus("A crée un rappel", 201, () =>
    call(a, "POST", "/api/reminders", { petName: "Milo", title: "Vermifuge", description: "", detail: "1 comprimé", category: "medicament", dueAt: tomorrowAt(9).toISOString() }),
  );
  check("Rappel à faire, enregistré au nom de A", reminder?.done === false && reminder.ownerId === a.uid && reminder.detail === "1 comprimé");
  check("B ne voit pas les rappels de A", (await call(b, "GET", "/api/reminders")).data?.length === 0);
  await expectStatus("B ne peut pas valider le rappel de A", 404, () => call(b, "PATCH", `/api/reminders/${reminder?.id}`, { done: true }));
  await expectStatus("B ne peut pas supprimer le rappel de A", 404, () => call(b, "DELETE", `/api/reminders/${reminder?.id}`));
  const doneReminder = await expectStatus("A valide le rappel", 200, () => call(a, "PATCH", `/api/reminders/${reminder?.id}`, { done: true }));
  check("doneAt enregistré", doneReminder?.done === true && Boolean(doneReminder.doneAt));
  const undone = await expectStatus("A remet le rappel à faire", 200, () => call(a, "PATCH", `/api/reminders/${reminder?.id}`, { done: false }));
  check("doneAt retiré", undone?.done === false && undone.doneAt === undefined);
  await expectStatus("A supprime le rappel", 204, () => call(a, "DELETE", `/api/reminders/${reminder?.id}`));
  await expectStatus("Rappel introuvable ensuite", 404, () => call(a, "DELETE", `/api/reminders/${reminder?.id}`));
} catch (error) {
  console.error("\nErreur pendant le test :", error.code ?? error.message);
  failed++;
} finally {
  console.log("\nNettoyage…");
  try {
    const db = mongo.db(process.env.MONGODB_DB || "petcare");
    const uids = users.map((u) => u.uid);
    await db.collection("appointments").deleteMany({ $or: [{ ownerId: { $in: uids } }, { providerId: { $in: uids } }] });
    await db.collection("reminders").deleteMany({ ownerId: { $in: uids } });
    await db.collection("users").deleteMany({ _id: { $in: uids } });
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
