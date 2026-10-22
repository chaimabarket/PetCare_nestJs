"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";

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
      </div>
    );
  }

  // Le tableau de bord (animaux, rendez-vous, rappels) sera complété avec les autres modules.
  return (
    <div className="max-w-7xl mx-auto px-margin md:px-margin-md lg:px-margin-lg py-space-xl flex flex-col gap-space-lg">
      <h1 className="font-headline-lg text-headline-lg">Bonjour {profile?.displayName ?? user.displayName} 👋</h1>
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
