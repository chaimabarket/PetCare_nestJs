import { Suspense } from "react";
import { PageLoading } from "@/components/sante/ui";
import { HealthBook } from "./HealthBook";

export default function CarnetDeSantePage({ params }: PageProps<"/animaux/[id]/carnet-de-sante">) {
  return (
    <Suspense fallback={<PageLoading />}>
      {params.then(({ id }) => (
        <HealthBook petId={id} />
      ))}
    </Suspense>
  );
}
