# PetCare Community — application web (Next.js)

Application pour gérer ses animaux, trouver des services, publier des annonces perdus/trouvés et faciliter les adoptions.
Stack : **Next.js 16** (App Router), **React 19**, **TypeScript**, **Tailwind CSS 4**, **Firebase Authentication**
(comptes et connexion) et **MongoDB Atlas** (toutes les données, via les routes `/api`).

➡️ Architecture technique détaillée (couches, conventions, sécurité, ajout d'un module) : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Installation

Prérequis : Node.js **24 LTS** (Firebase 13 demande Node ≥ 24.12).

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

Pas encore développés : **Mes animaux** (`/animaux`), **Communauté** (`/communaute`, perdus/trouvés) et **Services**
(`/services`) — les liens du menu mènent pour l'instant à une page 404.

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

## Design system

Les couleurs, tailles de texte et espacements de `src/app/globals.css` reprennent les noms des maquettes **Stitch**
(`bg-surface-container-low`, `text-on-surface`, `font-label-lg`…) : le HTML exporté par Stitch fonctionne tel quel.
Icônes : `<Icon name="pets" />` ([liste des icônes Material Symbols](https://fonts.google.com/icons)).
Maquettes : `designs/stitch/` ; guide : `designs/stitch/petcare_community/DESIGN.md`.
