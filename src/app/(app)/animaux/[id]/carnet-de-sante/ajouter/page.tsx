import { Suspense } from "react";
import { PageLoading } from "@/components/sante/ui";
import { AddRecord } from "./AddRecord";

export default function AjouterActePage({ params }: PageProps<"/animaux/[id]/carnet-de-sante/ajouter">) {
  return (
    <Suspense fallback={<PageLoading />}>
      {params.then(({ id }) => (
        <AddRecord petId={id} />
      ))}
    </Suspense>
  );
}
