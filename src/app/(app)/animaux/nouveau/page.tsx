"use client";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { PetForm } from "@/components/pets/PetForm";
import { Breadcrumb } from "@/components/pets/ui";
import { PET_ROUTES } from "@/lib/pets";

export default function AddPetPage() {
  return (
    <RequireAuth>
      <div className="w-full max-w-4xl mx-auto px-margin md:px-margin-md lg:px-margin-lg py-space-xl flex flex-col gap-space-lg">
        <Breadcrumb items={[{ label: "Mes animaux", href: PET_ROUTES.list }, { label: "Ajouter un animal" }]} />
        <PetForm />
      </div>
    </RequireAuth>
  );
}
