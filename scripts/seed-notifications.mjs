// Ajoute les notifications de démonstration à un utilisateur, directement dans Firestore.
// Lancement : npm run seed:notifications -- <UID>
// (UID : console Firebase > Authentication > Utilisateurs > colonne « UID de l'utilisateur »)
//
// Un compte expéditeur temporaire « Système PetCare » est créé puis supprimé : les règles
// autorisent tout utilisateur connecté à notifier quelqu'un d'autre en son propre nom.
// Les notifications arrivent toutes « non lues » : seul le destinataire peut les marquer lues.
import { readFileSync } from "node:fs";
import { deleteApp, initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, deleteUser, getAuth } from "firebase/auth";
import { addDoc, collection, getFirestore, serverTimestamp, setLogLevel, Timestamp } from "firebase/firestore";

const uid = process.argv[2];
if (!uid || !/^[A-Za-z0-9]{20,40}$/.test(uid)) {
  console.error("Usage : npm run seed:notifications -- <UID de l'utilisateur>");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()]),
);
const demo = JSON.parse(readFileSync(new URL("./demo-notifications.json", import.meta.url), "utf8"));

setLogLevel("silent");
const app = initializeApp({
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
});
const auth = getAuth(app);
const db = getFirestore(app);

let sender;
let created = 0;
try {
  ({ user: sender } = await createUserWithEmailAndPassword(
    auth,
    `systeme-${Date.now()}@example.com`,
    `Seed-${crypto.randomUUID()}`,
  ));
  const now = Date.now();
  for (const { minutesAgo, ...notification } of demo) {
    await addDoc(collection(db, "notifications"), {
      ...notification,
      userId: uid,
      read: false,
      senderId: sender.uid,
      createdAt: serverTimestamp(),
      showAt: Timestamp.fromDate(new Date(now - minutesAgo * 60_000)),
    });
    created++;
    console.log(`  ✅ ${notification.title}${minutesAgo < 0 ? ` (programmée dans ${-minutesAgo} min)` : ""}`);
  }
} catch (error) {
  console.error(`  ❌ ${error.code ?? error.message}`);
} finally {
  if (sender) await deleteUser(sender).catch((e) => console.error("Compte temporaire non supprimé :", e.code));
  await deleteApp(app);
  console.log(`\n${created} notification(s) ajoutée(s) pour ${uid}.`);
  process.exit(created === demo.length ? 0 : 1);
}
