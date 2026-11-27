# PetCare Community — application web (Next.js)

PetCare Community est une plateforme communautaire pour les propriétaires d'animaux en Tunisie. Elle permet de
suivre la santé de ses animaux, de gérer ses rendez-vous et rappels de soins, de trouver et réserver des
prestataires (vétérinaires, toiletteurs, pensions…), de faciliter les adoptions et de poser ses questions à un
assistant IA. Projet réalisé en équipe de six personnes, un module chacune.

| Module | Contenu |
|---|---|
| Utilisateurs & notifications | Inscription, connexion, mot de passe oublié, profil, déconnexion, centre de notifications et préférences d'alerte |
| Mes animaux | Fiches des animaux, photos, suivi du poids et alerte intelligente de poids, archivage |
| Carnet de santé | Vaccins, visites, traitements, onglet Santé du jour, export PDF, partage sécurisé par QR code, scan d'ordonnance |
| Rendez-vous & rappels | Agenda, rendez-vous, rappels de soins |
| Communauté & adoption | Annonces d'adoption, candidatures, favoris, Happy Tails |
| Services | Annuaire des prestataires, réservation de créneaux, espace prestataire, administration |
| Assistant IA | Chatbot (Gemini) qui connaît les animaux de l'utilisateur et peut préparer des actions (rappel, pesée, réservation…) |

## Architecture

Une seule application **Next.js** contient l'interface (React) et l'API REST (routes `/api`) : c'est un
**monolithe modulaire**, organisé en couches de type **MVC**.

```
 Navigateur  ── Vue : pages src/app/(auth|app)/…  +  composants src/components/<module>
             ── Client : fonctions src/lib/<module>.ts  →  api() ajoute le jeton Firebase
                     │  HTTP /api/…   Authorization: Bearer <jeton>
 Serveur     ── Contrôleur : routes src/app/api/<module>/…  (vérifie le jeton, valide, contrôle les droits)
             ── Modèle : src/lib/server/<module>.ts  (règles métier, accès aux collections)
                     │
             MongoDB Atlas (données)        Firebase Auth (comptes)        Gemini (assistant)
```

- Le navigateur n'accède **jamais** directement à la base : toutes les lectures et écritures passent par l'API, qui
  vérifie l'identité (jeton Firebase) et les droits de l'utilisateur.
- Les types et les règles de validation (`src/lib/*-models.ts`, `src/lib/models.ts`) sont **partagés** entre le
  navigateur et le serveur : un formulaire et l'API appliquent exactement les mêmes règles.
- Chaque module a ses propres dossiers à chaque couche : les six membres de l'équipe travaillent en parallèle
  sans se gêner.

➡️ Détails (parcours d'une requête, conventions, sécurité, ajout d'un module) : [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Technologies et raisons de leur choix

| Technologie | Rôle dans le projet | Pourquoi ce choix |
|---|---|---|
| **Next.js 16** (App Router) | Framework de l'application : pages et API | Un seul projet pour le front-end et le back-end : une seule base de code, un seul déploiement, pas de configuration CORS. Routage par dossiers (un dossier = une page), groupes de routes pour séparer les pages publiques `(auth)` des pages connectées `(app)`, rendu côté serveur pour des pages rapides. Hébergement natif sur Vercel. |
| **React 19** | Construction de l'interface | Bibliothèque d'interface la plus répandue : composants réutilisables (boutons, champs, cartes) partagés par tous les modules, grand écosystème, et c'est la base de Next.js. |
| **TypeScript** | Langage de tout le code | Les erreurs (champ mal nommé, mauvais type) sont détectées avant l'exécution. Indispensable à six : les types `UserProfile`, `Pet`, `AppNotification`… servent de contrat entre les modules et entre le navigateur et le serveur. |
| **Tailwind CSS 4** | Mise en forme | Les maquettes réalisées avec **Stitch** sont exportées en HTML Tailwind : on les reprend presque telles quelles. Les couleurs et typographies du design system sont définies une seule fois (`@theme` dans `globals.css`), ce qui garantit une apparence identique dans tous les modules. |
| **Material Symbols** | Icônes | Ce sont les icônes utilisées par les maquettes Stitch ; plus de 3 000 icônes chargées comme une police. |
| **Firebase Authentication** | Comptes, connexion, mot de passe oublié, sessions | La sécurité des mots de passe est confiée à Google : l'application ne stocke jamais de mot de passe. Fournit sans développement supplémentaire l'e-mail de réinitialisation, la session persistante (« rester connecté ») et la protection contre les tentatives répétées. Gratuit, et utilisable aussi par la version Flutter de l'application. |
| **firebase-admin** | Vérification de l'identité côté serveur | Chaque requête à l'API porte un jeton Firebase signé ; le serveur vérifie sa signature pour connaître l'utilisateur de façon fiable. On ne fait jamais confiance à un identifiant envoyé par le navigateur. |
| **MongoDB Atlas** | Base de données de toutes les données | Base orientée documents : un animal avec ses photos, contacts et vétérinaire est un seul document JSON, proche des objets TypeScript. Schéma souple, adapté à six modules qui évoluent en parallèle. Requêtes riches (filtres, tris, recherche), index et transactions (ex. accepter une candidature d'adoption et réserver l'animal en une seule opération). Hébergé dans le cloud avec une offre gratuite. Firestore, utilisé au début, a été remplacé : ses requêtes sont plus limitées et la sécurité reposait sur des règles côté client, alors qu'avec MongoDB toute la logique d'accès est centralisée dans l'API. |
| **Firebase AI Logic + Gemini** | Assistant IA (chatbot) | Réutilise le projet Firebase déjà en place : pas de clé d'API d'IA à gérer sur un serveur. Offre gratuite (Gemini Developer API), réponses en continu, et appels de fonctions qui permettent à l'assistant de préparer des actions (rappel, pesée, réservation) que l'utilisateur confirme. Limite de 30 messages par jour et par utilisateur, appliquée par le serveur. |
| **@react-pdf/renderer** | Export PDF du carnet de santé | Génère le PDF dans le navigateur à partir de composants React : pagination automatique, tableaux, accents français. Plus simple que pdf-lib ou jsPDF, qui demandent de placer chaque ligne à la main. |
| **Tesseract.js** | Lecture d'une ordonnance ou d'une vignette de vaccin | Reconnaissance de texte (OCR) gratuite, sans quota, exécutée dans le navigateur : la photo ne quitte pas l'appareil de l'utilisateur. |
| **qrcode** | QR code du partage sécurisé du carnet | Petite bibliothèque sans dépendance pour afficher le lien de partage en QR code (vétérinaire, pet-sitter, urgence). |
| **ESLint** (`eslint-config-next`) | Qualité du code | Règles officielles de Next.js et React : détecte les erreurs courantes et garde un style homogène entre les six membres. |
| **node:test + tsx**, scripts `test-*.mjs` | Tests | Tests unitaires des règles métier sans aucune configuration, et tests d'API de bout en bout de chaque module sur un vrai serveur (comptes temporaires supprimés à la fin). |
| **Git + GitHub** | Travail en équipe | Une branche par module (`Users`, `services`, `chatbot`…), fusionnées dans `main` après vérification. |
| **Vercel** | Hébergement | Plateforme conçue pour Next.js : déploiement automatique depuis GitHub, HTTPS et routes API sans serveur à administrer. |
| **Node.js 24** | Environnement d'exécution | Version LTS exigée par Firebase 13 et firebase-admin. |

## Installation

Prérequis : Node.js **24 LTS ou plus récent** (Firebase 13 demande Node ≥ 24.12 ; testé aussi avec Node 26 LTS).

```bash
npm install
cp .env.local.example .env.local   # puis remplir (Firebase + MongoDB Atlas)
npm run dev                         # http://localhost:3000
```

| Variable | Où la trouver |
|---|---|
| `NEXT_PUBLIC_FIREBASE_*` | Console Firebase → Paramètres du projet → Vos applications |
| `MONGODB_URI` | MongoDB Atlas → Connect → Drivers (l'accès réseau du cluster doit autoriser votre adresse IP) |
| `MONGODB_DB` | `petcare` |

`.env.local` contient des secrets : il n'est **jamais** versionné (`.gitignore`). Demandez les valeurs à l'équipe
par un canal privé.

### Comptes de démonstration

`npm run seed:demo` crée des comptes déjà remplis (profil, animaux, carnets de santé, rendez-vous, rappels,
annonces d'adoption, prestataires et notifications). Mot de passe de tous les comptes : `DemoPetCare!2026`.

| Rôle | E-mail |
|---|---|
| Propriétaire (compte le plus complet : Rocky et Mimi) | `lina.demo@example.com` |
| Autres propriétaires | `youssef.demo@example.com`, `amira.demo@example.com`, `karim.demo@example.com` |
| Refuge | `refuge.demo@example.com` |
| Prestataires | `vet.demo@example.com`, `vet2.demo@example.com`, `toilettage.demo@example.com`, `animalerie.demo@example.com`, `garde.demo@example.com`, `pension.oliviers.demo@example.com` (en attente de validation) |
| Administrateur | `admin.petcare.demo@example.com` |

Les dates sont calculées à partir du jour du lancement : relancez le script la veille d'une démonstration.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Lancer le site en local |
| `npm run build` / `npm start` | Build de production / lancer le build |
| `npm run lint` | Vérifier le code |
| `npm run test:api` | Tester les routes Utilisateurs et Notifications (serveur lancé ; comptes temporaires, supprimés à la fin) |
| `npm run test:adoption` | Tester le module Adoption : règles d'accès et cycle complet d'une adoption |
| `npm run test:health` | Tester le module Carnet de santé : validation, droits sur l'animal, lecture seule des animaux archivés, pièces jointes, rappels de vaccin, onglet Santé, prises de traitement |
| `npm run test:rendez-vous` | Tester le module Rendez-vous et rappels : règles RG-12 à RG-21 et droits d'accès |
| `npm test` | Tests rapides sans serveur : validation des animaux, alerte de poids, services (créneaux, transitions), règles de l'onglet Santé, lecture des documents scannés |
| `npm run test:pets` | Tester le module Mes animaux : routes `/api/pets`, droits, photos, pesées, archivage, alerte de poids |
| `npm run test:services` | Tester le module Services : rôles, validation des profils, prestations, horaires, créneaux, réservations et agenda |
| `npm run seed:demo` | Comptes et données de démonstration (`lina.demo@example.com`, refuge, vétérinaires, toiletteur, animalerie, pension à valider, admin `admin.petcare.demo@example.com`…), mot de passe `DemoPetCare!2026` ; relançable, dates calculées à partir du jour même |
| `npm run seed:notifications -- <UID>` | Ajouter des notifications de démonstration à un compte |
| `npm run deploy:rules` | Publier `firestore.rules`, qui ferme Firestore (inutilisé) — après `npx firebase-tools login` |

Les scripts `test:*` s'exécutent contre un serveur lancé (`npm run dev` ou `npm start`, autre terminal) ;
`BASE_URL=https://… npm run test:api` pour viser un autre serveur.

## Structure

```
src/app/(auth)/          connexion, inscription, mot-de-passe-oublie (sans navigation)
src/app/(app)/           pages avec la navigation (accueil, profil, notifications, adoption, carnet, agenda…)
src/app/api/             routes API (contrôleurs) : seules à accéder à MongoDB
src/components/          composants React (ui/ partagés, puis un dossier par module)
src/lib/                 code navigateur : api() (appel des routes), fonctions et types de chaque module
src/lib/server/          code serveur uniquement : connexion MongoDB, vérification du jeton, modèle de chaque module
scripts/                 tests d'API et script de démonstration
docs/                    documentation technique
designs/stitch/          maquettes (capture + HTML exporté par écran)
```

## Modules

| Module | Pages | Routes API | Collections MongoDB |
|---|---|---|---|
| Utilisateurs & notifications | `/connexion`, `/inscription`, `/mot-de-passe-oublie`, `/profil`, `/notifications` | `/api/users/me`, `/api/notifications` | `users`, `notifications` |
| Communauté (hub) | `/communaute` | (lit `/api/adoption/…`) | — |
| Adoption | `/communaute/adoption/…` | `/api/adoption/…` | `adoptionListings`, `adoptionApplications`, `adoptionFavorites`, `happyTails`, `adoptionReports` |
| Santé & carnet de santé | `/carnet-de-sante` (onglet Santé), `/animaux/[id]/carnet-de-sante/…` | `/api/health-records/…` (dont `/summary`, `/[id]/doses`, `/shares`), `/api/partage/[token]` | `health_records`, `treatment_doses`, `health_shares` |
| Rendez-vous & rappels | `/rendez-vous`, `/rendez-vous/nouveau`, `/rendez-vous/[id]`, `/rappels` | `/api/appointments`, `/api/reminders` | `appointments`, `reminders` |
| Mes animaux | `/animaux`, `/animaux/nouveau`, `/animaux/[id]`, `/animaux/[id]/modifier` | `/api/pets/…` | `pets`, `petWeights` |
| Services | `/services`, `/services/[id]`, `/services/[id]/reserver`, `/services/mon-espace`, `/services/mes-reservations`, `/services/admin` | `/api/services/…` | `serviceCategories`, `serviceProviders`, `providerServices`, `providerAvailability`, `serviceBookings` |

Pas encore développé : **Perdus & Trouvés** (carte « Bientôt disponible » du hub Communauté).

Menu (barre du haut sur ordinateur, barre du bas sur mobile) : Accueil · Mes animaux · Santé · Communauté · Services.

### Utilisateurs & notifications — à utiliser dans les autres modules

```tsx
"use client";
import { useAuth } from "@/components/auth/AuthProvider";
const { user, profile, loading } = useAuth();
// profile : { uid, displayName, email, city, role: "proprietaire" | "prestataire" | "refuge" | "admin", … }
```

```tsx
import { RequireAuth } from "@/components/auth/RequireAuth";
<RequireAuth roles={["refuge"]}>…</RequireAuth>   // page réservée aux connectés (ou à certains rôles)
```

```ts
import { sendNotification } from "@/lib/notifications";
await sendNotification({
  userId: candidatId, type: "adoption", title: "Candidature acceptée pour Nala",
  body: "Le refuge Les Amis a accepté votre candidature.",
  link: "/communaute/adoption/mes-candidatures", actionLabel: "Voir ma candidature",
  showAt: new Date(rdv.getTime() - 24 * 3600_000), // facultatif : rappel programmé
});
```

Côté serveur (dans une route), utiliser `notifyUsers()` de `src/lib/server/notify.ts`. La notification apparaît
dans les 20 secondes (immédiatement pour ses propres actions), selon les préférences d'alerte du destinataire.
Pour donner le rôle admin : MongoDB Atlas → Browse Collections → `petcare.users` → champ `role`.

### Adoption

Fil, fiche, candidature en 4 étapes, mes candidatures, publier / modifier, mes annonces, candidatures reçues et
confirmation d'adoption, favoris, Happy Tails. Cycle d'une candidature : `envoyee` → `en-etude` → `acceptee`
(l'animal passe « Réservé ») → `adoptee` (les autres candidatures sont refusées automatiquement) ; le candidat peut la
retirer tant qu'elle est en attente. Chaque étape notifie l'autre partie. Le fil, les fiches et les Happy Tails sont
visibles sans compte. Photos compressées dans le navigateur (`src/lib/images.ts`) et stockées dans les documents.

### Carnet de santé

Actes médicaux par animal (visite, vaccin, examen, traitement, allergie, note) avec pièces jointes (PDF/JPG/PNG/WebP,
2 Mo max, 3 par acte). Un vaccin avec date de rappel crée une notification 7 jours avant l'échéance (remplacée si
l'acte change, supprimée avec l'acte). Chaque carnet appartient à un animal de « Mes animaux » : l'API vérifie que
l'animal est à l'utilisateur (sinon 404). Pour un animal **archivé**, le carnet est en lecture seule : ajout,
modification, suppression, pièces jointes et prises renvoient 409 ; la lecture et l'export PDF restent possibles.

**Onglet Santé** (`/carnet-de-sante`, une seule requête `GET /api/health-records/summary?day=AAAA-MM-JJ`) :

- Tableau de bord du jour : toutes les prises de traitement du jour, à cocher (`POST` / `DELETE
  /api/health-records/{id}/doses`, jour même ou veille), vaccins en retard et vaccins des 30 prochains jours.
- Une carte par animal actif : photo, statut vaccinal (« à jour », « bientôt » à 30 jours ou moins, « en retard »),
  traitements en cours et prises du jour faites / prévues, dernière visite et allergies. Tri : retard de vaccin, prises
  restantes, rappel proche, puis nom. Les animaux archivés sont dans une section repliée en bas.
- Règles de calcul (fonctions pures, `src/lib/health-summary.ts`) : pour chaque vaccin (même titre, casse ignorée),
  seule la dernière injection compte ; un traitement a des prises le jour J si `date ≤ J ≤ endDate` et
  `(J − date) % doseEveryDays = 0`.
- Prises : un traitement a des heures `doseTimes` (0 à 6, « HH:MM ») et un rythme `doseEveryDays` (1 à 30 jours),
  saisis dans le formulaire. Les prises cochées sont dans `treatment_doses` (index unique traitement + jour + heure).
  Elles ne sont pas recopiées en rappels : `/rappels` affiche seulement « Prises du jour : X/Y » vers l'onglet Santé.

**Export PDF** (bouton du carnet) : profil, vétérinaire référent (téléphone compris), vaccins et rappels, visites et
examens, allergies, traitements en cours et passés. Jamais l'e-mail ni le téléphone du propriétaire, ni les contacts
de la fiche. Généré dans le navigateur avec **@react-pdf/renderer** (chargé seulement au clic), puis « Partager »
(Web Share, si l'appareil le permet) ou « Enregistrer ». Choix : pdf-lib n'a pas de mise en page (pas de retour à la
ligne ni de pagination automatiques) ; jsPDF demande de placer chaque ligne à la main ; @react-pdf/renderer est
maintenu, compatible React 19, décrit le document en composants (pagination, en-têtes de tableau répétés) et ses
polices standard affichent les accents français.

**Partage sécurisé** (bouton « Partager » du carnet) : lien temporaire en lecture seule, avec QR code, pour un
vétérinaire, un pet-sitter ou une urgence. Le propriétaire choisit ce qu'il montre (*carnet complet*, ou *fiche
d'urgence* : allergies, traitements en cours, derniers vaccins, vétérinaire), la durée (24 h, 7 jours, 30 jours) et
peut le désactiver à tout moment ; il voit le nombre et la date des consultations. Le lien s'ouvre sans compte sur
`/partage/{jeton}`. Sécurité : jeton aléatoire de 256 bits affiché **une seule fois** (seule son empreinte SHA-256 est
stockée dans `health_shares`), 404 si inconnu, 410 si expiré ou désactivé, 10 liens actifs maximum par animal, page et
API non indexées et sans `Referer`. Jamais montrés : e-mail, téléphone ou nom du propriétaire, contacts de la fiche,
pièces jointes. Permis aussi pour un animal archivé (le lien montre le carnet, il ne le modifie pas).

**Scan d'ordonnance ou de vignette** (formulaire, types vaccin et traitement) : photo (appareil ou galerie), texte lu
**dans le navigateur** avec **Tesseract.js** (gratuit, sans quota, modèle français téléchargé au premier usage puis
gardé en cache), analyse heuristique (`src/lib/scan-parse.ts`) : intitulé, date (hors péremption et dates futures),
numéro de lot, vétérinaire. Seuls les champs vides sont remplis, signalés « à vérifier » ; rien n'est enregistré
automatiquement ; aucune posologie ni heure de prise n'est déduite. La photo compressée peut être jointe à l'acte.

### Rendez-vous & rappels

Agenda (semaine / mois, filtres), rendez-vous personnels (création, report avec motif, annulation, fin, rappel),
rappels de soins (« Fait », suppression). Règles RG-12 à RG-21 dans `src/lib/rendez-vous/rules.ts`, appliquées
dans le navigateur et par le serveur : pas deux rendez-vous du même animal sur le même créneau, report et annulation
avant le début, « Terminé » après l'heure de fin, contrôle de version contre les modifications simultanées.
Les réservations de prestataires (`providerId`) sont créées par le module Services (voir plus bas).

### Assistant IA

Page `/assistant` (bannière du fil d'adoption, carte de l'accueil). Gemini via **Firebase AI Logic**, Gemini Developer
API gratuite (jamais Vertex AI) ; modèle dans `src/lib/assistant/prompt.ts`. Visiteur : questions générales et
animaux à adopter proposés en cartes. Connecté : choix d'un animal (fiche et carnet de santé joints), questions
recommandées, rappels proposés, historique, avis 👍 / 👎, « ✨ Rédiger avec l'IA » dans le formulaire d'annonce.

Actions : l'assistant prépare un acte du carnet, un traitement, un rendez-vous, une pesée ou un rappel (appel de
fonction Gemini). S'il manque une information obligatoire, il la demande ; sinon une carte s'affiche et rien n'est
enregistré avant « Confirmer », qui passe par les mêmes routes que les formulaires (`/api/health-records`,
`/api/appointments`, `/api/pets/{id}/weights`, `/api/reminders`). Code : `src/lib/assistant/actions.ts` (champs et
vérifications, testé par `npm test`), `action-runner.ts`, `src/components/assistant/ActionCard.tsx`.

Réservation d'un service (`reserver_service`) : quand la conversation parle d'un prestataire ou d'une réservation,
les prestations publiées (annuaire Services, horaires compris) sont jointes à la question. Le modèle choisit une
prestation de cette liste (il demande laquelle s'il y en a plusieurs) ; prestataire, prix et adresse sont repris du
catalogue, jamais du modèle. Avant la carte, le créneau est vérifié avec `GET /api/services/providers/{id}/slots`
(jour fermé ou créneau pris → l'assistant propose les créneaux libres). « Confirmer » appelle
`POST /api/services/bookings`, comme la page de réservation : demande en attente, rendez-vous dans l'agenda,
prestataire notifié. Code : `src/lib/assistant/service-catalog.ts`. Un rendez-vous personnel (`creer_rendez_vous`)
reste une simple note d'agenda pour un rendez-vous pris en dehors de PetCare.

Données (MongoDB) : `assistantUsage` (30 messages par jour, limite appliquée par le serveur), `assistantChats` et
`assistantMessages` (10 dernières conversations) — routes `/api/assistant/usage` et `/api/assistant/chats/…`.

### Services

#### Fonctionnalités réalisées

**Annuaire (`/services`, public)**
- Grille des catégories (Vétérinaires, Toiletteurs, Promeneurs, Pensions, Boutiques, Autres par défaut), villes en
  puces, recherche (nom, catégorie, ville, description, prestation), tri (récents, nom, prix).
- Ouverture directe sur une catégorie : `/services?categorie=Vétérinaires` (utilisé par l'alerte de poids de Mes animaux).
- Carte prestataire : photo, badge « Vérifié », catégorie, adresse, « Ouvert • Ferme à 20:00 », « Consultation dès 45 DT ».

**Fiche prestataire (`/services/[id]`)** : couverture, « Prestataire vérifié », description, horaires (ouvert / fermé,
résumé de la semaine), adresse, Appeler / Message, paiement sur place, prestations & tarifs avec « Réserver ».

**Réservation (`/services/[id]/reserver`, connecté)** : prestation, compagnon choisi dans « Mes animaux » (ou autre
animal), bandeau de dates (jours fermés grisés), créneaux de 30 min (Tous / Matin / Après-midi, créneaux déjà pris
verrouillés), précisions ; la demande apparaît aussitôt dans l'agenda du client et du prestataire.

**Espace prestataire (`/services/mon-espace`, rôle `prestataire`)**
- Création du profil (photo, nom, catégorie, ville, adresse, téléphone, e-mail, présentation) qui part en validation ;
  toute modification, ou la correction d'un profil refusé, le renvoie en validation.
- Statut (en ligne et vérifié / en attente / refusé avec motif), compteurs (demandes en attente, confirmées du mois).
- Prestations (ex. toilettage « Bain complet & démêlage doux, 45 min, 35 DT ») : ajout, modification, archivage et
  réactivation ; durée de 5 min à 24 h (« 1 nuit » pour une pension).
- Créneaux de travail par jour (6 plages maximum, « Appliquer à toute la semaine »), heure de Tunis.
- Réservations reçues (en attente, confirmées, passées) : Confirmer / Refuser.

**Mes réservations (`/services/mes-reservations`)** : suivi des demandes, annulation tant qu'elles sont en attente.

**Administration (`/services/admin`, rôle `admin`)** : validation ou refus motivé des profils en attente ; catégories
(ajout, renommage reporté sur les profils et prestations, icône, ordre, suppression refusée si la catégorie est utilisée).

**Notifications `service`** : nouvelle demande, confirmation, refus, annulation, profil validé ou refusé.

#### API

| Route | Rôle |
|---|---|
| `GET /api/services/categories` · `POST` (admin) · `PUT` / `DELETE /api/services/categories/{id}` (admin) | catégories |
| `GET /api/services/providers?categorie=&ville=&q=` | annuaire public (avec horaires, nombre de prestations, prix minimum) |
| `GET /api/services/providers?status=pending` | profils en attente (admin) |
| `GET` / `PUT /api/services/providers/me` | son profil prestataire (créé ou modifié → `pending`) |
| `GET` / `POST /api/services/providers/me/services`, `PUT …/services/{serviceId}` | ses prestations (archivées comprises) |
| `GET` / `PUT /api/services/providers/me/availability` | ses disponibilités `{ days: [{ weekday, enabled, ranges }] }` |
| `GET /api/services/providers/{id}` | fiche : profil, prestations publiées, disponibilités |
| `PUT /api/services/providers/{id}/status` | `{ status: "published" ou "rejected", reason? }` (admin, profil en attente) |
| `GET /api/services/providers/{id}/slots?serviceId=&day=AAAA-MM-JJ` | créneaux libres |
| `GET /api/services/bookings?as=client` ou `?as=provider` · `POST` | réservations ; nouvelle demande |
| `PATCH /api/services/bookings/{id}/status` | `confirmed` / `declined` (prestataire), `cancelled` (client) |

Règles : seule une demande **en attente** change de statut (409 sinon) ; date à venir, dans les disponibilités, sans
chevauchement avec une autre réservation du prestataire ni un autre rendez-vous du même animal (409). Agenda :
`createBooking` (`src/lib/server/services.ts`) crée le rendez-vous « planned » (`providerId` = uid du prestataire)
dans `appointments` sans modifier le module Rendez-vous ; les statuts sont synchronisés dans les deux sens.
Tests : `npm test` (validation, créneaux, fuseau horaire, transitions) et `npm run test:services` (102 vérifications).

### Mes animaux

#### Fonctionnalités réalisées

**Liste (`/animaux`)**
- Onglets Actifs / Archivés avec compteurs, recherche (nom, race, espèce), filtre par espèce, tri par date ou par nom.
- Carte : photo de couverture (ou emoji de l'espèce), nom, sexe, espèce et race (ou l'animal saisi librement), âge
  (« 4 ans et 10 mois », « 8 mois », « 3 semaines »), stérilisation, dernier poids (« il y a 12 j »), favori.
- Badges Brouillon, Archivé et alerte de poids ; raccourcis Santé, Rendez-vous et Journal de poids.
- État vide avec bouton d'ajout ; invitation à se connecter pour un visiteur ; bouton « Ajouter » flottant sur mobile.

**Ajout et modification (`/animaux/nouveau`, `/animaux/[id]/modifier`)**
- Nom, espèce (puces avec emoji), race ou « Quel animal ? » obligatoire pour « Autre » (ex. « Ours »), sexe, stérilisation.
- Date de naissance (jamais future) estimée ou non, avec l'âge calculé ; puce de 15 chiffres ; notes (500 caractères).
- Vétérinaire référent saisi à la main (nom, clinique, adresse, téléphone).
- Jusqu'à 5 photos compressées dans le navigateur : réordonner, choisir la couverture, retirer.
- Poids facultatif enregistré comme pesée du jour (confirmation si l'écart dépasse 30 %).
- Enregistrement en brouillon (seul le nom est exigé), complété plus tard.
- Validation identique dans le formulaire et sur le serveur.

**Fiche (`/animaux/[id]`)**
- Galerie : grande photo, miniatures, zoom, ajout de photo, favori.
- Carte d'identité : statut, puce tronquée (afficher / copier), stérilisation, vétérinaire référent avec bouton d'appel.
- Notes modifiables sur place ; contacts utiles (5 maximum : ajout, suppression, appel, contact d'urgence).
- Partage limité (nom, espèce, race, sexe, âge ; jamais la puce, les notes ni les données médicales).
- Export de la fiche complète en page imprimable / PDF.
- Cartes Carnet de santé, Rendez-vous et Rappels reliées à ces modules ; Conseils « Bientôt disponible » (chatbot).

**Poids**
- Ajout d'une pesée avec date et note ; une seule pesée par jour (message clair sinon) ; confirmation au-delà de 30 % d'écart.
- Courbe des 6 dernières pesées, tendance, historique complet avec correction du poids et de la note (la date ne change
  pas) et suppression.

**Alerte intelligente de poids** (6 règles, détail plus bas)
- Calcul côté serveur à chaque pesée ajoutée, corrigée ou supprimée ; notification `sante` immédiate, une par épisode,
  une nouvelle si l'alerte s'aggrave.
- Bandeau sur la fiche (Prendre rendez-vous ou appeler le vétérinaire référent, Voir les vétérinaires, Sources, Ignorer)
  et badge sur la liste ; mention « ce n'est pas un diagnostic ».

**Archivage**
- Boîte de confirmation (motif facultatif) ; l'animal quitte les actifs, rien n'est supprimé.
- Un animal archivé se lit et se restaure ; toute autre modification est refusée (409) et l'interface masque les boutons.

**Tests** : `npm test` (36 tests : validation, âge, partage, toutes les règles de l'alerte) et `npm run test:pets`
(93 vérifications de l'API REST sur le serveur lancé : validation, accès d'un autre utilisateur, photos, contacts,
pesées, brouillon, archivage, chaque règle de l'alerte et absence de notification en double).

#### Pages et API

Pages (`src/app/(app)/animaux/`, réservées aux utilisateurs connectés) :

| Route | Écran |
|---|---|
| `/animaux` | liste : onglets Actifs / Archivés, recherche, filtre par espèce, tri, badge d'alerte de poids |
| `/animaux/nouveau` | ajout (brouillon possible) |
| `/animaux/[id]` | fiche : galerie, identité, puce, vétérinaire, notes, contacts, poids, alerte, partage, export, archivage |
| `/animaux/[id]/modifier` | modification |

Code : `src/lib/pets-models.ts` (types, validation partagée navigateur / serveur, âge), `src/lib/pet-weight-alert.ts`
(alerte de poids), `src/lib/pets.ts` (appels des routes), `src/lib/server/pets.ts` (collections, droits, recalcul de
l'alerte), `src/components/pets/` (composants). Tests : `tests/` (`npm test`) et `scripts/test-pets.mjs` (`npm run test:pets`).

**API pour les autres modules** (Santé, Rendez-vous, chatbot) — en-tête `Authorization: Bearer <jeton Firebase>`, via `api()` :

| Route | Rôle |
|---|---|
| `GET /api/pets` | ses animaux (tous statuts), avec la couverture (miniature), `latestWeight` et `weightAlert` |
| `POST /api/pets` | `{ pet, draft?, photos?, weight? }` : ajouter un animal |
| `GET /api/pets/{id}` | fiche complète (toutes les photos, contacts, vétérinaire, dernier poids, alerte) |
| `PUT /api/pets/{id}` | `{ pet, draft?, photoOrder?, weight? }` : modification du formulaire |
| `PATCH /api/pets/{id}` | `{ notes?, contacts?, favorite?, dismissAlert? }` |
| `POST /api/pets/{id}/archive`, `/restore` | archiver (`{ reason? }`) / restaurer |
| `POST /api/pets/{id}/photos` | `{ url, thumbnail }` (images compressées, data URL) ; 5 maximum |
| `DELETE /api/pets/{id}/photos/{fileId}`, `POST …/{fileId}/cover` | retirer une photo / en faire la couverture |
| `GET` / `POST /api/pets/{id}/weights` | pesées (plus récente d'abord) / ajouter `{ day, weightKg, note? }` (409 si le jour a déjà une pesée) |
| `PUT` / `DELETE /api/pets/{id}/weights/{weightId}` | corriger `{ weightKg, note? }` (la date ne change pas) / supprimer |

Règles : seul le propriétaire accède à ses animaux (403 sinon). Un animal n'est jamais supprimé ; archivé, il se lit et se
restaure mais toute autre modification renvoie 409. Format JSON : type `Pet` / `PetWeight` de `src/lib/pets-models.ts`.
Côté navigateur, utilisez directement `listPets()`, `getPet(id)`, `listWeights(id)`… de `src/lib/pets.ts`.

**Liens vers les autres modules** (`LINKED_MODULES`, `src/components/pets/ui.tsx`) :

| Bouton | Destination |
|---|---|
| Santé (liste), carte Carnet de santé (fiche) | `/animaux/{id}/carnet-de-sante?nom={nom}` (onglet Santé du menu : `/carnet-de-sante`) |
| Rendez-vous (liste), carte Rendez-vous (fiche) | agenda filtré sur l'animal : `/rendez-vous?animal={nom}` |
| « Prendre rendez-vous » du bandeau d'alerte de poids | `/rendez-vous/nouveau?animal={nom}` (animal prérempli) |
| Carte Rappels (fiche) | `/rappels` |
| « Voir les vétérinaires » du bandeau d'alerte de poids | annuaire ouvert sur la catégorie : `/services?categorie=Vétérinaires` |
| Conseils | « Bientôt disponible » (chatbot pas encore fusionné) |

À la fusion d'un module, renseignez son lien, par exemple ``assistant: (pet) => `/assistant?pet=${pet.id}` ``.

**Alerte intelligente de poids** : à chaque pesée ajoutée, corrigée ou supprimée, la dernière pesée est comparée aux pesées
des 90 jours précédents. Règles, de la plus grave à la moins grave :

| Règle | Condition | Conseil |
|---|---|---|
| `extreme` | variation ≥ 30 % en 7 jours | vérifier la saisie, consulter |
| `loss-10` | perte ≥ 10 % en 90 jours | consulter (VCA Hospitals) |
| `rapid-loss` | perte ≥ 5 % en 7 jours (≥ 3 % pour lapin, rongeur, oiseau) | consulter |
| `gain-20` | prise ≥ 20 % en 90 jours, adulte | consulter |
| `loss-5` | perte ≥ 5 % en 30 jours | surveiller |
| `gain-10` | prise ≥ 10 % en 90 jours, adulte (≈ 1 point de score corporel, AAHA / iCatCare) | surveiller |

Pas d'analyse avec moins de 2 pesées, pour un animal archivé ou si la dernière pesée a plus de 30 jours ; pas d'alerte de
prise avant 1 an ni pour un retour au poids habituel. Notification `sante` immédiate, une seule par épisode (animal + règle +
pesée de référence), une nouvelle si l'alerte s'aggrave. Bandeau sur la fiche, badge sur la liste. Ce n'est jamais un diagnostic.

## Design system

Les couleurs, tailles de texte et espacements de `src/app/globals.css` reprennent les noms des maquettes **Stitch**
(`bg-surface-container-low`, `text-on-surface`, `font-label-lg`…) : le HTML exporté par Stitch fonctionne tel quel.
Icônes : `<Icon name="pets" />` ([liste des icônes Material Symbols](https://fonts.google.com/icons)).
Maquettes : `designs/stitch/` ; guide : `designs/stitch/petcare_community/DESIGN.md`.
