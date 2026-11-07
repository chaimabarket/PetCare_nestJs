// Données de démonstration : comptes, animaux, adoption, happy tails, carnets de santé, rendez-vous et rappels.
// Relançable : les comptes démo sont réutilisés et toutes leurs données MongoDB sont recréées
// (les dates sont calculées à partir d'aujourd'hui : relancez le script la veille d'une démo).
// Lancement : npm run seed:demo        (aucun serveur nécessaire)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deleteApp, initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { MongoClient, ObjectId } from "mongodb";
import sharp from "sharp";

const PASSWORD = "DemoPetCare!2026";
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
if (!process.env.MONGODB_URI || !config.apiKey) throw new Error("Variables manquantes : lancez via « npm run seed:demo » (.env.local).");

// ---------------------------------------------------------------------------
// Comptes
// ---------------------------------------------------------------------------

const PEOPLE = {
  lina: {
    email: "lina.demo@example.com", displayName: "Lina Ben Salah", role: "proprietaire", city: "Tunis",
    phone: "+216 22 345 678", bio: "Maman de Rocky et Mimi. Bénévole au refuge le week-end.",
  },
  youssef: {
    email: "youssef.demo@example.com", displayName: "Youssef Gharbi", role: "proprietaire", city: "La Marsa",
    phone: "+216 98 112 233", bio: "Maison avec jardin, deux enfants et beaucoup d'amour à donner.",
  },
  amira: {
    email: "amira.demo@example.com", displayName: "Amira Jlassi", role: "proprietaire", city: "Ariana",
    phone: "+216 55 667 788", bio: "Étudiante, j'ai déjà deux chats.",
  },
  karim: {
    email: "karim.demo@example.com", displayName: "Karim Mansour", role: "proprietaire", city: "Sousse",
    phone: "+216 23 456 789", bio: "",
  },
  refuge: {
    email: "refuge.demo@example.com", displayName: "Refuge Les Amis des Bêtes", role: "refuge", city: "Tunis",
    phone: "+216 71 234 567", bio: "Refuge associatif : chats et chiens stérilisés, vaccinés et pucés avant adoption.",
  },
  vet: {
    email: "vet.demo@example.com", displayName: "Dr Sami Trabelsi – Clinique Vétérinaire El Menzah", role: "prestataire",
    city: "Tunis", phone: "+216 71 888 999", bio: "Vétérinaire : consultations, vaccins, chirurgie. Urgences 7j/7.",
    address: "12 rue Ibn Khaldoun, El Menzah 6, Tunis",
  },
  vet2: {
    email: "vet2.demo@example.com", displayName: "Dr Ines Hammami – Cabinet Vétérinaire du Lac", role: "prestataire",
    city: "Tunis", phone: "+216 71 965 432", bio: "Médecine féline et NAC.", address: "Rue du Lac Biwa, Les Berges du Lac, Tunis",
  },
  groomer: {
    email: "toilettage.demo@example.com", displayName: "Pattes Douces – Toilettage", role: "prestataire", city: "La Marsa",
    phone: "+216 29 000 111", bio: "Toilettage chiens et chats, bain, coupe, griffes.", address: "45 avenue Habib Bourguiba, La Marsa",
  },
  shop: {
    email: "animalerie.demo@example.com", displayName: "Animalerie PetShop Ennasr", role: "prestataire", city: "Ariana",
    phone: "+216 70 123 456", bio: "Alimentation, accessoires, conseils. Livraison sur Tunis.", address: "Centre commercial Ennasr 2, Ariana",
  },
  sitter: {
    email: "garde.demo@example.com", displayName: "Nour – Pet-sitting à domicile", role: "prestataire", city: "Tunis",
    phone: "+216 50 222 333", bio: "Garde et promenades à domicile.", address: "Tunis et banlieue nord",
  },
};

async function account(key) {
  const person = PEOPLE[key];
  const app = initializeApp(config, `demo-${key}`);
  const auth = getAuth(app);
  let user;
  try {
    ({ user } = await signInWithEmailAndPassword(auth, person.email, PASSWORD));
  } catch {
    ({ user } = await createUserWithEmailAndPassword(auth, person.email, PASSWORD));
  }
  await deleteApp(app);
  return { ...person, uid: user.uid };
}

// ---------------------------------------------------------------------------
// Photos (scripts/demo-assets) et dates
// ---------------------------------------------------------------------------

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), "demo-assets");
const photo = async (name, { size = 640, dim = false } = {}) => {
  let img = sharp(path.join(ASSETS, `${name}.jpg`)).resize(size, size, { fit: "cover" });
  if (dim) img = img.modulate({ brightness: 0.75, saturation: 0.3 });
  return `data:image/jpeg;base64,${(await img.jpeg({ quality: 70 }).toBuffer()).toString("base64")}`;
};
const thumb = (name) => photo(name, { size: 160 });

const DAY = 86_400_000;
/** Dans `days` jours (négatif = passé), à hh:mm heure locale. */
function at(days, hour = 9, minute = 0) {
  const d = new Date(Date.now() + days * DAY);
  d.setHours(hour, minute, 0, 0);
  return d;
}
const ago = (days) => new Date(Date.now() - days * DAY);
const day = (days) => new Date(`${new Date(Date.now() + days * DAY).toISOString().slice(0, 10)}T00:00:00Z`);

// ---------------------------------------------------------------------------
// Script
// ---------------------------------------------------------------------------

const keys = Object.keys(PEOPLE);
const u = {};
for (const key of keys) u[key] = await account(key);
const uids = keys.map((k) => u[k].uid);
console.log(`✔ ${keys.length} comptes Firebase prêts`);

const client = await MongoClient.connect(process.env.MONGODB_URI);
const db = client.db(process.env.MONGODB_DB);
const col = (name) => db.collection(name);

// 1. Nettoyage de toutes les données des comptes démo.
const demoListings = (await col("adoptionListings").find({ ownerId: { $in: uids } }, { projection: { _id: 1 } }).toArray())
  .map((l) => l._id.toHexString());
await Promise.all([
  col("adoptionListings").deleteMany({ ownerId: { $in: uids } }),
  col("adoptionApplications").deleteMany({ $or: [{ applicantId: { $in: uids } }, { listingId: { $in: demoListings } }] }),
  col("adoptionFavorites").deleteMany({ $or: [{ userId: { $in: uids } }, { listingId: { $in: demoListings } }] }),
  col("happyTails").deleteMany({ $or: [{ adopterId: { $in: uids } }, { listingId: { $in: demoListings } }] }),
  col("adoptionReports").deleteMany({ reporterId: { $in: uids } }),
  col("appointments").deleteMany({ $or: [{ ownerId: { $in: uids } }, { providerId: { $in: uids } }] }),
  col("reminders").deleteMany({ ownerId: { $in: uids } }),
  col("health_records").deleteMany({ ownerId: { $in: uids } }),
  col("pets").deleteMany({ ownerId: { $in: uids } }),
  col("petWeights").deleteMany({ ownerId: { $in: uids } }),
  col("notifications").deleteMany({ userId: { $in: uids } }),
]);

// 2. Profils.
const now = new Date();
for (const key of keys) {
  const p = u[key];
  await col("users").updateOne(
    { _id: p.uid },
    {
      $set: { email: p.email, displayName: p.displayName, city: p.city, role: p.role, phone: p.phone, bio: p.bio, updatedAt: now },
      $setOnInsert: { notificationPrefs: {}, createdAt: ago(60) },
    },
    { upsert: true },
  );
}

// 3. Animaux de Lina (collection `pets`, format du module Mes animaux) + carnets de santé.
const rockyId = new ObjectId();
const mimiId = new ObjectId();
const pet = (_id, name, species, sex, breed, birthDate, chipNumber, images, notes) => ({
  _id, name, species, sex, breed, birthDate, birthDateEstimated: false, chipNumber, sterilized: true, notes,
  vet: { name: "Dr Sami Trabelsi", clinic: "Clinique Vétérinaire El Menzah", address: PEOPLE.vet.address, phone: PEOPLE.vet.phone },
  ownerId: u.lina.uid, status: "active", favorite: name === "Rocky",
  contacts: [
    { _id: new ObjectId(), name: "Dr Sami Trabelsi", detail: "Vétérinaire – urgences 7j/7", phone: PEOPLE.vet.phone, emergency: true },
    { _id: new ObjectId(), name: "Nour (pet-sitter)", detail: "Garde à domicile", phone: PEOPLE.sitter.phone, emergency: false },
  ],
  photos: images.map((img) => ({ _id: new ObjectId(), ...img, createdAt: ago(200) })),
  notifiedAlertKeys: [], createdAt: ago(200), updatedAt: now,
});
const petPhoto = async (name) => ({ url: await photo(name), thumbnail: await photo(name, { size: 240 }) });
await col("pets").insertMany([
  pet(rockyId, "Rocky", "dog", "male", "Labrador", "2021-04-12", "788200000012345", [await petPhoto("dog-labrador")], "Adore l'eau et les balles. Allergique au poulet."),
  pet(mimiId, "Mimi", "cat", "female", "Européen roux", "2025-11-20", "", [await petPhoto("cat-2")], "Adoptée au refuge. Un peu timide avec les inconnus."),
]);
// Pesées mensuelles (courbe de poids de la fiche) : Rocky stable, Mimi qui grandit.
const weighings = (p, kgs) =>
  kgs.map((kg, i) => {
    const d = day(-30 * (kgs.length - 1 - i) - 2);
    return {
      _id: new ObjectId(), petId: p.toHexString(), ownerId: u.lina.uid, day: d.toISOString().slice(0, 10),
      measuredOn: new Date(d.getTime() + 12 * 3600_000), weightKg: kg, note: "", createdAt: d, updatedAt: d,
    };
  });
await col("petWeights").insertMany([
  ...weighings(rockyId, [30.8, 31.2, 31.0, 31.4, 31.1, 31.3]),
  ...weighings(mimiId, [2.1, 2.6, 3.0, 3.3, 3.5, 3.6]),
]);
const rocky = { id: rockyId.toHexString(), name: "Rocky", breed: "Labrador" };
const mimi = { id: mimiId.toHexString(), name: "Mimi", breed: "Européen roux" };

const health = (p, type, title, date, extra = {}) => ({
  _id: new ObjectId(), ownerId: u.lina.uid, petId: p.id, petName: p.name, type, title, date,
  veterinarian: "", clinic: "", notes: "", lotNumber: "", nextDueDate: null, dosage: "", endDate: null,
  attachments: [], createdAt: date, updatedAt: date, ...extra,
});
const sami = { veterinarian: "Dr Sami Trabelsi", clinic: "Clinique Vétérinaire El Menzah" };
const ines = { veterinarian: "Dr Ines Hammami", clinic: "Cabinet Vétérinaire du Lac" };
const rabies = health(rocky, "vaccin", "Vaccin CHPPiL + rage", day(-358), { ...sami, lotNumber: "RB-22871", nextDueDate: day(7), notes: "Rappel annuel. Bonne tolérance." });
const typhus = health(mimi, "vaccin", "Vaccin typhus-coryza", day(-170), { ...ines, lotNumber: "TC-0912", nextDueDate: day(195) });
await col("health_records").insertMany([
  rabies,
  health(rocky, "visite", "Bilan annuel", day(-40), { ...sami, notes: "Poids 31 kg, bon état général. Surveiller l'oreille gauche." }),
  health(rocky, "examen", "Analyse sanguine complète", day(-40), { ...sami, notes: "Résultats normaux." }),
  health(rocky, "traitement", "Otite – gouttes auriculaires", day(-38), { ...sami, dosage: "5 gouttes matin et soir", endDate: day(-28) }),
  health(rocky, "allergie", "Allergie au poulet", day(-300), { notes: "Démangeaisons : croquettes sans poulet uniquement." }),
  typhus,
  health(mimi, "visite", "Stérilisation", day(-150), { ...ines, notes: "Intervention sans complication. Fils retirés à J+10." }),
  health(mimi, "note", "Changement d'alimentation", day(-20), { notes: "Passage aux croquettes stérilisées, transition sur 7 jours." }),
]);

// 4. Adoption.
const PERSON_SNAPSHOT = (p) => ({ ownerId: p.uid, ownerName: p.displayName, ownerRole: p.role, ownerCity: p.city });
async function listing(owner, fields, status, extra = {}) {
  const _id = new ObjectId();
  const photos = await Promise.all(fields.images.map((n) => photo(n)));
  const { images, createdDaysAgo = 10, ...rest } = fields;
  return {
    _id, ...PERSON_SNAPSHOT(owner), status, photos, thumbnail: await thumb(images[0]),
    needs: "", conditions: "", adoptMe: false, city: owner.city,
    createdAt: ago(createdDaysAgo), updatedAt: ago(createdDaysAgo), publishedAt: ago(createdDaysAgo), ...rest, ...extra,
  };
}

const simba = await listing(u.lina, {
  images: ["cat-4"], name: "Simba", title: "Simba, jeune chat joueur cherche une famille active",
  species: "chat", breed: "Européen tigré", sex: "male", ageGroup: "jeune", ageLabel: "8 mois", size: "petit",
  story: "Simba a été trouvé dans notre rue à 2 mois. Il s'entend très bien avec Rocky, mais Mimi ne le supporte pas : nous lui cherchons une famille qui a du temps pour jouer et un extérieur à explorer.",
  needs: "Un extérieur sécurisé (jardin ou grande terrasse).", conditions: "Visite pré-adoption et engagement de stérilisation.",
  personality: ["joueur", "energique", "affectueux", "ok-enfants"], compatibility: { kids: true, cats: false, dogs: true, garden: true },
  energy: "eleve", aloneHours: 6, createdDaysAgo: 6,
}, "disponible");
const bella = await listing(u.lina, {
  images: ["dog-beagle"], name: "Bella", title: "Bella, beagle douce et sociable",
  species: "chien", breed: "Beagle", sex: "femelle", ageGroup: "adulte", ageLabel: "4 ans", size: "moyen",
  story: "Ma tante part s'installer à l'étranger et ne peut pas emmener Bella. Elle est propre, vaccinée et adore les enfants.",
  personality: ["affectueux", "ok-enfants", "ok-chiens", "eduque"], compatibility: { kids: true, cats: true, dogs: true, garden: false },
  energy: "moyen", aloneHours: 5, adoptMe: true, createdDaysAgo: 3,
}, "disponible");
const max = await listing(u.refuge, {
  images: ["dog-husky"], name: "Max", title: "Max, husky plein d'énergie",
  species: "chien", breed: "Husky sibérien", sex: "male", ageGroup: "jeune", ageLabel: "2 ans", size: "grand",
  story: "Max est arrivé au refuge après un abandon. Il a besoin de longues balades et d'un maître sportif.",
  needs: "Promenades quotidiennes de 2 h minimum.", personality: ["energique", "joueur", "exterieur", "ok-chiens"],
  compatibility: { kids: true, cats: false, dogs: true, garden: true }, energy: "eleve", aloneHours: 4, createdDaysAgo: 15,
}, "disponible");
const choupette = await listing(u.refuge, {
  images: ["cat-3"], name: "Choupette", title: "Choupette, chatte câline d'appartement",
  species: "chat", breed: "British Shorthair", sex: "femelle", ageGroup: "adulte", ageLabel: "5 ans", size: "moyen",
  story: "Choupette est une chatte calme qui aime les siestes au soleil et les caresses.",
  personality: ["calme", "affectueux", "interieur", "ok-chats"], compatibility: { kids: true, cats: true, dogs: false, garden: false },
  energy: "faible", aloneHours: 9, adoptMe: true, createdDaysAgo: 30,
}, "disponible");
const toby = await listing(u.karim, {
  images: ["dog-terrier-yorkshire"], name: "Toby", title: "Toby, petit yorkshire senior",
  species: "chien", breed: "Yorkshire", sex: "male", ageGroup: "senior", ageLabel: "10 ans", size: "petit",
  story: "Toby a besoin d'un foyer calme pour ses vieux jours. Il suit un traitement pour le cœur.",
  personality: ["calme", "affectueux", "soins", "interieur"], compatibility: { kids: false, cats: true, dogs: true, garden: false },
  energy: "faible", aloneHours: 4, createdDaysAgo: 8,
}, "disponible");
const goldie = await listing(u.refuge, {
  images: ["dog-retriever-golden"], name: "Goldie", title: "Goldie, golden retriever adorable",
  species: "chien", breed: "Golden retriever", sex: "femelle", ageGroup: "adulte", ageLabel: "3 ans", size: "grand",
  story: "Goldie est la gentillesse incarnée, parfaite avec les enfants.",
  personality: ["affectueux", "joueur", "ok-enfants", "ok-chats", "ok-chiens", "eduque"],
  compatibility: { kids: true, cats: true, dogs: true, garden: true }, energy: "moyen", aloneHours: 5, createdDaysAgo: 20,
}, "reservee");
// Adoptions terminées (à l'origine des happy tails).
const mimiListing = await listing(u.refuge, {
  images: ["cat-2"], name: "Mimi", title: "Mimi, chaton roux très doux",
  species: "chat", breed: "Européen roux", sex: "femelle", ageGroup: "bebe", ageLabel: "3 mois", size: "petit",
  story: "Mimi a été recueillie avec ses frères et sœurs.", personality: ["joueur", "affectueux", "ok-chiens"],
  compatibility: { kids: true, cats: true, dogs: true, garden: false }, energy: "moyen", aloneHours: 6, createdDaysAgo: 330,
}, "adoptee", { adopterId: u.lina.uid, adopterName: u.lina.displayName, adoptedAt: ago(300) });
const nougat = await listing(u.karim, {
  images: ["cat-1"], name: "Nougat", title: "Nougat, chat ragdoll très calme",
  species: "chat", breed: "Ragdoll", sex: "male", ageGroup: "adulte", ageLabel: "6 ans", size: "moyen",
  story: "Je déménage dans un logement où les animaux sont interdits.", personality: ["calme", "affectueux", "interieur"],
  compatibility: { kids: true, cats: true, dogs: false, garden: false }, energy: "faible", aloneHours: 8, createdDaysAgo: 90,
}, "adoptee", { adopterId: u.youssef.uid, adopterName: u.youssef.displayName, adoptedAt: ago(60) });

const allListings = [simba, bella, max, choupette, toby, goldie, mimiListing, nougat];
const lid = (l) => l._id.toHexString();

async function application(l, applicant, status, answers, daysAgo, extra = {}) {
  return {
    _id: `${lid(l)}_${applicant.uid}`, listingId: lid(l), ownerId: l.ownerId, ownerName: l.ownerName,
    animalName: l.name, animalThumbnail: l.thumbnail, applicantId: applicant.uid, applicantName: applicant.displayName,
    applicantCity: applicant.city, status, ...answers, createdAt: ago(daysAgo), updatedAt: ago(daysAgo), ...extra,
  };
}
const answers = ({ housing, household, lifestyle }) => ({
  housing: { type: "maison", outdoor: true, tenure: "proprietaire", landlordOk: false, city: "Tunis", ...housing },
  household: { adults: 2, children: 0, childAges: [], cats: 0, dogs: 0, others: 0, allergies: false, ...household },
  lifestyle: { aloneHours: 4, activity: "modere", experience: "un-peu", ...lifestyle },
});

// Simba : Youssef très compatible (100 %), Amira peu compatible (~25 %).
const youssefForSimba = answers({
  housing: { type: "maison", outdoor: true, tenure: "proprietaire", city: "La Marsa" },
  household: { adults: 2, children: 2, childAges: ["6-12"] },
  lifestyle: {
    aloneHours: 3, activity: "tres-actif", experience: "beaucoup",
    motivation: "Nous avons une maison avec un grand jardin clos à La Marsa. Nos deux enfants rêvent d'un chat joueur, et je travaille à la maison la plupart du temps. Nous avons déjà eu des chats pendant 10 ans.",
  },
});
const amiraForSimba = answers({
  housing: { type: "appartement", outdoor: false, tenure: "locataire", landlordOk: false, city: "Ariana" },
  household: { adults: 1, cats: 2, allergies: true },
  lifestyle: {
    aloneHours: 9, activity: "calme", experience: "un-peu",
    motivation: "J'ai déjà deux chats et je pense qu'un troisième leur ferait de la compagnie pendant mes journées à la fac.",
  },
});
const applications = [
  await application(simba, u.youssef, "envoyee", youssefForSimba, 2),
  await application(simba, u.amira, "envoyee", amiraForSimba, 1),
  await application(bella, u.karim, "en-etude", answers({
    housing: { type: "appartement", outdoor: false, tenure: "locataire", landlordOk: true, city: "Sousse" },
    lifestyle: { aloneHours: 6, activity: "modere", motivation: "J'ai grandi avec des beagles et je cherche une compagne pour mes balades du soir au bord de la mer." },
  }), 1, { reviewedAt: ago(0.5) }),
  // Lina candidate chez le refuge.
  await application(max, u.lina, "en-etude", answers({
    housing: { type: "maison", outdoor: true, city: "Tunis" }, household: { dogs: 1, cats: 1 },
    lifestyle: { aloneHours: 3, activity: "tres-actif", experience: "beaucoup", motivation: "Je cours tous les matins avec Rocky et Max serait le compagnon idéal. Notre jardin est clos et Rocky adore les autres chiens." },
  }), 4, { reviewedAt: ago(2) }),
  await application(goldie, u.youssef, "acceptee", youssefForSimba, 12, { reviewedAt: ago(10), decidedAt: ago(7) }),
  await application(goldie, u.amira, "refusee", amiraForSimba, 11, { decidedAt: ago(7) }),
  await application(mimiListing, u.lina, "adoptee", answers({ lifestyle: { motivation: "Je souhaite offrir un foyer aimant à Mimi, Rocky est très doux avec les chats." } }), 320, { decidedAt: ago(310), adoptedAt: ago(300) }),
  await application(nougat, u.youssef, "adoptee", youssefForSimba, 80, { decidedAt: ago(70), adoptedAt: ago(60) }),
];
goldie.acceptedApplicationId = applications[4]._id;
mimiListing.acceptedApplicationId = applications[6]._id;
nougat.acceptedApplicationId = applications[7]._id;
await col("adoptionListings").insertMany(allListings);
await col("adoptionApplications").insertMany(applications);

await col("adoptionFavorites").insertMany(
  [[u.lina, choupette], [u.lina, max], [u.youssef, bella], [u.amira, simba]].map(([p, l]) => ({
    _id: `${p.uid}_${lid(l)}`, userId: p.uid, listingId: lid(l), createdAt: ago(1),
  })),
);

await col("happyTails").insertMany([
  {
    _id: lid(mimiListing), listingId: lid(mimiListing), adopterId: u.lina.uid, adopterName: u.lina.displayName,
    ownerName: u.refuge.displayName, animalName: "Mimi", species: "chat",
    beforePhoto: await photo("cat-2", { dim: true }), afterPhoto: await photo("cat-2"),
    story: "Mimi est arrivée toute timide il y a presque un an. Aujourd'hui elle dort collée à Rocky et réclame ses câlins tous les soirs. Merci au refuge Les Amis des Bêtes !",
    likedBy: [u.youssef.uid, u.amira.uid, u.refuge.uid], createdAt: ago(250),
  },
  {
    _id: lid(nougat), listingId: lid(nougat), adopterId: u.youssef.uid, adopterName: u.youssef.displayName,
    ownerName: u.karim.displayName, animalName: "Nougat", species: "chat",
    beforePhoto: await photo("cat-1", { dim: true }), afterPhoto: await photo("cat-1"),
    story: "Nougat a trouvé sa place sur le canapé dès le premier jour. Les enfants l'adorent !",
    likedBy: [u.lina.uid], createdAt: ago(40),
  },
]);

// 5. Rendez-vous (réservations chez les prestataires + rendez-vous personnels) et rappels de soins.
const booking = (provider, p, fields) => ({
  providerId: provider.uid, providerName: provider.displayName, providerAddress: provider.address, providerPhone: provider.phone,
  place: "exterieur", location: provider.address, petId: p.id, petName: p.name, petBreed: p.breed, ...fields,
});
function appointment(owner, fields) {
  const { startsAt, minutes = 30, status, history = [], ...rest } = fields;
  const created = new Date(Math.min(Date.now(), startsAt.getTime()) - 3 * DAY);
  const changes = [{ action: "create", at: created, by: owner.uid }, ...history];
  return {
    _id: new ObjectId(), ownerId: owner.uid, notes: "", place: "domicile", location: owner.city,
    reminderMinutes: 1440, pushReminder: true, startsAt, endsAt: new Date(startsAt.getTime() + minutes * 60_000),
    status, version: changes.length, changes, ...rest,
  };
}
const rabiesAppt = appointment(u.lina, booking(u.vet, rocky, {
  title: "Rappel vaccin CHPPiL + rage", type: "vaccin", startsAt: at(2, 10, 0), price: 70, status: "confirmed",
  notes: "Apporter le carnet de santé.", history: [{ action: "confirm", at: ago(1), by: u.vet.uid }],
}));
const groomingAppt = appointment(u.lina, booking(u.groomer, rocky, {
  title: "Toilettage complet (bain + coupe)", type: "toilettage", startsAt: at(5, 14, 30), minutes: 90, price: 60, status: "planned",
}));
const mimiCheck = appointment(u.lina, booking(u.vet2, mimi, {
  title: "Contrôle annuel", type: "veterinaire", startsAt: at(9, 16, 0), price: 50, status: "planned",
  history: [{ action: "reschedule", at: ago(1), by: u.lina.uid, reason: "Empêchement professionnel", oldStart: at(4, 11, 0), newStart: at(9, 16, 0) }],
}));
const appointmentsDocs = [
  rabiesAppt, groomingAppt, mimiCheck,
  appointment(u.lina, booking(u.shop, rocky, {
    title: "Retrait commande croquettes sans poulet", type: "autre", startsAt: at(3, 18, 0), minutes: 15, price: 95, status: "confirmed",
    reminderMinutes: 120, history: [{ action: "confirm", at: ago(1), by: u.shop.uid }],
  })),
  appointment(u.lina, booking(u.vet, rocky, {
    title: "Consultation – otite", type: "veterinaire", startsAt: at(-40, 9, 30), price: 60, status: "completed",
    reminderDoneAt: at(-41, 9, 0),
    history: [{ action: "confirm", at: at(-42, 12, 0), by: u.vet.uid }, { action: "complete", at: at(-40, 10, 5), by: u.vet.uid }],
  })),
  appointment(u.lina, booking(u.sitter, mimi, {
    title: "Garde de Mimi pendant le week-end", type: "garde", startsAt: at(-10, 9, 0), minutes: 600, price: 80, status: "cancelled",
    place: "domicile", location: "Tunis", cancelReason: "Voyage annulé",
    history: [{ action: "cancel", at: at(-12, 20, 0), by: u.lina.uid, reason: "Voyage annulé" }],
  })),
  appointment(u.lina, {
    title: "Séance d'éducation canine au parc", type: "education", startsAt: at(1, 17, 30), minutes: 60, status: "confirmed",
    petId: rocky.id, petName: "Rocky", petBreed: "Labrador", place: "exterieur", location: "Parc du Belvédère, Tunis",
    notes: "Travail du rappel et de la marche en laisse.", reminderMinutes: 60,
  }),
  // Clientèle des prestataires (vue « prestataire »).
  appointment(u.youssef, booking(u.vet, { name: "Nougat", breed: "Ragdoll" }, {
    title: "Vaccin typhus-coryza", type: "vaccin", startsAt: at(2, 11, 0), price: 65, status: "planned", petId: undefined,
  })),
  appointment(u.karim, booking(u.groomer, { name: "Toby", breed: "Yorkshire" }, {
    title: "Coupe des griffes", type: "toilettage", startsAt: at(5, 10, 0), price: 20, status: "confirmed", petId: undefined,
    history: [{ action: "confirm", at: ago(1), by: u.groomer.uid }],
  })),
].map((a) => Object.fromEntries(Object.entries(a).filter(([, v]) => v !== undefined)));
await col("appointments").insertMany(appointmentsDocs);

const reminder = (p, fields) => ({ _id: new ObjectId(), ownerId: u.lina.uid, petName: p.name, petBreed: p.breed, done: false, ...fields });
await col("reminders").insertMany([
  reminder(rocky, { title: "Antiparasitaire (pipette)", category: "traitement", detail: "Protection 1 mois", dueAt: at(1, 20, 0), description: "Pipette entre les omoplates." }),
  reminder(mimi, { title: "Vermifuge", category: "medicament", detail: "1 comprimé", dueAt: at(-2, 9, 0) }),
  reminder(rocky, { title: "Brossage des dents", category: "hygiene", dueAt: at(4, 19, 0) }),
  reminder(mimi, { title: "Pesée mensuelle", category: "controle", dueAt: at(-6, 10, 0), done: true, doneAt: at(-6, 10, 30) }),
  reminder(rocky, { title: "Gouttes auriculaires (contrôle)", category: "veterinaire", dueAt: at(12, 9, 0), description: "Vérifier l'oreille gauche." }),
]);

// 6. Notifications (centre de notifications de chaque compte).
const note = (user, fields, minutesAgo, read = false) => ({
  _id: new ObjectId(), userId: user.uid, senderId: "system", read, createdAt: new Date(Date.now() - minutesAgo * 60_000),
  showAt: new Date(Date.now() - minutesAgo * 60_000), ...fields,
});
const received = (l) => `/communaute/adoption/${lid(l)}/candidatures`;
await col("notifications").insertMany([
  note(u.lina, { type: "adoption", title: "Nouvelle candidature pour Simba", body: "Amira Jlassi souhaite adopter Simba.", link: received(simba), actionLabel: "Voir les candidatures" }, 30),
  note(u.lina, { type: "adoption", title: "Nouvelle candidature pour Bella", body: "Karim Mansour souhaite adopter Bella.", link: received(bella), actionLabel: "Voir les candidatures" }, 300),
  note(u.lina, { type: "rendez-vous", title: "Rendez-vous confirmé", body: `Clinique Vétérinaire El Menzah a confirmé le rendez-vous de Rocky (${rabiesAppt.title}).`, link: `/rendez-vous/${rabiesAppt._id}`, actionLabel: "Voir le rendez-vous" }, 600),
  note(u.lina, { type: "adoption", title: "Candidature en étude", body: "Le refuge Les Amis des Bêtes étudie votre candidature pour Max.", link: "/communaute/adoption/mes-candidatures", actionLabel: "Mes candidatures" }, 2880, true),
  note(u.lina, { type: "adoption", title: "Nouvelle candidature pour Simba", body: "Youssef Gharbi souhaite adopter Simba.", link: received(simba), actionLabel: "Voir les candidatures" }, 2900, true),
  note(u.lina, { type: "rappel", title: "Rappel de vaccin pour Rocky", body: `${rabies.title} : rappel prévu le ${rabies.nextDueDate.toLocaleDateString("fr-FR", { dateStyle: "long" })}.`, link: `/animaux/${rocky.id}/carnet-de-sante/${rabies._id}`, actionLabel: "Voir le carnet" }, 5),
  note(u.vet, { type: "rendez-vous", title: "Nouvelle réservation", body: "Youssef Gharbi a réservé « Vaccin typhus-coryza » pour Nougat.", actionLabel: "Voir l'agenda", link: "/rendez-vous" }, 120),
  note(u.groomer, { type: "rendez-vous", title: "Nouvelle demande de rendez-vous", body: "Lina Ben Salah demande « Toilettage complet » pour Rocky.", link: `/rendez-vous/${groomingAppt._id}`, actionLabel: "Voir le rendez-vous" }, 90),
  note(u.vet2, { type: "rendez-vous", title: "Rendez-vous reporté", body: "Lina Ben Salah a reporté le contrôle annuel de Mimi.", link: `/rendez-vous/${mimiCheck._id}`, actionLabel: "Voir le rendez-vous" }, 1440),
  note(u.youssef, { type: "adoption", title: "Candidature acceptée 🎉", body: "Le refuge a accepté votre candidature pour Goldie.", link: "/communaute/adoption/mes-candidatures", actionLabel: "Mes candidatures" }, 10000),
  note(u.refuge, { type: "adoption", title: "Nouvelle candidature pour Max", body: "Lina Ben Salah souhaite adopter Max.", link: received(max), actionLabel: "Voir les candidatures" }, 5800),
]);

await client.close();

console.log(`✔ Données démo créées (mot de passe de tous les comptes : ${PASSWORD})`);
console.table(keys.map((k) => ({ compte: k, email: u[k].email, rôle: u[k].role, nom: u[k].displayName })));
process.exit(0);
