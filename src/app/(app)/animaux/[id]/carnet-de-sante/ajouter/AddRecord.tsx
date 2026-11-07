"use client";

import { useSearchParams } from "next/navigation";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { RecordForm } from "@/components/sante/RecordForm";
import { Breadcrumb, carnetHref, pageClass, usePet } from "@/components/sante/ui";

export function AddRecord({ petId }: { petId: string }) {
  return (
    <RequireAuth>
      <AddRecordContent petId={petId} />
    </RequireAuth>
  );
}

function AddRecordContent({ petId }: { petId: string }) {
  const nameParam = useSearchParams().get("nom") ?? undefined;
  const { name } = usePet(petId, nameParam);
  const back = carnetHref(petId, name);

  return (
    <div className={`${pageClass} max-w-4xl`}>
      <Breadcrumb
        items={[
          { label: "Carnets de santé", href: "/carnet-de-sante" },
          { label: name, href: back },
          { label: "Ajouter un acte médical" },
        ]}
      />
      <RecordForm petId={petId} petName={name} backHref={back} />
    </div>
  );
}
