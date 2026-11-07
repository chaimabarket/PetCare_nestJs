"use client";

import Link from "next/link";
import { useCallback } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PetForm } from "@/components/pets/PetForm";
import { Breadcrumb, ErrorState, LoadingState, useLoad } from "@/components/pets/ui";
import { Icon } from "@/components/ui/Icon";
import { getPet, PET_ROUTES } from "@/lib/pets";

export function EditPet({ id }: { id: string }) {
  return (
    <RequireAuth>
      <EditPetContent id={id} />
    </RequireAuth>
  );
}

function EditPetContent({ id }: { id: string }) {
  const load = useCallback(() => getPet(id), [id]);
  const { data: pet, error, loading, reload } = useLoad(load);

  return (
    <div className="w-full max-w-4xl mx-auto px-margin md:px-margin-md lg:px-margin-lg py-space-xl flex flex-col gap-space-lg">
      <Breadcrumb
        items={[
          { label: "Mes animaux", href: PET_ROUTES.list },
          ...(pet ? [{ label: pet.name, href: PET_ROUTES.pet(pet.id) }] : []),
          { label: "Modifier" },
        ]}
      />
      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {pet?.status === "archived" && (
        <div className="bg-surface-container-lowest rounded-2xl p-space-xl shadow-sm flex flex-col items-center text-center gap-space-md">
          <Icon name="inventory_2" className="text-[40px] text-on-surface-variant" />
          <p className="font-body-lg text-body-lg text-on-surface">
            La fiche de {pet.name} est archivée : restaurez-la depuis sa fiche pour la modifier.
          </p>
          <Link href={PET_ROUTES.pet(pet.id)} className="font-label-lg text-label-lg text-primary underline">
            Retour à la fiche
          </Link>
        </div>
      )}
      {pet && pet.status !== "archived" && <PetForm pet={pet} />}
    </div>
  );
}
