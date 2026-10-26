# PetCare Community — application web (Next.js)

Application pour gérer ses animaux, trouver des services, publier des annonces perdus/trouvés et faciliter les adoptions.
Stack : **Next.js 16** (App Router), **TypeScript**, **Tailwind CSS 4**, **Firebase** (Authentication + Firestore).

## Installation

Prérequis : Node.js **24 LTS** (Firebase 13 demande Node ≥ 24.12).

```bash
npm install
cp .env.local.example .env.local   # puis remplir avec la configuration Firebase du projet
npm run dev                         # http://localhost:3000
```

Les valeurs de `.env.local` sont dans la console Firebase → Paramètres du projet → Vos applications.
Ce fichier n'est pas versionné : demandez-le à l'équipe.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Lancer le site en local |
| `npm run build` | Build de production |
| `npm run lint` | Vérifier le code |
| `npm run deploy:rules` | Publier `firestore.rules` (après `npx firebase-tools login`) |
| `npm run test:firebase` | Tester les règles de sécurité Firestore (comptes temporaires, supprimés à la fin) |
| `npm run seed:notifications -- <UID>` | Ajouter des notifications de démonstration à un compte |

## Structure

```
src/app/(auth)/        connexion, inscription, mot-de-passe-oublie (sans navigation)
src/app/(app)/         pages avec la navigation : accueil, profil, notifications…
src/components/ui/     composants partagés : Button, TextField, Card, Alert, Toggle, Avatar, Icon
src/components/auth/   AuthProvider, RequireAuth, AccountMenu
src/lib/               firebase, users, notifications, validation, dates
firestore.rules        règles de sécurité (chaque module ajoute ses collections)
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

Le destinataire voit la notification en temps réel (cloche + `/notifications`), selon ses préférences d'alerte.

## Firestore

| Collection | Contenu | Accès |
|---|---|---|
| `users/{uid}` | profil, rôle, préférences d'alerte | lecture/modification par le propriétaire (le rôle ne peut pas être changé) ; admin |
| `notifications/{id}` | `userId`, `type`, `title`, `body`, `link`, `read`, `showAt`… | lecture/suppression par le destinataire ; création par tout utilisateur connecté en son nom |

Pour donner le rôle admin : modifier le champ `role` du document `users/{uid}` dans la console Firebase.
