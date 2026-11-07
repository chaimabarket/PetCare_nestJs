// Teste les routes /api/health-records (carnet de santé) sur le serveur lancé.
// Crée deux comptes Firebase temporaires, vérifie chaque règle, puis supprime tout.
// Lancement : npm run dev   (dans un autre terminal)   puis   npm run test:health
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
const PET = `pet-${Date.now()}`;

const record = (extra = {}) => ({
  petId: PET,
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
  console.log("Comptes temporaires créés.\n");

  console.log("Validation :");
  await expectStatus("Visiteur sans jeton", 401, () => call(null, "GET", `/api/health-records?petId=${PET}`));
  await expectStatus("petId obligatoire", 400, () => call(a, "GET", "/api/health-records"));
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
  check("B ne voit rien dans le carnet de A", (await call(b, "GET", `/api/health-records?petId=${PET}`)).data?.records?.length === 0);
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
  const pets = (await call(a, "GET", "/api/health-records/pets")).data?.pets ?? [];
  check("Résumé des animaux : Milo, 1 acte", pets.length === 1 && pets[0].petName === "Milo" && pets[0].count === 1);

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
