"use client";

import { useCallback } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAsync, useFavorites } from "@/components/adoption/hooks";
import { ListingCard } from "@/components/adoption/ListingCard";
import { Breadcrumb, ButtonLink, EmptyState, PageLoading } from "@/components/adoption/ui";
import { Alert } from "@/components/ui/Card";
import { ADOPTION_ROUTES, listFavoriteListings } from "@/lib/adoption";

export default function FavoritesPage() {
  return (
    <RequireAuth>
      <Favorites />
    </RequireAuth>
  );
}

function Favorites() {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const load = useCallback(() => listFavoriteListings(uid), [uid]);
  const { data, error, loading } = useAsync(load);
  const { isFavorite, toggle } = useFavorites();
  // Un favori retiré reste affiché (cœur vide) jusqu'au prochain chargement, pour pouvoir le rétablir.
  const listings = data ?? [];

  return (
    <div className="max-w-7xl mx-auto px-margin md:px-margin-md lg:px-margin-lg py-space-lg">
      <Breadcrumb items={[{ label: "Adoption", href: ADOPTION_ROUTES.feed }, { label: "Mes favoris" }]} />
      <h1 className="font-headline-lg text-headline-lg mb-space-xs">Mes favoris</h1>
      <p className="font-body-lg text-body-lg text-on-surface-variant mb-space-lg">Les animaux qui ont touché votre cœur.</p>

      {error && <Alert>{error}</Alert>}
      {loading ? (
        <PageLoading />
      ) : listings.length === 0 ? (
        <EmptyState
          icon="favorite"
          title="Aucun favori pour l'instant"
          text="Touchez le cœur d'une annonce pour la retrouver ici."
          action={<ButtonLink href={ADOPTION_ROUTES.feed}>Découvrir les animaux</ButtonLink>}
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-space-sm md:gap-space-md">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              favorite={isFavorite(listing.id)}
              onToggleFavorite={() => toggle(listing.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
