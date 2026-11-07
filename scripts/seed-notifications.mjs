// Ajoute les notifications de démonstration à un utilisateur, directement dans MongoDB.
// Lancement : npm run seed:notifications -- <UID>
// (UID : console Firebase > Authentication > Utilisateurs > colonne « UID de l'utilisateur »)
//
// L'expéditeur est « system » : ce script écrit directement dans la base, sans passer par l'API.
// Les notifications arrivent toutes « non lues ».
import { readFileSync } from "node:fs";
import { MongoClient } from "mongodb";

const uid = process.argv[2];
if (!uid || !/^[A-Za-z0-9]{20,40}$/.test(uid)) {
  console.error("Usage : npm run seed:notifications -- <UID de l'utilisateur>");
  process.exit(1);
}

const demo = JSON.parse(readFileSync(new URL("./demo-notifications.json", import.meta.url), "utf8"));
const client = new MongoClient(process.env.MONGODB_URI);

let created = 0;
try {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "petcare");
  if (!(await db.collection("users").countDocuments({ _id: uid }, { limit: 1 }))) {
    console.log(`  ⚠️  Aucun profil MongoDB pour ${uid} : les notifications sont ajoutées quand même.`);
  }
  const now = Date.now();
  for (const { minutesAgo, ...notification } of demo) {
    await db.collection("notifications").insertOne({
      ...notification,
      userId: uid,
      read: false,
      senderId: "system",
      createdAt: new Date(),
      showAt: new Date(now - minutesAgo * 60_000),
    });
    created++;
    console.log(`  ✅ ${notification.title}${minutesAgo < 0 ? ` (programmée dans ${-minutesAgo} min)` : ""}`);
  }
} catch (error) {
  console.error(`  ❌ ${error.message}`);
} finally {
  await client.close();
  console.log(`\n${created} notification(s) ajoutée(s) pour ${uid}.`);
  process.exit(created === demo.length ? 0 : 1);
}
