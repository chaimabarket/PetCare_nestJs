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
  await expectStatus("Restaurer un animal actif refusé", 409, () => call(alice, "POST", `/api/pets/${id}/restore`));

  console.log("\nCas limites de l'API :");
  await expectStatus("Visiteur ne lit pas une fiche", 401, () => call(null, "GET", `/api/pets/${id}`));
  await expectStatus("Identifiant mal formé", 404, () => call(alice, "GET", "/api/pets/pas-un-id"));
  await expectStatus("Retirer une photo inconnue", 404, () => call(alice, "DELETE", `/api/pets/${id}/photos/000000000000000000000000`));
  await expectStatus("Couverture inconnue", 404, () => call(alice, "POST", `/api/pets/${id}/photos/000000000000000000000000/cover`));
  await expectStatus("Corriger une pesée inconnue", 404, () =>
    call(alice, "PUT", `/api/pets/${id}/weights/000000000000000000000000`, { weightKg: 3 }),
  );
  await expectStatus("Téléphone de contact invalide", 400, () =>
    call(alice, "PATCH", `/api/pets/${id}`, { contacts: [{ name: "Voisin", phone: "abc" }] }),
  );
  await expectStatus("Notes de plus de 500 caractères (PATCH)", 400, () => call(alice, "PATCH", `/api/pets/${id}`, { notes: "x".repeat(501) }));
  await expectStatus("PATCH vide refusé", 400, () => call(alice, "PATCH", `/api/pets/${id}`, {}));
  await expectStatus("Pesée avant la naissance refusée", 400, () =>
    call(alice, "POST", `/api/pets/${id}/weights`, { day: "2019-01-01", weightKg: 3 }),
  );
  const photoIds = (await call(alice, "GET", `/api/pets/${id}`)).data?.photos?.map((p) => p.id) ?? [];
  await expectStatus("Ordre des photos invalide", 400, () =>
    call(alice, "PUT", `/api/pets/${id}`, { pet: petInput(), photoOrder: [photoIds[0]] }),
  );
  const reordered = await expectStatus("Réordonner les photos (PUT)", 200, () =>
    call(alice, "PUT", `/api/pets/${id}`, { pet: petInput(), photoOrder: [...photoIds].reverse() }),
  );
  check("…nouvel ordre enregistré", reordered?.photos?.[0]?.id === photoIds[photoIds.length - 1]);
  const upsert = await expectStatus("Pesée du jour depuis le formulaire (corrige celle du jour)", 200, () =>
    call(alice, "PUT", `/api/pets/${id}`, { pet: petInput(), weight: { day: day(), weightKg: 29.9 } }),
  );
  check("…pas de doublon, poids mis à jour", upsert?.latestWeight?.kg === 29.9);
  check("Liste : dernier poids et couverture", (await call(alice, "GET", "/api/pets")).data?.find((p) => p.id === id)?.latestWeight?.kg === 29.9);

  console.log("\nAlerte de poids — toutes les règles (côté serveur) :");
  /** Crée un animal et ses pesées [jours avant aujourd'hui, kg] ; renvoie la fiche après la dernière pesée. */
  async function scenario(name, points, extra = {}) {
    const pet = (await call(alice, "POST", "/api/pets", { pet: petInput({ name, chipNumber: "", ...extra }) })).data;
    for (const [daysAgo, weightKg] of points) {
      const res = await call(alice, "POST", `/api/pets/${pet.id}/weights`, { day: day(-daysAgo), weightKg });
      if (res.status !== 201) throw new Error(`${name} : pesée refusée (${res.status} ${res.data?.error ?? ""})`);
    }
    return (await call(alice, "GET", `/api/pets/${pet.id}`)).data;
  }
  const notificationsFor = async (petId) =>
    db.collection("notifications").countDocuments({ userId: alice.uid, type: "sante", link: `/animaux/${petId}` });

  const slow = await scenario("Lent", [[80, 10], [50, 9.6], [20, 9.2], [0, 8.9]]);
  check("Perte lente (−11 % en 90 j) → loss-10", slow?.weightAlert?.rule === "loss-10");
  const extremeCase = await scenario("Extreme", [[3, 10], [0, 6.5]]);
  check("Variation extrême (−35 % en 3 j) → extreme", extremeCase?.weightAlert?.rule === "extreme");
  const rabbit = await scenario("Lapin", [[5, 2], [0, 1.93]], { species: "rabbit", breed: "Bélier nain" });
  check("Petit animal (lapin, −3,5 % en 5 j) → rapid-loss", rabbit?.weightAlert?.rule === "rapid-loss");
  const dog = await scenario("Chien", [[5, 20], [0, 19.3]]);
  check("Même écart pour un chien → pas d'alerte", !dog?.weightAlert);
  await expectStatus("Ignorer sans alerte en cours", 409, () => call(alice, "PATCH", `/api/pets/${dog?.id}`, { dismissAlert: true }));
  check("Milo restauré : son alerte (pesées toujours en baisse) est recalculée", (await call(alice, "GET", `/api/pets/${id}`)).data?.weightAlert?.rule === "rapid-loss");
  const puppy = await scenario("Chiot", [[60, 5], [0, 7]], { birthDate: day(-200) });
  check("Croissance (chiot de 6 mois, +40 %) → pas d'alerte", !puppy?.weightAlert);
  const gain = await scenario("Gourmand", [[60, 10], [0, 12.2]]);
  check("Adulte +22 % en 60 j → gain-20", gain?.weightAlert?.rule === "gain-20");
  const gain10 = await scenario("Gourmet", [[60, 10], [0, 11.1]]);
  check("Adulte +11 % en 60 j → gain-10 (à surveiller)", gain10?.weightAlert?.rule === "gain-10" && gain10?.weightAlert?.level === "watch");
  const back = await scenario("Retour", [[80, 10], [40, 8.8], [0, 10]]);
  check("Retour au poids habituel → pas d'alerte", !back?.weightAlert);
  const single = await scenario("Unique", [[0, 10]]);
  check("Une seule pesée → pas d'alerte", !single?.weightAlert);
  const old = await scenario("Ancien", [[40, 20], [31, 15]]);
  check("Dernière pesée de plus de 30 jours → pas d'alerte", !old?.weightAlert);

  const worse = await scenario("Aggrave", [[25, 10], [1, 9.4]]);
  check("Perte de 6 % en 30 j → loss-5", worse?.weightAlert?.rule === "loss-5");
  check("…1 notification", (await notificationsFor(worse?.id)) === 1);
  await call(alice, "POST", `/api/pets/${worse?.id}/weights`, { day: day(), weightKg: 8.9 });
  const worse2 = (await call(alice, "GET", `/api/pets/${worse?.id}`)).data;
  check("L'alerte s'aggrave (−11 %) → loss-10", worse2?.weightAlert?.rule === "loss-10");
  check("…nouvelle notification (2 au total)", (await notificationsFor(worse?.id)) === 2);
  await call(alice, "POST", `/api/pets/${worse?.id}/weights`, { day: day(-2), weightKg: 9.5 });
  check("Pesée qui ne change pas l'épisode → pas de doublon", (await notificationsFor(worse?.id)) === 2);

  const slowWeights = (await call(alice, "GET", `/api/pets/${slow?.id}/weights`)).data ?? [];
  await expectStatus("Supprimer la dernière pesée", 204, () => call(alice, "DELETE", `/api/pets/${slow?.id}/weights/${slowWeights[0]?.id}`));
  check("…l'alerte est recalculée (plus d'alerte)", !(await call(alice, "GET", `/api/pets/${slow?.id}`)).data?.weightAlert);
  await expectStatus("Archiver un animal en alerte", 200, () => call(alice, "POST", `/api/pets/${gain?.id}/archive`, {}));
  check("…plus d'analyse pour un animal archivé", !(await call(alice, "GET", `/api/pets/${gain?.id}`)).data?.weightAlert);
  const listed = (await call(alice, "GET", "/api/pets")).data ?? [];
  check("Liste : actifs et archivés, badge d'alerte", listed.some((p) => p.status === "archived") && listed.some((p) => p.weightAlert?.rule === "extreme"));
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
