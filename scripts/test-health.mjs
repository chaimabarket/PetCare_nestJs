// Teste les routes /api/health-records (carnet de santé, onglet Santé, prises) sur le serveur lancé.
// Crée deux comptes Firebase temporaires et leurs animaux, vérifie chaque règle, puis supprime tout.
// Lancement : npm run dev   (dans un autre terminal)   puis   npm run test:health
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
  const type = response.headers.get("content-type") ?? "";
  const data = type.includes("json") ? await response.json() : Buffer.from(await response.arrayBuffer());
  return { status: response.status, data };
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
  const email = `test-health-${name}-${Date.now()}@example.com`;
  const { user } = await createUserWithEmailAndPassword(getAuth(app), email, "MotDePasseTest!2026");
  const u = { app, user, uid: user.uid };
  const res = await call(u, "POST", "/api/users/me", { displayName: `Test ${name}`, city: "Tunis", role: "proprietaire" });
  if (res.status !== 201) throw new Error(`profil ${name} : ${res.status}`);
  return u;
}

const iso = (days) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const pdf = (name = "certificat.pdf") => ({ name, mimeType: "application/pdf", data: PDF.toString("base64") });
let PET = ""; // animal « Milo » de A, créé via /api/pets

const record = (extra = {}) => ({
  petId: PET,
  doseTimes: [],
  doseEveryDays: 1,
  petName: "Milo",
  type: "vaccin",
  title: "Vaccin CHPL",
  date: iso(-1),
  veterinarian: "Dr Ben Salah",
  clinic: "Clinique des Jasmins",
  notes: "",
  lotNumber: "LOT-42",
  nextDueDate: iso(30),
  dosage: "",
  endDate: "",
  ...extra,
});

const reminders = async (u) =>
  ((await call(u, "GET", "/api/notifications")).data ?? []).filter((n) => n.type === "rappel" && n.title.includes("Milo"));

const users = [];
const mongo = new MongoClient(process.env.MONGODB_URI);

try {
  console.log(`Serveur : ${BASE_URL}\n`);
  try {
    await fetch(BASE_URL);
  } catch {
    throw new Error(`serveur injoignable sur ${BASE_URL} : lancez d'abord « npm run dev ».`);
  }
  const a = await createTestUser("a");
  const b = await createTestUser("b");
  users.push(a, b);
  const newPet = async (u, name, species = "cat") =>
    (await call(u, "POST", "/api/pets", { pet: { name, species, sex: "male", breed: "Européen", birthDate: "2022-05-12" } })).data?.id;
  PET = await newPet(a, "Milo");
  const rex = await newPet(a, "Rex", "dog");
  const nala = await newPet(b, "Nala");
  if (!PET || !rex || !nala) throw new Error("création des animaux impossible");
  console.log("Comptes et animaux temporaires créés.\n");

  console.log("Validation :");
  await expectStatus("Visiteur sans jeton", 401, () => call(null, "GET", `/api/health-records?petId=${PET}`));
  await expectStatus("petId obligatoire", 400, () => call(a, "GET", "/api/health-records"));
  await expectStatus("Animal inconnu (identifiant libre) refusé", 404, () => call(a, "POST", "/api/health-records", record({ petId: "pet-libre" })));
  await expectStatus("Carnet de l'animal d'un autre utilisateur refusé (écriture)", 404, () =>
    call(a, "POST", "/api/health-records", record({ petId: nala })),
  );
  await expectStatus("Carnet de l'animal d'un autre utilisateur refusé (lecture)", 404, () => call(a, "GET", `/api/health-records?petId=${nala}`));
  const invalid = await expectStatus("Titre vide et date future refusés", 400, () =>
    call(a, "POST", "/api/health-records", record({ title: "", date: iso(10) })),
  );
  check("Erreurs par champ renvoyées (title, date)", Boolean(invalid?.fieldErrors?.title && invalid?.fieldErrors?.date));
  const noVet = await expectStatus("Visite sans vétérinaire refusée", 400, () =>
    call(a, "POST", "/api/health-records", record({ type: "visite", veterinarian: "" })),
  );
  check("Erreur sur le champ vétérinaire", Boolean(noVet?.fieldErrors?.veterinarian));
  await expectStatus("Format de pièce jointe refusé (exe)", 400, () =>
    call(a, "POST", "/api/health-records", { ...record(), newAttachments: [{ name: "x.exe", mimeType: "application/x-msdownload", data: "AAAA" }] }),
  );
  await expectStatus("Pièce jointe de plus de 2 Mo refusée", 400, () =>
    call(a, "POST", "/api/health-records", {
      ...record(),
      newAttachments: [{ name: "gros.pdf", mimeType: "application/pdf", data: Buffer.alloc(2 * 1024 * 1024 + 1).toString("base64") }],
    }),
  );
  await expectStatus("Plus de 3 pièces jointes refusées", 400, () =>
    call(a, "POST", "/api/health-records", { ...record(), newAttachments: [pdf(), pdf(), pdf(), pdf()] }),
  );

  console.log("\nCréation, lecture, droits :");
  const created = await expectStatus("A ajoute un vaccin avec certificat PDF", 201, () =>
    call(a, "POST", "/api/health-records", { ...record(), newAttachments: [pdf()] }),
  );
  const rec = created?.record;
  check("Acte renvoyé sans contenu de pièce jointe", rec?.attachments.length === 1 && rec.attachments[0].data === undefined);
  const r1 = await reminders(a);
  check("Rappel de vaccin programmé 7 jours avant l'échéance", r1.length === 1 && r1[0].showAt.slice(0, 10) === iso(23));
  check("A voit l'acte dans le carnet", (await call(a, "GET", `/api/health-records?petId=${PET}`)).data?.records?.length === 1);
  check("Filtre par type (visite → 0)", (await call(a, "GET", `/api/health-records?petId=${PET}&type=visite`)).data?.records?.length === 0);
  check("Nom de l'animal repris de sa fiche", rec?.petName === "Milo");
  await expectStatus("B ne peut pas lire le carnet de A", 404, () => call(b, "GET", `/api/health-records?petId=${PET}`));
  await expectStatus("B ne peut pas lire l'acte de A", 404, () => call(b, "GET", `/api/health-records/${rec?.id}`));
  await expectStatus("B ne peut pas modifier l'acte de A", 404, () => call(b, "PUT", `/api/health-records/${rec?.id}`, record()));
  await expectStatus("B ne peut pas supprimer l'acte de A", 404, () => call(b, "DELETE", `/api/health-records/${rec?.id}`));
  await expectStatus("B ne peut pas télécharger la pièce jointe de A", 404, () =>
    call(b, "GET", `/api/health-records/${rec?.id}/attachments/${rec?.attachments[0]?.id}`),
  );
  const file = await expectStatus("A télécharge sa pièce jointe", 200, () =>
    call(a, "GET", `/api/health-records/${rec?.id}/attachments/${rec?.attachments[0]?.id}`),
  );
  check("Contenu identique au fichier envoyé", Buffer.isBuffer(file) && file.equals(PDF));
  await expectStatus("Identifiant invalide", 404, () => call(a, "GET", "/api/health-records/pas-un-id"));
  const sum1 = (await call(a, "GET", `/api/health-records/summary?day=${iso(0)}`)).data;
  const milo1 = sum1?.pets?.find((p) => p.petId === PET);
  check("Onglet Santé : Milo, vaccin « bientôt » (rappel dans 30 jours)", milo1?.vaccine?.status === "soon" && milo1.vaccine.next?.daysLeft === 30);
  check("Onglet Santé : vaccin dans la liste des 30 prochains jours", sum1?.upcomingVaccines?.some((v) => v.recordId === rec?.id));
  check("Onglet Santé : B ne voit pas les animaux de A", !(await call(b, "GET", `/api/health-records/summary?day=${iso(0)}`)).data?.pets?.some((p) => p.petId === PET));
  await expectStatus("Onglet Santé : jour invalide refusé", 400, () => call(a, "GET", "/api/health-records/summary?day=2020-01-01"));

  console.log("\nModification :");
  await expectStatus("Changer l'animal d'un acte refusé", 400, () => call(a, "PUT", `/api/health-records/${rec?.id}`, record({ petId: "autre" })));
  const updated = await expectStatus("Repousser le rappel et remplacer la pièce jointe", 200, () =>
    call(a, "PUT", `/api/health-records/${rec?.id}`, { ...record({ nextDueDate: iso(60) }), keepAttachmentIds: [], newAttachments: [pdf("nouveau.pdf")] }),
  );
  check("Pièce jointe remplacée", updated?.record?.attachments.length === 1 && updated.record.attachments[0].name === "nouveau.pdf");
  const r2 = await reminders(a);
  check("Le rappel est remplacé (un seul, nouvelle date)", r2.length === 1 && r2[0].showAt.slice(0, 10) === iso(53));
  await expectStatus("Transformer en visite", 200, () =>
    call(a, "PUT", `/api/health-records/${rec?.id}`, { ...record({ type: "visite", title: "Contrôle annuel" }), keepAttachmentIds: [] }),
  );
  check("Plus de rappel pour une visite", (await reminders(a)).length === 0);
  await expectStatus("Remettre en vaccin", 200, () => call(a, "PUT", `/api/health-records/${rec?.id}`, { ...record(), keepAttachmentIds: [] }));

  console.log("\nPrises de traitement :");
  const badTimes = await expectStatus("Heure de prise invalide refusée", 400, () =>
    call(a, "POST", "/api/health-records", record({ type: "traitement", title: "Antibiotique", veterinarian: "", doseTimes: ["25:00"] })),
  );
  check("Erreur sur le champ doseTimes", Boolean(badTimes?.fieldErrors?.doseTimes));
  const treat = (
    await expectStatus("A ajoute un traitement (08:00 et 20:00, tous les jours)", 201, () =>
      call(a, "POST", "/api/health-records", record({ type: "traitement", title: "Antibiotique", date: iso(-2), dosage: "1 comprimé", doseTimes: ["20:00", "08:00"] })),
    )
  )?.record;
  check("Horaires triés", treat?.doseTimes?.join(",") === "08:00,20:00" && treat.doseEveryDays === 1);
  const doses = () => call(a, "GET", `/api/health-records/summary?day=${iso(0)}`).then((r) => r.data?.doses?.filter((d) => d.recordId === treat?.id) ?? []);
  check("Deux prises aujourd'hui, aucune notée", (await doses()).length === 2 && (await doses()).every((d) => !d.taken));
  const dosePath = `/api/health-records/${treat?.id}/doses`;
  await expectStatus("Noter la prise de 08:00", 201, () => call(a, "POST", dosePath, { day: iso(0), time: "08:00" }));
  await expectStatus("La noter deux fois : sans effet", 201, () => call(a, "POST", dosePath, { day: iso(0), time: "08:00" }));
  const afterTake = await doses();
  check("Prise de 08:00 notée (1 / 2)", afterTake.filter((d) => d.taken).length === 1 && afterTake.find((d) => d.time === "08:00")?.taken);
  check("Carte de Milo : prises du jour 1 / 2", (await call(a, "GET", `/api/health-records/summary?day=${iso(0)}`)).data?.pets?.find((p) => p.petId === PET)?.dosesDone === 1);
  await expectStatus("Heure non prévue refusée", 400, () => call(a, "POST", dosePath, { day: iso(0), time: "12:00" }));
  await expectStatus("Prise d'il y a 5 jours refusée", 400, () => call(a, "POST", dosePath, { day: iso(-5), time: "08:00" }));
  await expectStatus("Prise sur un vaccin refusée", 400, () => call(a, "POST", `/api/health-records/${rec?.id}/doses`, { day: iso(0), time: "08:00" }));
  await expectStatus("B ne peut pas noter la prise de A", 404, () => call(b, "POST", dosePath, { day: iso(0), time: "20:00" }));
  await expectStatus("Annuler la prise de 08:00", 204, () => call(a, "DELETE", `${dosePath}?day=${iso(0)}&time=08:00`));
  check("Plus aucune prise notée", (await doses()).every((d) => !d.taken));
  await expectStatus("Noter la prise de 20:00", 201, () => call(a, "POST", dosePath, { day: iso(0), time: "20:00" }));
  await expectStatus("Supprimer le traitement", 204, () => call(a, "DELETE", `/api/health-records/${treat?.id}`));
  check("Ses prises sont supprimées", (await doses()).length === 0);

  console.log("\nPartage sécurisé (lien + QR code) :");
  await expectStatus("Allergie ajoutée", 201, () => call(a, "POST", "/api/health-records", record({ type: "allergie", title: "Allergie au poulet", veterinarian: "", nextDueDate: "", lotNumber: "" })));
  await expectStatus("Visite ajoutée", 201, () => call(a, "POST", "/api/health-records", record({ type: "visite", title: "Bilan annuel", notes: "Note de visite", nextDueDate: "", lotNumber: "" })));
  const shareBody = (extra = {}) => ({ petId: PET, scope: "urgence", durationHours: 24, label: "Pet-sitter", ...extra });
  await expectStatus("Portée inconnue refusée", 400, () => call(a, "POST", "/api/health-records/shares", shareBody({ scope: "tout" })));
  await expectStatus("Durée libre refusée", 400, () => call(a, "POST", "/api/health-records/shares", shareBody({ durationHours: 9999 })));
  await expectStatus("Visiteur sans jeton refusé", 401, () => call(null, "POST", "/api/health-records/shares", shareBody()));
  await expectStatus("B ne peut pas partager le carnet de A", 404, () => call(b, "POST", "/api/health-records/shares", shareBody()));
  const urgent = await expectStatus("A crée un lien « fiche d'urgence » (24 h)", 201, () => call(a, "POST", "/api/health-records/shares", shareBody()));
  check("Jeton aléatoire de 43 caractères (base64url)", /^[A-Za-z0-9_-]{43}$/.test(urgent?.token ?? ""));
  const listed = (await call(a, "GET", `/api/health-records/shares?petId=${PET}`)).data?.shares ?? [];
  check("Le lien apparaît dans la liste, sans jeton ni empreinte", listed.length === 1 && !("token" in listed[0]) && !("tokenHash" in listed[0]));
  await expectStatus("B ne voit pas les liens de A", 404, () => call(b, "GET", `/api/health-records/shares?petId=${PET}`));
  const pub = await expectStatus("Ouverture du lien sans compte", 200, () => call(null, "GET", `/api/partage/${urgent?.token}`));
  const pubText = JSON.stringify(pub ?? {});
  check("Carnet de Milo affiché", pub?.pet?.name === "Milo");
  check("Ni e-mail du propriétaire, ni contacts, ni pièces jointes, ni identifiants internes",
    !pubText.includes(a.user.email) && !/"(contacts|attachments|ownerId|tokenHash|petId)"/.test(pubText));
  check("Fiche d'urgence : allergie et vaccin, pas la visite", pub?.records?.some((r) => r.type === "allergie") && pub.records.some((r) => r.type === "vaccin") && !pub.records.some((r) => r.type === "visite"));
  check("Fiche d'urgence : pas de numéro de puce", pub?.pet?.chipNumber === "");
  check("Consultation comptée", (await call(a, "GET", `/api/health-records/shares?petId=${PET}`)).data?.shares?.[0]?.accessCount === 1);
  const full = await expectStatus("A crée un lien « carnet complet » (7 jours)", 201, () => call(a, "POST", "/api/health-records/shares", shareBody({ scope: "complet", durationHours: 168 })));
  const fullBook = (await call(null, "GET", `/api/partage/${full?.token}`)).data;
  check("Carnet complet : la visite et ses notes sont visibles", fullBook?.records?.some((r) => r.type === "visite" && r.notes === "Note de visite"));
  await expectStatus("Jeton inconnu", 404, () => call(null, "GET", `/api/partage/${"x".repeat(43)}`));
  await expectStatus("Jeton mal formé", 404, () => call(null, "GET", "/api/partage/abc"));
  await expectStatus("B ne peut pas désactiver le lien de A", 404, () => call(b, "DELETE", `/api/health-records/shares/${urgent?.share?.id}`));
  await expectStatus("A désactive le lien", 200, () => call(a, "DELETE", `/api/health-records/shares/${urgent?.share?.id}`));
  await expectStatus("Lien désactivé : plus accessible", 410, () => call(null, "GET", `/api/partage/${urgent?.token}`));
  await mongo.connect();
  await mongo.db(process.env.MONGODB_DB || "petcare").collection("health_shares").updateOne(
    { _id: new ObjectId(full?.share?.id) },
    { $set: { expiresAt: new Date(Date.now() - 1000) } },
  );
  await expectStatus("Lien expiré : plus accessible", 410, () => call(null, "GET", `/api/partage/${full?.token}`));

  console.log("\nAnimal archivé (carnet en lecture seule) :");
  const rexRecord = (extra = {}) => record({ petId: rex, petName: "Rex", ...extra });
  const rexVaccine = (await expectStatus("Acte ajouté avant l'archivage", 201, () => call(a, "POST", "/api/health-records", rexRecord())))?.record;
  const rexTreat = (
    await expectStatus("Traitement ajouté avant l'archivage", 201, () =>
      call(a, "POST", "/api/health-records", rexRecord({ type: "traitement", title: "Gouttes", veterinarian: "", doseTimes: ["09:00"] })),
    )
  )?.record;
  await expectStatus("Archivage de Rex", 200, () => call(a, "POST", `/api/pets/${rex}/archive`, { reason: "Test" }));
  await expectStatus("Ajout refusé", 409, () => call(a, "POST", "/api/health-records", rexRecord({ title: "Nouveau" })));
  await expectStatus("Modification refusée", 409, () => call(a, "PUT", `/api/health-records/${rexVaccine?.id}`, { ...rexRecord({ title: "Modifié" }), keepAttachmentIds: [] }));
  await expectStatus("Ajout de pièce jointe refusé", 409, () =>
    call(a, "PUT", `/api/health-records/${rexVaccine?.id}`, { ...rexRecord(), keepAttachmentIds: [], newAttachments: [pdf()] }),
  );
  await expectStatus("Suppression refusée", 409, () => call(a, "DELETE", `/api/health-records/${rexVaccine?.id}`));
  await expectStatus("Prise refusée", 409, () => call(a, "POST", `/api/health-records/${rexTreat?.id}/doses`, { day: iso(0), time: "09:00" }));
  const rexShare = await expectStatus("Partage permis (il montre le carnet sans le modifier)", 201, () =>
    call(a, "POST", "/api/health-records/shares", { petId: rex, scope: "complet", durationHours: 24 }),
  );
  check("Lien d'un animal archivé lisible et signalé archivé", (await call(null, "GET", `/api/partage/${rexShare?.token}`)).data?.pet?.archived === true);
  check("Lecture du carnet toujours permise", (await call(a, "GET", `/api/health-records?petId=${rex}`)).data?.records?.length === 2);
  await expectStatus("Lecture d'un acte toujours permise", 200, () => call(a, "GET", `/api/health-records/${rexVaccine?.id}`));
  const sum2 = (await call(a, "GET", `/api/health-records/summary?day=${iso(0)}`)).data;
  check("Onglet Santé : Rex en dernier, marqué archivé", sum2?.pets?.at(-1)?.petId === rex && sum2.pets.at(-1).archived === true);
  check("Onglet Santé : pas de prise ni de rappel pour un animal archivé", !sum2?.doses?.some((d) => d.petId === rex) && !sum2?.upcomingVaccines?.some((v) => v.petId === rex));
  await expectStatus("Restauration de Rex", 200, () => call(a, "POST", `/api/pets/${rex}/restore`));
  await expectStatus("Après restauration, l'ajout est de nouveau permis", 201, () => call(a, "POST", "/api/health-records", rexRecord({ title: "Après restauration" })));

  console.log("\nSuppression :");
  await expectStatus("A supprime l'acte", 204, () => call(a, "DELETE", `/api/health-records/${rec?.id}`));
  check("Le rappel est supprimé avec l'acte", (await reminders(a)).length === 0);
  await expectStatus("L'acte n'existe plus", 404, () => call(a, "GET", `/api/health-records/${rec?.id}`));
} catch (error) {
  console.error("\nErreur pendant le test :", error.code ?? error.message);
  failed++;
} finally {
  console.log("\nNettoyage…");
  try {
    await mongo.connect();
    const db = mongo.db(process.env.MONGODB_DB || "petcare");
    const uids = users.map((u) => u.uid);
    await db.collection("health_records").deleteMany({ ownerId: { $in: uids } });
    await db.collection("treatment_doses").deleteMany({ ownerId: { $in: uids } });
    await db.collection("health_shares").deleteMany({ ownerId: { $in: uids } });
    await db.collection("pets").deleteMany({ ownerId: { $in: uids } });
    await db.collection("petWeights").deleteMany({ ownerId: { $in: uids } });
    await db.collection("notifications").deleteMany({ userId: { $in: uids } });
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
