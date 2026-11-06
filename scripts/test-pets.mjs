// Teste les routes /api/pets (règles d'accès, photos, pesées, archivage, alerte de poids) sur le serveur lancé.
// Crée des comptes Firebase temporaires, vérifie chaque règle, puis supprime tout.
// Lancement : npm run dev   (dans un autre terminal)   puis   npm run test:pets
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
const PHOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U";
const photo = { url: PHOTO, thumbnail: PHOTO };

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
  const email = `test-pets-${name}-${Date.now()}@example.com`;
  const { user } = await createUserWithEmailAndPassword(getAuth(app), email, "MotDePasseTest!2026");
  const u = { app, user, uid: user.uid, name };
  const res = await call(u, "POST", "/api/users/me", { displayName: `Test ${name}`, city: "Tunis", role: "proprietaire" });
  if (res.status !== 201) throw new Error(`profil ${name} : ${res.status} ${res.data?.error ?? ""}`);
  return u;
}

/** Jour AAAA-MM-JJ (UTC) décalé de `offset` jours. */
const day = (offset = 0) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

const petInput = (extra = {}) => ({
  name: "Milo",
  species: "dog",
  sex: "male",
  breed: "Golden Retriever",
  birthDate: "2020-05-12",
  birthDateEstimated: false,
  chipNumber: "250269608123456",
  sterilized: true,
  notes: "Adore les balles.",
  vet: { name: "Dr Martin", clinic: "Clinique du Lac", address: "", phone: "+216 71 000 000" },
  ...extra,
});

const users = [];
const mongo = new MongoClient(process.env.MONGODB_URI);

try {
  console.log(`Serveur : ${BASE_URL}\n`);
  try {
    await fetch(BASE_URL);
  } catch {
    throw new Error(`serveur injoignable sur ${BASE_URL} : lancez d'abord « npm run dev ».`);
  }
  const alice = await createTestUser("alice");
  const bob = await createTestUser("bob");
  users.push(alice, bob);
  console.log("Comptes temporaires créés (alice, bob).\n");

  console.log("Validation des champs :");
  await expectStatus("Visiteur refusé", 401, () => call(null, "GET", "/api/pets"));
  await expectStatus("Nom trop court refusé", 400, () => call(alice, "POST", "/api/pets", { pet: petInput({ name: "M" }) }));
  await expectStatus("Espèce inconnue refusée", 400, () => call(alice, "POST", "/api/pets", { pet: petInput({ species: "dragon" }) }));
  await expectStatus("« Autre » sans l'animal refusé", 400, () =>
    call(alice, "POST", "/api/pets", { pet: petInput({ species: "other", breed: "" }) }),
  );
  await expectStatus("Naissance dans le futur refusée", 400, () =>
    call(alice, "POST", "/api/pets", { pet: petInput({ birthDate: day(5) }) }),
  );
  await expectStatus("Puce de 14 chiffres refusée", 400, () =>
    call(alice, "POST", "/api/pets", { pet: petInput({ chipNumber: "25026960812345" }) }),
  );
  await expectStatus("Notes de plus de 500 caractères refusées", 400, () =>
    call(alice, "POST", "/api/pets", { pet: petInput({ notes: "x".repeat(501) }) }),
  );
  await expectStatus("6 photos refusées", 400, () =>
    call(alice, "POST", "/api/pets", { pet: petInput(), photos: Array(6).fill(photo) }),
  );
  await expectStatus("Fichier qui n'est pas une image refusé", 400, () =>
    call(alice, "POST", "/api/pets", { pet: petInput(), photos: [{ url: "javascript:alert(1)", thumbnail: PHOTO }] }),
  );
  const draft = await expectStatus("Brouillon avec seulement un nom", 201, () =>
    call(alice, "POST", "/api/pets", { pet: { name: "Rex", species: "other" }, draft: true, photos: [] }),
  );
  check("…statut brouillon", draft?.status === "draft");
  await expectStatus("Brouillon incomplet ne peut pas devenir actif", 400, () =>
    call(alice, "PUT", `/api/pets/${draft?.id}`, { pet: { name: "Rex", species: "other" }, draft: false }),
  );
  const ours = await expectStatus("Brouillon complété (animal libre « Ours »)", 200, () =>
    call(alice, "PUT", `/api/pets/${draft?.id}`, { pet: petInput({ name: "Rex", species: "other", breed: "Ours" }), draft: false }),
  );
  check("…devient actif", ours?.status === "active");

  const milo = await expectStatus("Ajouter Milo avec 4 photos et son poids du jour", 201, () =>
    call(alice, "POST", "/api/pets", { pet: petInput(), photos: Array(4).fill(photo), weight: { day: day(), weightKg: 30 } }),
  );
  const id = milo?.id;
  check("…4 photos, dernier poids 30 kg", milo?.photos?.length === 4 && milo?.latestWeight?.kg === 30);

  console.log("\nAccès d'un autre utilisateur :");
  await expectStatus("Bob ne lit pas Milo", 403, () => call(bob, "GET", `/api/pets/${id}`));
  await expectStatus("Bob ne modifie pas Milo", 403, () => call(bob, "PATCH", `/api/pets/${id}`, { favorite: true }));
  await expectStatus("Bob ne pèse pas Milo", 403, () => call(bob, "POST", `/api/pets/${id}/weights`, { day: day(), weightKg: 1 }));
  await expectStatus("Bob ne lit pas les pesées", 403, () => call(bob, "GET", `/api/pets/${id}/weights`));
  await expectStatus("Bob n'archive pas Milo", 403, () => call(bob, "POST", `/api/pets/${id}/archive`, {}));
  check("La liste de Bob est vide", (await call(bob, "GET", "/api/pets")).data?.length === 0);
  await expectStatus("Identifiant inconnu", 404, () => call(alice, "GET", "/api/pets/000000000000000000000000"));

  console.log("\nPhotos :");
  const five = await expectStatus("5e photo acceptée", 201, () => call(alice, "POST", `/api/pets/${id}/photos`, photo));
  await expectStatus("6e photo refusée", 400, () => call(alice, "POST", `/api/pets/${id}/photos`, photo));
  const last = five?.photos?.[4]?.id;
  const covered = await expectStatus("Choisir la couverture", 200, () => call(alice, "POST", `/api/pets/${id}/photos/${last}/cover`));
  check("…elle passe en première position", covered?.photos?.[0]?.id === last);
  await expectStatus("Retirer une photo", 200, () => call(alice, "DELETE", `/api/pets/${id}/photos/${last}`));
  check("Liste : seule la couverture (miniature) est envoyée", (await call(alice, "GET", "/api/pets")).data?.find((p) => p.id === id)?.photos?.length === 1);

  console.log("\nFiche :");
  const contacts = [{ name: "Dr Martin", detail: "Vétérinaire", phone: "+216 71 000 000", emergency: true }];
  const patched = await expectStatus("Notes, contacts et favori", 200, () =>
    call(alice, "PATCH", `/api/pets/${id}`, { notes: "Nouvelle note", contacts, favorite: true }),
  );
  check("…enregistrés", patched?.notes === "Nouvelle note" && patched?.contacts?.length === 1 && patched?.favorite === true);
  await expectStatus("6 contacts refusés", 400, () => call(alice, "PATCH", `/api/pets/${id}`, { contacts: Array(6).fill(contacts[0]) }));
  await expectStatus("Champ non modifiable refusé (ownerId)", 400, () => call(alice, "PATCH", `/api/pets/${id}`, { ownerId: bob.uid }));

  console.log("\nPesées :");
  await expectStatus("Pesée en double le même jour", 409, () => call(alice, "POST", `/api/pets/${id}/weights`, { day: day(), weightKg: 31 }));
  await expectStatus("Pesée dans le futur refusée", 400, () => call(alice, "POST", `/api/pets/${id}/weights`, { day: day(5), weightKg: 31 }));
  await expectStatus("Poids de 600 kg refusé", 400, () => call(alice, "POST", `/api/pets/${id}/weights`, { day: day(-1), weightKg: 600 }));
  const weights = (await call(alice, "GET", `/api/pets/${id}/weights`)).data ?? [];
  const today = weights[0];
  const corrected = await expectStatus("Corriger le poids et la note", 200, () =>
    call(alice, "PUT", `/api/pets/${id}/weights/${today?.id}`, { weightKg: 29.5, note: "Après la balade", day: day(-10) }),
  );
  check("…la date ne change pas", corrected?.weight?.day === today?.day && corrected?.weight?.weightKg === 29.5);

  console.log("\nAlerte de poids :");
  await expectStatus("Pesée d'il y a 6 jours : 32 kg", 201, () => call(alice, "POST", `/api/pets/${id}/weights`, { day: day(-6), weightKg: 32 }));
  const alertPet = (await call(alice, "GET", `/api/pets/${id}`)).data;
  check("Perte de 7,8 % en 6 jours → alerte rapid-loss", alertPet?.weightAlert?.rule === "rapid-loss");
  await call(alice, "PUT", `/api/pets/${id}/weights/${today?.id}`, { weightKg: 29.6, note: "" });
  const db = (await mongo.connect()).db(process.env.MONGODB_DB || "petcare");
  const notes = await db.collection("notifications").countDocuments({ userId: alice.uid, type: "sante" });
  check("Une seule notification pour l'épisode (après correction)", notes === 1);
  check("Badge sur la liste", Boolean((await call(alice, "GET", "/api/pets")).data?.find((p) => p.id === id)?.weightAlert));
  const dismissed = await expectStatus("Ignorer l'alerte", 200, () => call(alice, "PATCH", `/api/pets/${id}`, { dismissAlert: true }));
  check("…bandeau masqué", dismissed?.weightAlert?.dismissed === true);

  console.log("\nArchivage :");
  await expectStatus("Archiver Milo", 200, () => call(alice, "POST", `/api/pets/${id}/archive`, { reason: "Test" }));
  const archived = (await call(alice, "GET", `/api/pets/${id}`)).data;
  check("Toujours lisible, statut archivé, plus d'alerte", archived?.status === "archived" && !archived?.weightAlert);
  await expectStatus("Archivé : modification refusée", 409, () => call(alice, "PUT", `/api/pets/${id}`, { pet: petInput(), draft: false }));
  await expectStatus("Archivé : favori refusé", 409, () => call(alice, "PATCH", `/api/pets/${id}`, { favorite: false }));
  await expectStatus("Archivé : pesée refusée", 409, () => call(alice, "POST", `/api/pets/${id}/weights`, { day: day(-2), weightKg: 30 }));
  await expectStatus("Archivé : photo refusée", 409, () => call(alice, "POST", `/api/pets/${id}/photos`, photo));
  await expectStatus("Archiver deux fois refusé", 409, () => call(alice, "POST", `/api/pets/${id}/archive`, {}));
  check("Les pesées sont conservées", (await call(alice, "GET", `/api/pets/${id}/weights`)).data?.length === 2);
  const restored = await expectStatus("Restaurer Milo", 200, () => call(alice, "POST", `/api/pets/${id}/restore`));
  check("…de nouveau actif", restored?.status === "active");
  await expectStatus("Pas de suppression d'un animal", 405, () => call(alice, "DELETE", `/api/pets/${id}`));
} catch (error) {
  console.error("\nErreur pendant le test :", error.code ?? error.message);
  failed++;
} finally {
  console.log("\nNettoyage…");
  try {
    await mongo.connect();
    const db = mongo.db(process.env.MONGODB_DB || "petcare");
    const uids = users.map((u) => u.uid);
    await db.collection("pets").deleteMany({ ownerId: { $in: uids } });
    await db.collection("petWeights").deleteMany({ ownerId: { $in: uids } });
    await db.collection("notifications").deleteMany({ $or: [{ userId: { $in: uids } }, { senderId: { $in: uids } }] });
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
