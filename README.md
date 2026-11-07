# PetCare Community — application web (Next.js)

Application pour gérer ses animaux, trouver des services, publier des annonces perdus/trouvés et faciliter les adoptions.
Stack : **Next.js 16** (App Router), **React 19**, **TypeScript**, **Tailwind CSS 4**, **Firebase Authentication**
(comptes et connexion) et **MongoDB Atlas** (toutes les données, via les routes `/api`).

➡️ Architecture technique détaillée (couches, conventions, sécurité, ajout d'un module) : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

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

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Lancer le site en local |
| `npm run build` / `npm start` | Build de production / lancer le build |
| `npm run lint` | Vérifier le code |
| `npm run test:api` | Tester les routes Utilisateurs et Notifications (serveur lancé ; comptes temporaires, supprimés à la fin) |
| `npm run test:adoption` | Tester le module Adoption : règles d'accès et cycle complet d'une adoption |
| `npm run test:health` | Tester le module Carnet de santé : validation, droits, pièces jointes, rappels de vaccin |
| `npm run test:rendez-vous` | Tester le module Rendez-vous et rappels : règles RG-12 à RG-21 et droits d'accès |
| `npm test` | Tests rapides sans serveur : validation des animaux et alerte de poids |
| `npm run test:pets` | Tester le module Mes animaux : routes `/api/pets`, droits, photos, pesées, archivage, alerte de poids |
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
| Adoption | `/communaute/adoption/…` | `/api/adoption/…` | `adoptionListings`, `adoptionApplications`, `adoptionFavorites`, `happyTails`, `adoptionReports` |
| Carnet de santé | `/carnet-de-sante`, `/animaux/[id]/carnet-de-sante/…` | `/api/health-records/…` | `health_records` |
| Rendez-vous & rappels | `/rendez-vous`, `/rendez-vous/nouveau`, `/rendez-vous/[id]`, `/rappels` | `/api/appointments`, `/api/reminders` | `appointments`, `reminders` |
| Mes animaux | `/animaux`, `/animaux/nouveau`, `/animaux/[id]`, `/animaux/[id]/modifier` | `/api/pets/…` | `pets`, `petWeights` |

Pas encore développés : **Communauté** (`/communaute`, perdus/trouvés) et **Services** (`/services`) — les liens
du menu mènent pour l'instant à une page 404.

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
l'acte change, supprimée avec l'acte). En attendant le module Mes animaux, un carnet est créé depuis
`/carnet-de-sante` en indiquant le nom de l'animal (`listMyPets()` / `getPet()` à brancher sur ce module).

### Rendez-vous & rappels

Agenda (semaine / mois, filtres), rendez-vous personnels (création, report avec motif, annulation, fin, rappel),
rappels de soins (« Fait », suppression). Règles RG-12 à RG-21 dans `src/lib/rendez-vous/rules.ts`, appliquées
dans le navigateur et par le serveur : pas deux rendez-vous du même animal sur le même créneau, report et annulation
avant le début, « Terminé » après l'heure de fin, contrôle de version contre les modifications simultanées.
Les réservations de prestataires (`providerId`) sont prêtes côté API pour le futur module Services.

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
- Cartes Carnet de santé, Rendez-vous, Rappels et Conseils (« Bientôt disponible » tant que ces modules manquent).

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

**Liens vers les autres modules** : les cartes Carnet de santé, Rendez-vous, Rappels, Conseils et « Voir les
vétérinaires » affichent « Bientôt disponible ». À la fusion d'un module, renseignez son lien dans `LINKED_MODULES`
(`src/components/pets/ui.tsx`), par exemple ``assistant: (id) => `/assistant?pet=${id}` ``.

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
