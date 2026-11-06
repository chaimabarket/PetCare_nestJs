// Teste les routes /api (profils + notifications, stockés dans MongoDB) sur le serveur lancé.
// Crée deux comptes Firebase temporaires, vérifie chaque règle d'accès, puis supprime tout.
// Lancement : npm run dev   (dans un autre terminal)   puis   npm run test:api
// Autre adresse : BASE_URL=https://... npm run test:api
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

/** Appelle l'API ; `who` = utilisateur de test ou null (visiteur). */
async function call(who, method, path, body) {
  const headers = {};
  if (who) headers.Authorization = `Bearer ${await who.user.getIdToken()}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(BASE_URL + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  return { status: response.status, data };
}

async function expectStatus(label, expected, request) {
  try {
    const { status, data } = await request();
    const ok = Array.isArray(expected) ? expected.includes(status) : status === expected;
    if (ok) {
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
  const auth = getAuth(app);
  const email = `test-${name}-${Date.now()}@example.com`;
  const { user } = await createUserWithEmailAndPassword(auth, email, "MotDePasseTest!2026");
  return { app, user, email };
}

const profile = { displayName: "Test", city: "Tunis", role: "proprietaire" };
const notification = (userId, extra = {}) => ({
  userId,
  type: "adoption",
  title: "Candidature acceptée pour Nala",
  body: "Le refuge a accepté votre candidature.",
  link: "/communaute/adoption/mes-candidatures",
  actionLabel: "Voir ma candidature",
  ...extra,
});

const users = [];
const mongo = new MongoClient(process.env.MONGODB_URI);

try {
  console.log(`Serveur : ${BASE_URL}   Projet Firebase : ${config.projectId}\n`);
  try {
    await fetch(BASE_URL);
  } catch {
    throw new Error(`serveur injoignable sur ${BASE_URL} : lancez d'abord « npm run dev ».`);
  }
  const a = await createTestUser("a");
  const b = await createTestUser("b");
  users.push(a, b);
  console.log("Comptes temporaires créés.\n");

  console.log("Profils (/api/users/me) :");
  await expectStatus("Visiteur sans jeton", 401, () => call(null, "GET", "/api/users/me"));
  const none = await expectStatus("Profil pas encore créé", 200, () => call(a, "GET", "/api/users/me"));
  check("…renvoie null", none === null);
  await expectStatus("Créer son profil avec le rôle admin", 400, () =>
    call(a, "POST", "/api/users/me", { ...profile, role: "admin" }),
  );
  await expectStatus("Créer son profil sans nom", 400, () =>
    call(a, "POST", "/api/users/me", { ...profile, displayName: "  " }),
  );
  const created = await expectStatus("Créer son profil", 201, () => call(a, "POST", "/api/users/me", profile));
  check("E-mail repris du compte Firebase", created?.email === a.email && created?.uid === a.user.uid);
  await expectStatus("Créer son profil une deuxième fois", 409, () => call(a, "POST", "/api/users/me", profile));
  await expectStatus("Créer le profil de B", 201, () => call(b, "POST", "/api/users/me", profile));
  await expectStatus("Lire son profil", 200, () => call(a, "GET", "/api/users/me"));
  const updated = await expectStatus("Modifier sa ville et sa biographie", 200, () =>
    call(a, "PATCH", "/api/users/me", { city: "Sfax", bio: "Bonjour !" }),
  );
  check("Modification enregistrée", updated?.city === "Sfax" && updated?.bio === "Bonjour !");
  await expectStatus("Se donner le rôle admin", 400, () => call(a, "PATCH", "/api/users/me", { role: "admin" }));
  await expectStatus("Changer son e-mail", 400, () => call(a, "PATCH", "/api/users/me", { email: "x@example.com" }));
  await expectStatus("Biographie de plus de 300 caractères", 400, () =>
    call(a, "PATCH", "/api/users/me", { bio: "x".repeat(301) }),
  );
  await expectStatus("Préférences d'alerte", 200, () =>
    call(a, "PATCH", "/api/users/me", {
      notificationPrefs: { appointments: false, careReminders: true, adoption: true, lostFoundAlerts: true, email: false },
    }),
  );
  const pw = await expectStatus("Date de changement du mot de passe", 200, () =>
    call(a, "PATCH", "/api/users/me", { passwordChanged: true }),
  );
  check("passwordChangedAt enregistré", Boolean(pw?.passwordChangedAt));

  console.log("\nNotifications (/api/notifications) :");
  const sent = await expectStatus("A envoie une notification à B", 201, () =>
    call(a, "POST", "/api/notifications", notification(b.user.uid)),
  );
  check("Expéditeur = A, non lue", sent?.senderId === a.user.uid && sent?.read === false);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
  await expectStatus("A programme un rappel pour B (dans 1 jour)", 201, () =>
    call(a, "POST", "/api/notifications", notification(b.user.uid, { type: "rappel", showAt: tomorrow })),
  );
  await expectStatus("Envoyer au nom de quelqu'un d'autre", 400, () =>
    call(a, "POST", "/api/notifications", notification(b.user.uid, { senderId: b.user.uid })),
  );
  await expectStatus("Envoyer une notification déjà lue", 400, () =>
    call(a, "POST", "/api/notifications", notification(b.user.uid, { read: true })),
  );
  await expectStatus("Type de notification inconnu", 400, () =>
    call(a, "POST", "/api/notifications", notification(b.user.uid, { type: "pub" })),
  );
  await expectStatus("Lien vers un autre site", 400, () =>
    call(a, "POST", "/api/notifications", notification(b.user.uid, { link: "https://exemple.com" })),
  );
  await expectStatus("Destinataire inexistant", 400, () =>
    call(a, "POST", "/api/notifications", notification("uid-inexistant")),
  );
  const listB = await expectStatus("B lit ses notifications", 200, () => call(b, "GET", "/api/notifications"));
  check("B a 2 notifications, plus récente d'abord", listB?.length === 2 && listB[0].showAt >= listB[1].showAt);
  const listA = await expectStatus("A lit ses notifications", 200, () => call(a, "GET", "/api/notifications"));
  check("A ne voit pas celles de B", listA?.length === 0);

  const id = sent?.id ?? "000000000000000000000000";
  await expectStatus("A marque comme lue la notification de B", 404, () =>
    call(a, "PATCH", `/api/notifications/${id}`, { read: true }),
  );
  await expectStatus("B modifie le titre de sa notification", 400, () =>
    call(b, "PATCH", `/api/notifications/${id}`, { title: "Modifié" }),
  );
  await expectStatus("B marque sa notification comme lue", 204, () =>
    call(b, "PATCH", `/api/notifications/${id}`, { read: true }),
  );
  await expectStatus("A « marque tout comme lu » avec les ids de B", 200, () =>
    call(a, "POST", "/api/notifications/read-all", { ids: listB?.map((n) => n.id) ?? [] }),
  );
  const afterA = await call(b, "GET", "/api/notifications");
  check("…sans effet sur les notifications de B", afterA.data?.filter((n) => !n.read).length === 1);
  const readAll = await expectStatus("B marque tout comme lu", 200, () =>
    call(b, "POST", "/api/notifications/read-all", { ids: listB?.map((n) => n.id) ?? [] }),
  );
  check("1 notification mise à jour", readAll?.updated === 1);
  await expectStatus("A supprime la notification de B", 404, () => call(a, "DELETE", `/api/notifications/${id}`));
  await expectStatus("B supprime sa notification", 204, () => call(b, "DELETE", `/api/notifications/${id}`));
  await expectStatus("Identifiant invalide", 404, () => call(b, "DELETE", "/api/notifications/pas-un-id"));
} catch (error) {
  console.error("\nErreur pendant le test :", error.code ?? error.message);
  failed++;
} finally {
  console.log("\nNettoyage…");
  try {
    await mongo.connect();
    const db = mongo.db(process.env.MONGODB_DB || "petcare");
    const uids = users.map((u) => u.user.uid);
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
