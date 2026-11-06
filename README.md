# PetCare Community — application web (Next.js)

Application pour gérer ses animaux, trouver des services, publier des annonces perdus/trouvés et faciliter les adoptions.
Stack : **Next.js 16** (App Router), **TypeScript**, **Tailwind CSS 4**, **Firebase Authentication** (comptes et connexion), **MongoDB Atlas** (données, via les routes `/api`).

## Installation

Prérequis : Node.js **24 LTS ou plus récent** (Firebase 13 demande Node ≥ 24.12 ; testé aussi avec Node 26 LTS).

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
| `npm run test:adoption` | Tester le module Adoption : règles d'accès et cycle complet d'une adoption (même principe) |
| `npm test` | Tests rapides sans serveur : validation des animaux et alerte de poids |
| `npm run test:pets` | Tester les routes `/api/pets` (serveur `npm run dev` lancé ; comptes temporaires, supprimés à la fin) |
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
| `pets` | animal : identité, photos, contacts, vétérinaire, `status` (`draft` / `active` / `archived`), alerte de poids | propriétaire uniquement ; jamais supprimé (archivage) |
| `petWeights` | pesées : `petId`, `day` (AAAA-MM-JJ), `weightKg`, `note` — une par animal et par jour | propriétaire uniquement |

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
Chaque étape envoie une notification de type `adoption` (envoyée par le serveur).

Routes API (`src/app/api/adoption/`) : `listings` (fil, publication, `mine`, `[id]` avec les actions
`update` / `archive` / `republish`), `applications` (`?scope=mine|received`, `[id]` avec les actions `withdraw`,
`review`, `accept`, `refuse`, `cancel-acceptance`, `confirm-adoption`), `favorites`, `happy-tails`, `stats`, `reports`.
Les règles d'accès sont dans `src/lib/server/adoption.ts` et dans chaque route ; les changements qui touchent
plusieurs documents (accepter, confirmer, archiver) sont faits dans une transaction MongoDB.

## Module Mes animaux

### Fonctionnalités réalisées

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

### Pages et API

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
