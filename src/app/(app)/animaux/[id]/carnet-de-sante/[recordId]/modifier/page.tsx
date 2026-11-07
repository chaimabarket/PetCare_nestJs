import { Suspense } from "react";
import { PageLoading } from "@/components/sante/ui";
import { EditRecord } from "./EditRecord";

export default function ModifierActePage({ params }: PageProps<"/animaux/[id]/carnet-de-sante/[recordId]/modifier">) {
  return (
    <Suspense fallback={<PageLoading />}>
      {params.then(({ id, recordId }) => (
        <EditRecord petId={id} recordId={recordId} />
      ))}
    </Suspense>
  );
}
