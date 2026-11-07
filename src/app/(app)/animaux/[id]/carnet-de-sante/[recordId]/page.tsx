import { Suspense } from "react";
import { PageLoading } from "@/components/sante/ui";
import { RecordDetail } from "./RecordDetail";

export default function ActeMedicalPage({ params }: PageProps<"/animaux/[id]/carnet-de-sante/[recordId]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      {params.then(({ id, recordId }) => (
        <RecordDetail petId={id} recordId={recordId} />
      ))}
    </Suspense>
  );
}
