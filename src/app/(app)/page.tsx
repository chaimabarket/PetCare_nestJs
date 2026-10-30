"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";

/** Accès à l'assistant IA (maquette Stitch M1), pour les visiteurs comme pour les membres. */
function AssistantCard() {
  return (
    <Link
      href="/assistant"
      className="flex items-center gap-space-md rounded-2xl bg-primary-container text-on-primary p-space-lg shadow-sm hover:shadow-md transition-shadow"
    >
      <span className="w-12 h-12 rounded-full bg-surface-container-lowest text-primary flex items-center justify-center shrink-0">
        <Icon name="pets" filled className="text-[26px]" />
      </span>
      <span className="flex-1">
        <span className="block font-headline-sm text-headline-sm">Assistant PetCare</span>
        <span className="block font-body-md text-body-md text-on-primary-container">
          Une question sur votre animal ? Demandez-moi !
        </span>
      </span>
      <span className="hidden sm:inline-flex items-center h-10 px-space-md rounded-full bg-surface-container-lowest text-primary font-label-lg text-label-lg">
        Discuter
      </span>
    </Link>
  );
}

export default function AccueilPage() {
  const { user, profile, loading } = useAuth();

  if (loading) return <p className="p-space-xl text-center text-on-surface-variant">Chargement…</p>;

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-margin md:px-margin-md lg:px-margin-lg py-space-xl">
        <Card className="mx-auto flex max-w-xl flex-col items-center gap-space-md text-center p-space-xl">
          <span className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center">
            <Icon name="pets" filled className="text-on-primary text-[32px]" />
          </span>
          <h1 className="font-headline-lg text-headline-lg">Bienvenue sur PetCare Community</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            Consultez les annonces et les services librement. Créez un compte pour gérer vos animaux,
            réserver ou publier.
          </p>
          <div className="flex flex-wrap justify-center gap-space-sm">
            <Link
              href="/inscription"
              className="inline-flex items-center h-11 px-space-lg rounded-full bg-primary text-on-primary font-label-lg text-label-lg hover:bg-primary-container"
            >
              Créer un compte
            </Link>
            <Link
              href="/connexion"
              className="inline-flex items-center h-11 px-space-lg rounded-full bg-surface-container-low text-primary font-label-lg text-label-lg hover:bg-surface-container"
            >
              Se connecter
            </Link>
          </div>
        </Card>
        <div className="mx-auto mt-space-lg max-w-xl">
          <AssistantCard />
        </div>
      </div>
    );
  }

  // Le tableau de bord (animaux, rendez-vous, rappels) sera complété avec les autres modules.
  return (
    <div className="max-w-7xl mx-auto px-margin md:px-margin-md lg:px-margin-lg py-space-xl flex flex-col gap-space-lg">
      <h1 className="font-headline-lg text-headline-lg">Bonjour {profile?.displayName ?? user.displayName} 👋</h1>
      <AssistantCard />
      <div className="grid gap-space-lg md:grid-cols-2">
        <Card>
          <h2 className="font-headline-sm text-headline-sm">Mes animaux</h2>
          <p className="mt-2 text-on-surface-variant">Bientôt disponible.</p>
        </Card>
        <Card>
          <h2 className="font-headline-sm text-headline-sm">Prochains rendez-vous</h2>
          <p className="mt-2 text-on-surface-variant">Bientôt disponible.</p>
        </Card>
      </div>
    </div>
  );
}
