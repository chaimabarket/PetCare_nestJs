// Teste les routes /api/adoption (règles d'accès et cycle complet d'une adoption) sur le serveur lancé.
// Crée des comptes Firebase temporaires, vérifie chaque règle, puis supprime tout.
// Lancement : npm run dev   (dans un autre terminal)   puis   npm run test:adoption
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
  const email = `test-adoption-${name}-${Date.now()}@example.com`;
  const { user } = await createUserWithEmailAndPassword(getAuth(app), email, "MotDePasseTest!2026");
  const u = { app, user, uid: user.uid, name };
  const res = await call(u, "POST", "/api/users/me", { displayName: `Test ${name}`, city: "Tunis", role });
  if (res.status !== 201) throw new Error(`profil ${name} : ${res.status} ${res.data?.error ?? ""}`);
  return u;
}

const input = (extra = {}) => ({
  name: "Nala",
  title: "Douce chatte cherche famille",
  species: "chat",
  breed: "Européen",
  sex: "femelle",
  ageGroup: "adulte",
  ageLabel: "3 ans",
  size: "moyen",
  city: "Tunis",
  photos: [PHOTO, PHOTO],
  thumbnail: PHOTO,
  story: "Nala a été trouvée dans un jardin, elle est très câline et adore les siestes au soleil.",
  needs: "",
  conditions: "",
  personality: ["calme", "affectueux"],
  compatibility: { kids: true, cats: true, dogs: false, garden: false },
  energy: "faible",
  aloneHours: 6,
  adoptMe: false,
  ...extra,
});

const answers = (city = "Tunis") => ({
  housing: { type: "appartement", outdoor: true, tenure: "proprietaire", landlordOk: false, city },
  household: { adults: 2, children: 1, childAges: ["6-12"], cats: 0, dogs: 0, others: 0, allergies: false },
  lifestyle: { aloneHours: 4, activity: "modere", experience: "un-peu", motivation: "Nous avons un grand appartement calme et beaucoup d'amour à donner." },
});

const app = (id, action) => [`/api/adoption/applications/${id}`, { action }];
const users = [];
const mongo = new MongoClient(process.env.MONGODB_URI);

try {
  console.log(`Serveur : ${BASE_URL}\n`);
  try {
    await fetch(BASE_URL);
  } catch {
    throw new Error(`serveur injoignable sur ${BASE_URL} : lancez d'abord « npm run dev ».`);
  }
  const refuge = await createTestUser("refuge", "refuge");
  const bob = await createTestUser("bob", "proprietaire");
  const dina = await createTestUser("dina", "proprietaire");
  const presta = await createTestUser("presta", "prestataire");
  users.push(refuge, bob, dina, presta);
  console.log("Comptes temporaires créés (refuge, bob, dina, presta).\n");

  console.log("Annonces :");
  await expectStatus("Visiteur ne peut pas publier", 401, () => call(null, "POST", "/api/adoption/listings", { input: input(), publish: true }));
  await expectStatus("Un prestataire ne peut pas publier", 403, () => call(presta, "POST", "/api/adoption/listings", { input: input(), publish: true }));
  await expectStatus("Publication incomplète refusée (sans photo)", 400, () =>
    call(refuge, "POST", "/api/adoption/listings", { input: input({ photos: [] }), publish: true }),
  );
  await expectStatus("Photo qui n'est pas une image refusée", 400, () =>
    call(refuge, "POST", "/api/adoption/listings", { input: input({ photos: ["javascript:alert(1)"] }), publish: false }),
  );
  await expectStatus("Champ non autorisé refusé (ownerId)", 400, () =>
    call(refuge, "POST", "/api/adoption/listings", { input: { ...input(), ownerId: bob.uid }, publish: false }),
  );
  const draft = await expectStatus("Enregistrer un brouillon", 201, () =>
    call(refuge, "POST", "/api/adoption/listings", { input: input({ story: "" }), publish: false }),
  );
  const id = draft?.id;
  check("Statut brouillon, auteur = refuge", draft?.status === "brouillon" && draft?.ownerId === refuge.uid);
  check("Un visiteur ne voit pas le brouillon", (await call(null, "GET", `/api/adoption/listings/${id}`)).data === null);
  check("Un autre utilisateur ne voit pas le brouillon", (await call(bob, "GET", `/api/adoption/listings/${id}`)).data === null);
  check("L'auteur voit son brouillon", (await call(refuge, "GET", `/api/adoption/listings/${id}`)).data?.id === id);
  await expectStatus("Un autre utilisateur ne peut pas modifier l'annonce", 404, () =>
    call(bob, "PATCH", `/api/adoption/listings/${id}`, { action: "update", input: input(), publish: true }),
  );
  await expectStatus("Publier le brouillon", 200, () =>
    call(refuge, "PATCH", `/api/adoption/listings/${id}`, { action: "update", input: input(), publish: true }),
  );
  const feed = (await call(null, "GET", "/api/adoption/listings")).data;
  const inFeed = feed?.find((l) => l.id === id);
  check("Annonce visible par les visiteurs dans le fil", Boolean(inFeed) && inFeed.status === "disponible");
  check("Le fil n'envoie que la photo de couverture", inFeed?.photos.length === 1);
  check("La fiche envoie toutes les photos", (await call(null, "GET", `/api/adoption/listings/${id}`)).data?.photos.length === 2);
  check("Identifiant invalide → null", (await call(null, "GET", "/api/adoption/listings/pas-un-id")).data === null);
  await expectStatus("Supprimer une annonce en ligne refusé", 400, () => call(refuge, "DELETE", `/api/adoption/listings/${id}`));

  console.log("\nCandidatures :");
  await expectStatus("Candidater à sa propre annonce refusé", 400, () =>
    call(refuge, "POST", "/api/adoption/applications", { listingId: id, answers: answers() }),
  );
  await expectStatus("Motivation trop courte refusée", 400, () =>
    call(bob, "POST", "/api/adoption/applications", {
      listingId: id,
      answers: { ...answers(), lifestyle: { ...answers().lifestyle, motivation: "Court" } },
    }),
  );
  const bobApp = await expectStatus("Bob candidate", 201, () => call(bob, "POST", "/api/adoption/applications", { listingId: id, answers: answers() }));
  await expectStatus("Bob ne peut pas candidater deux fois", 409, () =>
    call(bob, "POST", "/api/adoption/applications", { listingId: id, answers: answers() }),
  );
  const dinaApp = await expectStatus("Dina candidate", 201, () => call(dina, "POST", "/api/adoption/applications", { listingId: id, answers: answers("Sfax") }));
  const prestaApp = await expectStatus("Presta candidate", 201, () => call(presta, "POST", "/api/adoption/applications", { listingId: id, answers: answers() }));
  check("Candidature enregistrée au nom du candidat", bobApp?.applicantId === bob.uid && bobApp?.ownerId === refuge.uid);
  const notifRefuge = (await call(refuge, "GET", "/api/notifications")).data ?? [];
  check("Le refuge est notifié des 3 candidatures", notifRefuge.filter((n) => n.title === "Nouvelle candidature pour Nala").length === 3);
  await expectStatus("Bob ne voit pas les candidatures reçues par le refuge", 404, () =>
    call(bob, "GET", `/api/adoption/applications?scope=received&listingId=${id}`),
  );
  check("Bob voit sa candidature", (await call(bob, "GET", `/api/adoption/applications?scope=mine&listingId=${id}`)).data?.length === 1);
  check("Le refuge voit les 3 candidatures", (await call(refuge, "GET", `/api/adoption/applications?scope=received&listingId=${id}`)).data?.length === 3);
  await expectStatus("Bob ne peut pas accepter sa propre candidature", 403, () => call(bob, "PATCH", ...app(bobApp?.id, "accept")));
  await expectStatus("Dina ne peut pas agir sur la candidature de Bob", 404, () => call(dina, "PATCH", ...app(bobApp?.id, "withdraw")));
  const reviewed = await expectStatus("Le refuge ouvre la candidature de Bob", 200, () => call(refuge, "PATCH", ...app(bobApp?.id, "review")));
  check("Statut « en étude »", reviewed?.status === "en-etude");
  await expectStatus("Presta retire sa candidature", 200, () => call(presta, "PATCH", ...app(prestaApp?.id, "withdraw")));
  await expectStatus("Retirer deux fois refusé", 400, () => call(presta, "PATCH", ...app(prestaApp?.id, "withdraw")));
  await expectStatus("Le refuge accepte Bob", 200, () => call(refuge, "PATCH", ...app(bobApp?.id, "accept")));
  check("L'animal est réservé", (await call(null, "GET", `/api/adoption/listings/${id}`)).data?.status === "reservee");
  await expectStatus("Accepter une deuxième candidature refusé", 400, () => call(refuge, "PATCH", ...app(dinaApp?.id, "accept")));
  await expectStatus("Candidater à un animal réservé refusé", 400, () =>
    call(presta, "POST", "/api/adoption/applications", { listingId: id, answers: answers() }),
  );
  await expectStatus("Annuler l'acceptation", 200, () => call(refuge, "PATCH", ...app(bobApp?.id, "cancel-acceptance")));
  check("L'animal redevient disponible", (await call(null, "GET", `/api/adoption/listings/${id}`)).data?.status === "disponible");
  await expectStatus("Confirmer sans acceptation refusé", 400, () => call(refuge, "PATCH", ...app(bobApp?.id, "confirm-adoption")));
  await expectStatus("Le refuge accepte de nouveau Bob", 200, () => call(refuge, "PATCH", ...app(bobApp?.id, "accept")));
  await expectStatus("Le refuge confirme l'adoption", 200, () => call(refuge, "PATCH", ...app(bobApp?.id, "confirm-adoption")));
  const adopted = (await call(null, "GET", `/api/adoption/listings/${id}`)).data;
  check("Annonce adoptée par Bob", adopted?.status === "adoptee" && adopted?.adopterId === bob.uid);
  const dinaAfter = (await call(dina, "GET", `/api/adoption/applications?scope=mine&listingId=${id}`)).data?.[0];
  check("La candidature de Dina est refusée automatiquement", dinaAfter?.status === "refusee");
  const notifDina = (await call(dina, "GET", "/api/notifications")).data ?? [];
  check("Dina est notifiée", notifDina.some((n) => n.title === "Nala a été adopté(e)"));
  await expectStatus("Une annonce adoptée ne peut plus être modifiée", 400, () =>
    call(refuge, "PATCH", `/api/adoption/listings/${id}`, { action: "update", input: input() }),
  );

  console.log("\nHappy Tails :");
  await expectStatus("Seul l'adoptant peut publier l'histoire", 403, () =>
    call(dina, "POST", "/api/adoption/happy-tails", { listingId: id, afterPhoto: PHOTO, story: "Une histoire assez longue pour être acceptée." }),
  );
  await expectStatus("Bob publie son histoire", 201, () =>
    call(bob, "POST", "/api/adoption/happy-tails", { listingId: id, afterPhoto: PHOTO, story: "Nala dort sur le canapé tous les jours, elle est très heureuse." }),
  );
  await expectStatus("Une seule histoire par adoption", 409, () =>
    call(bob, "POST", "/api/adoption/happy-tails", { listingId: id, afterPhoto: PHOTO, story: "Nala dort sur le canapé tous les jours, elle est très heureuse." }),
  );
  check("Histoire visible par les visiteurs", (await call(null, "GET", `/api/adoption/happy-tails/${id}`)).data?.adopterId === bob.uid);
  await expectStatus("Visiteur ne peut pas aimer", 401, () => call(null, "PUT", `/api/adoption/happy-tails/${id}/like`));
  await expectStatus("Dina aime l'histoire", 204, () => call(dina, "PUT", `/api/adoption/happy-tails/${id}/like`));
  await expectStatus("Dina aime une deuxième fois (sans doublon)", 204, () => call(dina, "PUT", `/api/adoption/happy-tails/${id}/like`));
  check("Un seul cœur de Dina", (await call(null, "GET", `/api/adoption/happy-tails/${id}`)).data?.likedBy.length === 1);
  await expectStatus("Dina retire son cœur", 204, () => call(dina, "DELETE", `/api/adoption/happy-tails/${id}/like`));
  check("Statistique publique : au moins 1 adoption", (await call(null, "GET", "/api/adoption/stats")).data?.adopted >= 1);

  console.log("\nFavoris, signalements, archivage :");
  const second = await expectStatus("Le refuge publie une 2e annonce", 201, () =>
    call(refuge, "POST", "/api/adoption/listings", { input: input({ name: "Rex", species: "chien" }), publish: true }),
  );
  await expectStatus("Dina ajoute la 2e annonce en favori", 204, () => call(dina, "PUT", `/api/adoption/favorites/${second?.id}`));
  check("Favori listé", (await call(dina, "GET", "/api/adoption/favorites")).data?.includes(second?.id));
  check("Favori avec l'annonce", (await call(dina, "GET", "/api/adoption/favorites?include=listings")).data?.[0]?.name === "Rex");
  await expectStatus("Dina candidate pour Rex", 201, () => call(dina, "POST", "/api/adoption/applications", { listingId: second?.id, answers: answers() }));
  await expectStatus("Signalement visiteur refusé", 401, () =>
    call(null, "POST", "/api/adoption/reports", { targetType: "annonce", targetId: second?.id, reason: "Arnaque", comment: "" }),
  );
  await expectStatus("Motif de signalement inconnu refusé", 400, () =>
    call(dina, "POST", "/api/adoption/reports", { targetType: "annonce", targetId: second?.id, reason: "Pub", comment: "" }),
  );
  await expectStatus("Signaler une annonce", 201, () =>
    call(dina, "POST", "/api/adoption/reports", { targetType: "annonce", targetId: second?.id, reason: "Doublon", comment: "Test" }),
  );
  await expectStatus("Le refuge archive Rex", 200, () => call(refuge, "PATCH", `/api/adoption/listings/${second?.id}`, { action: "archive" }));
  check("La candidature de Dina est close", (await call(dina, "GET", `/api/adoption/applications?scope=mine&listingId=${second?.id}`)).data?.[0]?.status === "refusee");
  check("Annonce archivée invisible pour les visiteurs", (await call(null, "GET", `/api/adoption/listings/${second?.id}`)).data === null);
  check("…et retirée des favoris de Dina", (await call(dina, "GET", "/api/adoption/favorites?include=listings")).data?.length === 0);
  await expectStatus("Remettre en ligne", 200, () => call(refuge, "PATCH", `/api/adoption/listings/${second?.id}`, { action: "republish" }));
  const draft2 = await call(refuge, "POST", "/api/adoption/listings", { input: input({ name: "Brouillon" }), publish: false });
  await expectStatus("Supprimer un brouillon", 204, () => call(refuge, "DELETE", `/api/adoption/listings/${draft2.data?.id}`));
  check("Mes annonces : 2 annonces", (await call(refuge, "GET", "/api/adoption/listings/mine")).data?.length === 2);
} catch (error) {
  console.error("\nErreur pendant le test :", error.code ?? error.message);
  failed++;
} finally {
  console.log("\nNettoyage…");
  try {
    await mongo.connect();
    const db = mongo.db(process.env.MONGODB_DB || "petcare");
    const uids = users.map((u) => u.uid);
    await db.collection("adoptionListings").deleteMany({ ownerId: { $in: uids } });
    await db.collection("adoptionApplications").deleteMany({ $or: [{ ownerId: { $in: uids } }, { applicantId: { $in: uids } }] });
    await db.collection("adoptionFavorites").deleteMany({ userId: { $in: uids } });
    await db.collection("happyTails").deleteMany({ adopterId: { $in: uids } });
    await db.collection("adoptionReports").deleteMany({ reporterId: { $in: uids } });
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
