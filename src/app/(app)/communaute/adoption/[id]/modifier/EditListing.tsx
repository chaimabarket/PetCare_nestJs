"use client";

import { useCallback } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAsync } from "@/components/adoption/hooks";
import { ListingForm } from "@/components/adoption/ListingForm";
import { Breadcrumb, PageLoading } from "@/components/adoption/ui";
import { Alert } from "@/components/ui/Card";
import { ADOPTION_ROUTES, getListing, PUBLISHER_ROLES } from "@/lib/adoption";

export function EditListing({ id }: { id: string }) {
  return (
    <RequireAuth roles={PUBLISHER_ROLES}>
      <Editor id={id} />
    </RequireAuth>
  );
}

function Editor({ id }: { id: string }) {
  const { user } = useAuth();
  const load = useCallback(() => getListing(id), [id]);
  const { data: listing, error, loading } = useAsync(load);

  if (loading) return <PageLoading />;

  let problem = error;
  if (!problem && (!listing || listing.ownerId !== user?.uid)) problem = "Cette annonce est introuvable ou ne vous appartient pas.";
  else if (!problem && listing?.status === "adoptee") problem = "Une annonce adoptée ne peut plus être modifiée.";

  return (
    <div className="max-w-7xl mx-auto px-margin md:px-margin-md lg:px-margin-lg py-space-lg">
      <Breadcrumb
        items={[
          { label: "Adoption", href: ADOPTION_ROUTES.feed },
          { label: "Mes annonces", href: ADOPTION_ROUTES.myListings },
          { label: listing ? `Modifier ${listing.name}` : "Modifier" },
        ]}
      />
      {problem || !listing ? (
        <Alert>{problem}</Alert>
      ) : (
        <>
          <h1 className="font-headline-lg text-headline-lg mb-space-lg">Modifier l&apos;annonce de {listing.name}</h1>
          <ListingForm listing={listing} />
        </>
      )}
    </div>
  );
}
