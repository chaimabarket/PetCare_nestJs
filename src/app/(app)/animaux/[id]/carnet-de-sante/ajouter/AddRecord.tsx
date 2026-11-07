"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { RecordForm } from "@/components/sante/RecordForm";
import { Breadcrumb, carnetHref, PageLoading, pageClass, usePet } from "@/components/sante/ui";

export function AddRecord({ petId }: { petId: string }) {
  return (
    <RequireAuth>
      <AddRecordContent petId={petId} />
    </RequireAuth>
  );
}

function AddRecordContent({ petId }: { petId: string }) {
  const nameParam = useSearchParams().get("nom") ?? undefined;
  const router = useRouter();
  const { name, loaded, readOnly } = usePet(petId, nameParam);
  const back = carnetHref(petId, name);

  // Carnet d'un animal archivé : lecture seule, retour au carnet.
  useEffect(() => {
    if (readOnly) router.replace(back);
  }, [readOnly, router, back]);

  if (!loaded || readOnly) return <PageLoading />;

  return (
    <div className={`${pageClass} max-w-4xl`}>
      <Breadcrumb
        items={[
          { label: "Santé", href: "/carnet-de-sante" },
          { label: name, href: back },
          { label: "Ajouter un acte médical" },
        ]}
      />
      <RecordForm petId={petId} petName={name} backHref={back} />
    </div>
  );
}
