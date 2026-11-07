"use client";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { ListingForm } from "@/components/adoption/ListingForm";
import { Breadcrumb } from "@/components/adoption/ui";
import { ADOPTION_ROUTES, PUBLISHER_ROLES } from "@/lib/adoption";

export default function PublishListingPage() {
  return (
    <RequireAuth roles={PUBLISHER_ROLES}>
      <div className="max-w-7xl mx-auto px-margin md:px-margin-md lg:px-margin-lg py-space-lg">
        <Breadcrumb
          items={[
            { label: "Adoption", href: ADOPTION_ROUTES.feed },
            { label: "Mes annonces", href: ADOPTION_ROUTES.myListings },
            { label: "Publier une annonce" },
          ]}
        />
        <h1 className="font-headline-lg text-headline-lg mb-space-lg">Publier une annonce d&apos;adoption</h1>
        <ListingForm />
      </div>
    </RequireAuth>
  );
}
