# Architecture technique — PetCare Community

Ce document explique comment l'application est construite et les règles à suivre pour la faire évoluer.
Tous les modules suivent **la même architecture** : en ajoutant un module, copiez un module existant
(le plus simple : Carnet de santé ; le plus complet : Adoption).

## 1. Vue d'ensemble

Une seule application **Next.js 16** (App Router) contient l'interface (React) et l'API REST (routes `/api`).
Elle se déploie en un seul bloc. Deux services externes :

- **Firebase Authentication** : comptes, connexion, mots de passe, e-mails de réinitialisation. *Uniquement* cela :
  Firestore n'est plus utilisé (ses règles refusent tout accès, voir `firestore.rules`).
- **MongoDB Atlas** : toutes les données (base `petcare`), lues et écrites **uniquement par le serveur**.

```
┌──────────────────────────── NAVIGATEUR ─────────────────────────────┐
│ 1. Vue        pages src/app/(app|auth)/…  +  composants src/components│
│                     │ appellent des fonctions, jamais fetch() direct  │
│ 2. Client     src/lib/<module>.ts  ──►  api()  (src/lib/api.ts)       │
│                                          ajoute le jeton Firebase     │
└─────────────────────────────────────┬─────────────────────────────────┘
                                      │  HTTP /api/…   Authorization: Bearer <idToken>
┌──────────────────────────── SERVEUR ┴─────────────────────────────────┐
│ 3. Contrôleur src/app/api/<module>/…/route.ts                         │
│               handle() → requireUser() → validation → droits → données│
│ 4. Modèle     src/lib/server/<module>.ts  (collections, types, règles)│
│               src/lib/server/mongo.ts     (connexion, transactions)   │
└─────────────────────────────────────┬─────────────────────────────────┘
                                      ▼
                   MongoDB Atlas (petcare)        Firebase Auth

Partagé navigateur + serveur (sans dépendance) : types, constantes, règles métier
  src/lib/models.ts, src/lib/adoption-models.ts, src/lib/health-records.ts, src/lib/rendez-vous/{types,rules,format}.ts
```

C'est une organisation **de type MVC** : la *Vue* est en React (dans le navigateur), les *Contrôleurs* sont les
routes API (elles renvoient du JSON, pas des pages), le *Modèle* correspond aux collections MongoDB, à leurs types
et à leurs règles. Une couche « client » (`src/lib/<module>.ts`) fait le lien entre les pages et l'API.

## 2. Arborescence

| Dossier / fichier | Rôle |
|---|---|
| `src/app/(auth)/` | Pages sans menu : connexion, inscription, mot de passe oublié |
| `src/app/(app)/` | Pages avec menu (`layout.tsx` : barre de navigation, fournisseurs de contexte) |
| `src/app/api/` | Routes API — **seul endroit qui accède à MongoDB** |
| `src/components/ui/` | Composants communs : Button, TextField, Card/Alert, Toggle, Avatar, Icon |
| `src/components/auth/` | `AuthProvider` (utilisateur + profil), `RequireAuth`, menu du compte |
| `src/components/<module>/` | Composants d'un module (adoption, sante, rendez-vous, notifications) |
| `src/lib/api.ts` | `api()` : appel des routes avec le jeton ; `ApiError` (message, statut, `fieldErrors`) |
| `src/lib/firebase.ts` | Initialisation Firebase (Auth uniquement) |
| `src/lib/<module>.ts` | Fonctions appelées par les pages (`users`, `notifications`, `adoption`, `health-records-api`, `rendez-vous/store`) |
| `src/lib/server/http.ts` | `handle()`, `requireUser()`, `optionalUser()`, `HttpError`, `readJson()` |
| `src/lib/server/mongo.ts` | Connexion unique à Atlas, `withTransaction()`, collections `users` / `notifications` |
| `src/lib/server/notify.ts` | `notifyUsers()` : notifications envoyées par le serveur |
| `src/lib/server/<module>.ts` | Modèle d'un module : `adoption.ts`, `health.ts`, `rendez-vous.ts` |
| `scripts/test-*.mjs` | Tests d'API de chaque module (comptes Firebase temporaires) |

Le fichier `import "server-only"` en tête des fichiers `src/lib/server/*` fait échouer le build si l'un d'eux est
importé par du code navigateur : les identifiants MongoDB ne peuvent pas fuiter vers le navigateur.

## 3. Le parcours d'une requête

Exemple : un refuge accepte une candidature.

1. **Page** `ReceivedApplications.tsx` → `acceptApplication(listing, application)` (`src/lib/adoption.ts`).
2. **Client** → `api("/api/adoption/applications/<id>", { method: "PATCH", body: { action: "accept" } })`.
   `api()` attend que Firebase ait restauré la session (`authStateReady`), puis ajoute `Authorization: Bearer <jeton>`.
3. **Contrôleur** `src/app/api/adoption/applications/[id]/route.ts` :
   - `handle()` rend la route dynamique (`connection()`) et transforme toute erreur en JSON `{ error, fieldErrors? }` ;
   - `requireUser()` vérifie la signature du jeton (firebase-admin) → `uid` ;
   - vérifie les droits (`application.ownerId === uid`) et l'état (candidature en attente, animal disponible) ;
   - `withTransaction()` : annonce « réservée » **et** candidature « acceptée », tout ou rien ;
   - `notifyUsers()` prévient le candidat.
4. **Réponse** JSON (dates en ISO) → la page met son affichage à jour.

## 4. Conventions (à respecter dans tout nouveau code)

### Sécurité et droits
- L'identité vient **toujours** de `requireUser(request)` (ou `optionalUser` pour une page publique),
  jamais d'un `userId` envoyé par le navigateur.
- Chaque requête MongoDB filtre sur le propriétaire (`{ _id, ownerId: uid }`) : un document d'un autre utilisateur
  répond **404** (on ne révèle pas qu'il existe). **403** = action interdite sur un document visible.
- Les règles vérifiées dans le navigateur (formulaires) sont **revérifiées par le serveur**. Les règles métier
  partagées (`rules.ts`, `validateHealthRecord`, …) sont écrites une fois et utilisées des deux côtés.
- Champs reçus : liste blanche (champ inconnu → 400), longueurs maximales, énumérations, images en
  `data:image/…;base64` avec taille maximale, liens de notification internes uniquement (`/…`).

### Routes API
- Toujours `export async function GET|POST|PATCH|PUT|DELETE(request, ctx) { return handle(async () => { … }) }`.
- Erreurs : `throw badRequest("…")`, `forbidden()`, `notFound()` ou `new HttpError(409, "…", fieldErrors?)` —
  messages en français, affichables tels quels.
- Plusieurs documents modifiés ensemble → `withTransaction(async (session) => …)` en passant `{ session }`.
- Mises à jour concurrentes : filtre conditionnel sur l'état attendu (`{ _id, status: "disponible" }`,
  `{ _id, version }`) ; si rien n'est modifié → 409 « La situation a changé ».
- Les identifiants dans l'URL sont validés (`ObjectId.isValid` + longueur 24) avant toute requête.

### Données MongoDB
- Une collection = un type `…Doc` dans `src/lib/server/<module>.ts`, avec une fonction d'accès
  (`listings()`, `healthRecords()`, `appointments()`…) qui crée les **index** au premier appel.
- Dates stockées en `Date` ; envoyées au navigateur en chaînes **ISO** (sérialiseurs `toJson` / `…Json`) ;
  le navigateur les reconvertit si besoin (`new Date(…)`, `toDate()` de `src/lib/dates.ts`).
- `_id` : `ObjectId` en général ; chaîne choisie quand l'unicité l'exige (`users._id` = uid Firebase,
  candidature `{listingId}_{uid}`, favori `{uid}_{listingId}`, Happy Tail = id de l'annonce).
- Une seule connexion par processus (`src/lib/server/mongo.ts`), réutilisée par tous les modules.

### Navigateur
- Les pages n'appellent jamais `fetch` directement : elles utilisent les fonctions de `src/lib/<module>.ts`,
  qui passent par `api()` (`{ public: true }` pour une route accessible aux visiteurs).
- Pages privées enveloppées dans `<RequireAuth>` (redirection vers `/connexion`).
- Les erreurs s'affichent avec `errorMessage(error)` ; `ApiError.fieldErrors` permet d'afficher l'erreur sous
  chaque champ (formulaire du carnet de santé).

### Next.js 16 (spécificités du projet)
- `cacheComponents: true` (`next.config.ts`) : les pages visitées restent montées mais cachées pour une navigation
  instantanée. Conséquence pour les tests : un même libellé peut exister deux fois dans le DOM (cibler les
  éléments visibles).
- Les routes API appellent `connection()` (dans `handle()`) : elles ne sont jamais exécutées au build, et
  `unstable_rethrow()` laisse passer les signaux internes de Next.js.
- Avant d'utiliser une API Next.js, lire `node_modules/next/dist/docs/` (voir `AGENTS.md`) : cette version
  diffère des versions précédentes.

## 5. Les modules

### Utilisateurs & notifications
- `users` (`_id` = uid) : profil, rôle, préférences d'alerte. `GET/POST/PATCH /api/users/me` (le rôle et l'e-mail
  ne se modifient pas ; `admin` se donne dans Atlas).
- `notifications` : `GET/POST /api/notifications`, `PATCH/DELETE /api/notifications/[id]`, `POST …/read-all`.
  Le navigateur recharge la liste toutes les 20 s et immédiatement après chaque action.
- Inscription : compte Firebase, puis profil MongoDB, puis notification de bienvenue ; `AuthProvider` recharge le
  profil à la fin de l'inscription (événement `petcare:profile-changed`).

### Adoption
- Modèle `src/lib/server/adoption.ts` ; types et utilitaires partagés `src/lib/adoption-models.ts`.
- Routes : `listings` (fil public, `mine`, `[id]` : `update` / `archive` / `republish`, suppression d'un brouillon),
  `applications` (`?scope=mine|received`, `[id]` : `withdraw`, `review`, `accept`, `refuse`, `cancel-acceptance`,
  `confirm-adoption`), `favorites`, `happy-tails` (+ `like`), `stats`, `reports`.
- Publication réservée aux rôles `proprietaire` et `refuge`. Accepter, confirmer, archiver et supprimer sont des
  transactions. Les listes n'envoient que la photo de couverture (`LIST_PROJECTION`).

### Carnet de santé
- Modèle `src/lib/server/health.ts` ; types et validation partagés `src/lib/health-records.ts`.
- Routes : `GET/POST /api/health-records`, `GET/PUT/DELETE /api/health-records/[id]`,
  `GET …/[id]/attachments/[attachmentId]` (téléchargement), `GET …/pets` (résumé par animal).
- Pièces jointes stockées en binaire dans le document, exclues des lectures (`attachments.data`), servies avec
  `Content-Disposition` et `nosniff`. Rappel de vaccin = notification `rappel` gérée par le serveur.

### Rendez-vous & rappels
- Modèle `src/lib/server/rendez-vous.ts` ; types, règles (RG-12 à RG-21) et formats partagés `src/lib/rendez-vous/`.
- Routes : `GET/POST /api/appointments`, `PATCH /api/appointments/[id]` (`confirm`, `reschedule`, `cancel`,
  `complete`, `reminder`, `reminder-done`, avec la `version` affichée), `GET/POST /api/reminders`,
  `PATCH/DELETE /api/reminders/[id]`.
- `src/lib/rendez-vous/store.ts` garde en cache les données de l'utilisateur connecté (rechargées à chaque
  connexion) et les met à jour après chaque action. L'historique (`changes`) est écrit par le serveur.

### Mes animaux
- Modèle `src/lib/server/pets.ts` ; types, validation et âge partagés `src/lib/pets-models.ts` ; alerte de poids
  (code pur) `src/lib/pet-weight-alert.ts` ; client `src/lib/pets.ts`.
- Collections : `pets` (identité, photos dans le document, contacts, vétérinaire, `status` `draft` / `active` /
  `archived`, alerte en cours) et `petWeights` (index unique `petId` + `day` : une pesée par jour).
- Routes : `GET/POST /api/pets`, `GET/PUT/PATCH /api/pets/[id]`, `POST …/archive`, `POST …/restore`,
  `POST …/photos`, `DELETE …/photos/[fileId]`, `POST …/photos/[fileId]/cover`, `GET/POST …/weights`,
  `PUT/DELETE …/weights/[weightId]`. Propriétaire uniquement (403) ; jamais de suppression ; animal archivé non
  modifiable (409). Les autres modules lisent les animaux avec `listPets()` / `getPet(id)` de `src/lib/pets.ts`.
- Alerte de poids recalculée par le serveur à chaque pesée ajoutée, corrigée ou supprimée ; notification `sante` via
  `notifyUsers(…, { includeSelf: true })`, une par épisode. Liens vers les autres modules : `LINKED_MODULES`
  (`src/components/pets/ui.tsx`).

### Communauté (hub)
- Page `src/app/(app)/communaute/page.tsx` (maquette `designs/stitch/communaut_petcare_community`), sans route ni
  collection propre : elle lit les annonces, les Happy Tails et le nombre d'adoptions via `src/lib/adoption.ts`.
- Liens : fil d'adoption, publication, Happy Tails ; la carte Perdus & Trouvés reste « Bientôt disponible ».
  Chiffres affichés = données réelles (aucun chiffre de la maquette).
### Services
- Modèle `src/lib/server/services.ts` ; types, validation, créneaux (heure de Tunis) et transitions partagés
  `src/lib/services-models.ts` ; client `src/lib/services.ts`.
- Collections : `serviceCategories` (catégories par défaut tant que l'admin n'en a pas enregistré), `serviceProviders`
  (un profil par prestataire, `status` `pending` / `published` / `rejected`), `providerServices` (`published` /
  `archived`), `providerAvailability` (`_id` = `{providerId}_{weekday}`), `serviceBookings` (`pending` / `confirmed` /
  `declined` / `cancelled`, `appointmentId`).
- Routes `/api/services/…` : `categories` (écriture admin), `providers` (annuaire, `?status=pending` admin, `me`,
  `me/services`, `me/availability`, `[id]`, `[id]/status` admin, `[id]/slots`), `bookings` (`?as=client|provider`,
  `[id]/status`). Rôles vérifiés par le serveur (`requireProviderRole`, `requireAdmin`).
- Réservation = transaction : `serviceBookings` + rendez-vous `planned` dans `appointments` (module Rendez-vous, non
  modifié) ; confirmer / refuser / annuler met à jour le rendez-vous, et une action faite depuis l'agenda est reprise
  à la lecture des réservations (`syncFromAgenda`). Notifications `service` via `notifyUsers`.

## 6. Ajouter un module

1. **Types partagés** : `src/lib/<module>-models.ts` (types, constantes, validations sans dépendance).
2. **Modèle** : `src/lib/server/<module>.ts` (`import "server-only"`, types `…Doc`, accès aux collections + index,
   sérialiseurs JSON, validation des données reçues).
3. **Contrôleurs** : `src/app/api/<module>/…/route.ts` avec `handle()` + `requireUser()`.
4. **Client** : `src/lib/<module>.ts`, une fonction par action, via `api()`.
5. **Pages** : `src/app/(app)/<module>/…`, `<RequireAuth>` pour les pages privées.
6. **Tests** : `scripts/test-<module>.mjs` + script `test:<module>` dans `package.json` (copier un test existant).
7. **Documentation** : section du module dans `README.md` et dans ce fichier.

## 7. Configuration et déploiement

- Variables (`.env.local`, jamais versionné ; modèle : `.env.local.example`) : `NEXT_PUBLIC_FIREBASE_*`
  (publiques, configuration du client Firebase), `MONGODB_URI` et `MONGODB_DB` (secrets, serveur uniquement).
- Hébergement : définir les mêmes variables sur la plateforme ; autoriser l'adresse du serveur dans
  Atlas → Network Access ; `npm run build` puis `npm start`.
- Atlas : base `petcare`. Les index sont créés automatiquement au premier appel de chaque module.
  Les transactions demandent un cluster en replica set (c'est le cas de tous les clusters Atlas).

## 8. Tests

| Commande | Vérifications |
|---|---|
| `npm run test:api` | 40 — profils, notifications, droits |
| `npm run test:adoption` | 72 — annonces, candidatures (cycle complet), favoris, Happy Tails, signalements |
| `npm run test:health` | 33 — validation, droits, pièces jointes, rappels de vaccin |
| `npm run test:rendez-vous` | 53 — règles RG-12 à RG-21, versions, réservations prestataire, rappels de soins |
| `npm run test:pets` | 93 — validation, droits, photos, contacts, pesées, brouillon, archivage, chaque règle de l'alerte de poids |
| `npm run test:services` | 102 — catégories, rôles, cycle de validation d'un profil, prestations, plages horaires, créneaux, réservations et agenda |
| `npm test` | 62 — tests unitaires sans serveur : animaux, alerte de poids, services (validation, créneaux, transitions) |

Chaque script crée des comptes Firebase temporaires, appelle l'API d'un serveur lancé, puis supprime comptes et
données. À lancer avant chaque fusion dans `main`, contre `npm run dev` ou, mieux, un build de production.

## 9. Limites connues et prochaines étapes

- Module **Perdus & Trouvés** à développer (carte « Bientôt disponible » du hub `/communaute`) ; le carnet de santé
  et l'agenda proposent les animaux de Mes animaux (un autre nom reste saisissable) ; les
  boutons « Carnet santé » de l'agenda affichent « arrive avec le module Santé » (à relier au carnet existant).
- Photos et pièces jointes stockées dans les documents MongoDB (limite de 16 Mo par document) : un service de
  fichiers serait préférable à grande échelle.
- Notifications par interrogation toutes les 20 s (pas de temps réel) ; e-mails non gérés (hors réinitialisation
  du mot de passe par Firebase).
