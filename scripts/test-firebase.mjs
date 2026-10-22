// Teste les règles Firestore et le flux des notifications sur le vrai projet Firebase.
// Crée deux comptes temporaires, vérifie chaque règle, puis supprime tout.
// Lancement : npm run test:firebase
import { readFileSync } from "node:fs";
import { initializeApp, deleteApp } from "firebase/app";
import { createUserWithEmailAndPassword, deleteUser, getAuth } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  setLogLevel,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()]),
);

const config = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Les refus attendus sont affichés par le test lui-même.
setLogLevel("silent");

let passed = 0;
let failed = 0;

async function expectOk(label, action) {
  try {
    await action();
    console.log(`  ✅ ${label}`);
    passed++;
  } catch (error) {
    console.log(`  ❌ ${label} — ${error.code ?? error.message}`);
    failed++;
  }
}

async function expectDenied(label, action) {
  try {
    await action();
    console.log(`  ❌ ${label} — autorisé alors qu'il devrait être refusé`);
    failed++;
  } catch (error) {
    if (error.code === "permission-denied") {
      console.log(`  ✅ ${label} (refusé)`);
      passed++;
    } else {
      console.log(`  ❌ ${label} — erreur inattendue : ${error.code ?? error.message}`);
      failed++;
    }
  }
}

async function createTestUser(name) {
  const app = initializeApp(config, name);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const email = `test-${name}-${Date.now()}@example.com`;
  const { user } = await createUserWithEmailAndPassword(auth, email, "MotDePasseTest!2026");
  return { app, auth, db, user, email };
}

function profileFor(u, role = "proprietaire") {
  return {
    uid: u.user.uid,
    email: u.email,
    displayName: `Test ${u.app.name}`,
    city: "Tunis",
    role,
    phone: "",
    bio: "",
    notificationPrefs: { appointments: true, careReminders: true, adoption: true, lostFoundAlerts: true, email: false },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function notificationFrom(sender, recipientUid, extra = {}) {
  return {
    userId: recipientUid,
    type: "adoption",
    title: "Candidature acceptée pour Nala",
    body: "Le refuge a accepté votre candidature.",
    link: "/communaute/adoption/mes-candidatures",
    actionLabel: "Voir ma candidature",
    read: false,
    senderId: sender.user.uid,
    createdAt: serverTimestamp(),
    showAt: serverTimestamp(),
    ...extra,
  };
}

const users = [];
const createdNotifications = [];

try {
  console.log(`Projet : ${config.projectId}\n`);
  const a = await createTestUser("a");
  const b = await createTestUser("b");
  users.push(a, b);
  console.log("Comptes temporaires créés.\n");

  // Avec les anciennes règles, les profils de test ne pourraient pas être supprimés ensuite.
  try {
    await getDocs(query(collection(a.db, "notifications"), where("userId", "==", a.user.uid)));
  } catch (error) {
    if (error.code !== "permission-denied") throw error;
    users.forEach((u) => (u.noProfile = true));
    throw new Error(
      "les règles publiées ne gèrent pas encore les notifications : publiez firestore.rules dans la console Firebase, puis relancez.",
    );
  }

  console.log("Profils (users) :");
  await expectDenied("Créer son profil avec le rôle admin", () =>
    setDoc(doc(a.db, "users", a.user.uid), profileFor(a, "admin")),
  );
  await expectOk("Créer son profil", () => setDoc(doc(a.db, "users", a.user.uid), profileFor(a)));
  await expectOk("Créer le profil de B", () => setDoc(doc(b.db, "users", b.user.uid), profileFor(b)));
  await expectDenied("Créer le profil d'un autre utilisateur", () =>
    setDoc(doc(a.db, "users", "uid-inexistant"), { ...profileFor(a), uid: "uid-inexistant" }),
  );
  await expectOk("Lire son profil", () => getDoc(doc(a.db, "users", a.user.uid)));
  await expectDenied("Lire le profil de quelqu'un d'autre", () => getDoc(doc(a.db, "users", b.user.uid)));
  await expectOk("Modifier sa ville et sa biographie", () =>
    updateDoc(doc(a.db, "users", a.user.uid), { city: "Sfax", bio: "Bonjour !", updatedAt: serverTimestamp() }),
  );
  await expectDenied("Se donner le rôle admin", () => updateDoc(doc(a.db, "users", a.user.uid), { role: "admin" }));
  await expectDenied("Biographie de plus de 300 caractères", () =>
    updateDoc(doc(a.db, "users", a.user.uid), { bio: "x".repeat(301) }),
  );
  await expectDenied("Modifier le profil de quelqu'un d'autre", () =>
    updateDoc(doc(a.db, "users", b.user.uid), { city: "Piratage" }),
  );

  console.log("\nNotifications :");
  let notifId;
  await expectOk("A envoie une notification à B", async () => {
    const ref = await addDoc(collection(a.db, "notifications"), notificationFrom(a, b.user.uid));
    notifId = ref.id;
    createdNotifications.push({ id: ref.id, owner: b });
  });
  await expectOk("A programme un rappel pour B (dans 1 jour)", async () => {
    const ref = await addDoc(
      collection(a.db, "notifications"),
      notificationFrom(a, b.user.uid, {
        type: "rappel",
        title: "Rappel vaccin Milo",
        showAt: Timestamp.fromDate(new Date(Date.now() + 86_400_000)),
      }),
    );
    createdNotifications.push({ id: ref.id, owner: b });
  });
  await expectDenied("Envoyer au nom de quelqu'un d'autre", () =>
    addDoc(collection(a.db, "notifications"), { ...notificationFrom(a, b.user.uid), senderId: b.user.uid }),
  );
  await expectDenied("Envoyer une notification déjà lue", () =>
    addDoc(collection(a.db, "notifications"), notificationFrom(a, b.user.uid, { read: true })),
  );
  await expectDenied("Type de notification inconnu", () =>
    addDoc(collection(a.db, "notifications"), notificationFrom(a, b.user.uid, { type: "pub" })),
  );
  await expectDenied("Champ non autorisé", () =>
    addDoc(collection(a.db, "notifications"), notificationFrom(a, b.user.uid, { pirate: true })),
  );
  if (!notifId) {
    throw new Error(
      "impossible de créer une notification : publiez firestore.rules dans la console Firebase, puis relancez.",
    );
  }
  await expectOk("B lit ses notifications (2 attendues)", async () => {
    const snapshot = await getDocs(query(collection(b.db, "notifications"), where("userId", "==", b.user.uid)));
    if (snapshot.size !== 2) throw new Error(`${snapshot.size} notification(s) trouvée(s)`);
  });
  await expectDenied("A lit les notifications de B", () =>
    getDocs(query(collection(a.db, "notifications"), where("userId", "==", b.user.uid))),
  );
  await expectDenied("A lit une notification de B par son id", () => getDoc(doc(a.db, "notifications", notifId)));
  await expectDenied("A marque comme lue la notification de B", () =>
    updateDoc(doc(a.db, "notifications", notifId), { read: true }),
  );
  await expectOk("B marque sa notification comme lue", () =>
    updateDoc(doc(b.db, "notifications", notifId), { read: true }),
  );
  await expectDenied("B modifie le titre de sa notification", () =>
    updateDoc(doc(b.db, "notifications", notifId), { title: "Modifié" }),
  );
  await expectDenied("A supprime la notification de B", () => deleteDoc(doc(a.db, "notifications", notifId)));
  await expectOk("B supprime sa notification", async () => {
    await deleteDoc(doc(b.db, "notifications", notifId));
    createdNotifications.splice(createdNotifications.findIndex((n) => n.id === notifId), 1);
  });
} catch (error) {
  console.error("\nErreur pendant le test :", error.code ?? error.message);
  failed++;
} finally {
  console.log("\nNettoyage…");
  for (const n of createdNotifications) {
    await deleteDoc(doc(n.owner.db, "notifications", n.id)).catch((e) => console.log("  notification :", e.code));
  }
  for (const u of users) {
    if (!u.noProfile) {
      await deleteDoc(doc(u.db, "users", u.user.uid)).catch((e) => console.log("  profil :", e.code));
    }
    await deleteUser(u.user).catch((e) => console.log("  compte :", e.code));
    await deleteApp(u.app);
  }
  console.log(`\nRésultat : ${passed} réussi(s), ${failed} échoué(s)`);
  process.exit(failed ? 1 : 0);
}
