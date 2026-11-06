# PetCare Community — application web (Next.js)

Application pour gérer ses animaux, trouver des services, publier des annonces perdus/trouvés et faciliter les adoptions.
Stack : **Next.js 16** (App Router), **TypeScript**, **Tailwind CSS 4**, **Firebase Authentication** (comptes et connexion), **MongoDB Atlas** (données, via les routes `/api`).

## Installation

Prérequis : Node.js **24 LTS** (Firebase 13 demande Node ≥ 24.12).

```bash
npm install
cp .env.local.example .env.local   # puis remplir (Firebase + MongoDB)
npm run dev                         # http://localhost:3000
```

Les valeurs `NEXT_PUBLIC_FIREBASE_*` sont dans la console Firebase → Paramètres du projet → Vos applications.
`MONGODB_URI` vient de MongoDB Atlas → Connect → Drivers ; ajoutez aussi votre adresse IP dans Atlas → Network Access.
Ce fichier n'est pas versionné : demandez-le à l'équipe.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Lancer le site en local |
| `npm run build` | Build de production |
| `npm run lint` | Vérifier le code |
| `npm run test:api` | Tester les règles d'accès des routes `/api` (serveur `npm run dev` lancé ; comptes temporaires, supprimés à la fin) |
| `npm run deploy:rules` | Publier `firestore.rules`, qui ferme Firestore (après `npx firebase-tools login`) |
| `npm run seed:notifications -- <UID>` | Ajouter des notifications de démonstration à un compte |

## Structure

```
src/app/(auth)/        connexion, inscription, mot-de-passe-oublie (sans navigation)
src/app/(app)/         pages avec la navigation : accueil, profil, notifications…
src/components/ui/     composants partagés : Button, TextField, Card, Alert, Toggle, Avatar, Icon
src/components/auth/   AuthProvider, RequireAuth, AccountMenu
src/app/api/           routes API : seules à accéder à MongoDB, vérifient qui appelle et ce qui est permis
src/lib/               firebase (auth), api (appel des routes), models (types partagés), users, notifications…
src/lib/server/        connexion MongoDB, vérification du jeton Firebase (code serveur uniquement)
```

## Design system

Les couleurs, tailles de texte et espacements de `src/app/globals.css` reprennent les noms des maquettes **Stitch**
(`bg-surface-container-low`, `text-on-surface`, `font-label-lg`…) : le HTML exporté par Stitch fonctionne tel quel.
Icônes : `<Icon name="pets" />` ([liste des icônes Material Symbols](https://fonts.google.com/icons)).

Les maquettes sont dans `designs/stitch/` : un dossier par écran, avec la capture (`screen.png`) et le HTML exporté (`code.html`).
Le guide du design system est dans `designs/stitch/petcare_community/DESIGN.md`.

## Module Utilisateurs — à utiliser dans les autres modules

**Utilisateur connecté**

```tsx
"use client";
import { useAuth } from "@/components/auth/AuthProvider";

const { user, profile, loading } = useAuth();
// profile : { uid, displayName, email, city, role: "proprietaire" | "prestataire" | "refuge" | "admin", … }
```

**Page réservée aux utilisateurs connectés (ou à certains rôles)**

```tsx
import { RequireAuth } from "@/components/auth/RequireAuth";

<RequireAuth roles={["refuge"]}>…</RequireAuth>
```

**Envoyer une notification**

```ts
import { sendNotification } from "@/lib/notifications";

await sendNotification({
  userId: candidatId,                 // destinataire
  type: "adoption",                   // rendez-vous | rappel | sante | adoption | perdu-trouve | service
  title: "Candidature acceptée pour Nala",
  body: "Le refuge Les Amis a accepté votre candidature.",
  link: "/communaute/adoption/mes-candidatures",
  actionLabel: "Voir ma candidature",
  showAt: new Date(rdv.getTime() - 24 * 3600_000), // facultatif : rappel programmé
});
```

Le destinataire voit la notification dans les 20 secondes (immédiatement pour ses propres actions) (cloche + `/notifications`), selon ses préférences d'alerte.

## Données (MongoDB)

Le navigateur n'accède jamais directement à MongoDB : il appelle les routes `/api/...` avec le jeton Firebase de
l'utilisateur (`api()` dans `src/lib/api.ts`), et chaque route vérifie ce jeton (`requireUser`) puis les droits.

| Collection | Contenu | Accès |
|---|---|---|
| `users` (`_id` = uid Firebase) | profil, rôle, préférences d'alerte | lecture/modification par le propriétaire (le rôle ne peut pas être changé) ; admin |
| `notifications` | `userId`, `type`, `title`, `body`, `link`, `read`, `showAt`… | lecture/suppression par le destinataire ; création par tout utilisateur connecté en son nom |
| `adoptionListings` | annonce d'adoption : animal, photos, histoire, compatibilité, `status`, `ownerId`, `adopterId`… | lecture publique (disponible, réservé, adopté) ; brouillons et archives par l'auteur ; création par un propriétaire ou un refuge |
| `adoptionApplications` | candidature : réponses Logement / Foyer / Mode de vie, `status` (une seule par annonce et par candidat) | lecture par le candidat et l'auteur de l'annonce ; le candidat peut seulement retirer, l'auteur fait avancer le statut |
| `adoptionFavorites` | favoris (un par utilisateur et par annonce) | propriétaire uniquement |
| `happyTails` (`_id` = id de l'annonce) | histoire « avant / après », `likedBy` | lecture publique ; création par l'adoptant ; chacun ajoute/retire son cœur |
| `adoptionReports` | signalements d'annonces et d'histoires | création par tout utilisateur connecté ; lecture admin |

Pour donner le rôle admin : MongoDB Atlas → Browse Collections → `petcare.users` → modifier le champ `role` du document.

**Ajouter une collection pour un module** : déclarer le type du document et la collection dans `src/lib/server/mongo.ts`,
créer les routes dans `src/app/api/<module>/` (sur le modèle de `api/notifications`, avec `handle` et `requireUser`),
puis les appeler côté navigateur avec `api()`.

## Module Adoption

Pages (`src/app/(app)/communaute/adoption/`) :

| Route | Écran |
|---|---|
| `/communaute/adoption` | fil des annonces, recherche et filtres (5.1, 5.2) |
| `/communaute/adoption/[id]` | fiche d'adoption (5.3) |
| `/communaute/adoption/[id]/candidature` | candidature en 4 étapes (5.4 → 5.7) |
| `/communaute/adoption/mes-candidatures` | suivi de mes candidatures (5.8) |
| `/communaute/adoption/publier`, `/[id]/modifier` | publier / modifier une annonce (5.9) |
| `/communaute/adoption/mes-annonces` | mes annonces (5.10) |
| `/communaute/adoption/[id]/candidatures` | candidatures reçues, détail, confirmation d'adoption (5.11 → 5.13) |
| `/communaute/adoption/favoris` | mes favoris (5.14) |
| `/communaute/adoption/happy-tails`, `/[id]/happy-tail` | Happy Tails et partage d'une histoire (5.15, 5.16) |

Code : `src/lib/adoption.ts` (fonctions appelées par les pages, via les routes `src/app/api/adoption/`), `src/lib/adoption-compatibility.ts` (score de compatibilité,
aide à la décision), `src/lib/images.ts` (photos compressées dans le navigateur et stockées dans les documents MongoDB), `src/components/adoption/` (composants).

Cycle d'une candidature : `envoyee` → `en-etude` (ouverture par l'auteur) → `acceptee` (l'animal passe « Réservé »)
→ `adoptee` (les autres candidatures sont refusées automatiquement). Le candidat peut la retirer tant qu'elle est en attente.
Chaque étape envoie une notification de type `adoption`.
