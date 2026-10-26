import { Suspense } from "react";
import { PageLoading } from "@/components/adoption/ui";
import { ApplicationForm } from "./ApplicationForm";

export default function AdoptionApplicationPage({ params }: PageProps<"/communaute/adoption/[id]/candidature">) {
  return (
    <Suspense fallback={<PageLoading />}>
      {params.then(({ id }) => (
        <ApplicationForm id={id} />
      ))}
    </Suspense>
  );
}
