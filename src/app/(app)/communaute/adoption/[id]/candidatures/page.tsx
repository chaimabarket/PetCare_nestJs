import { Suspense } from "react";
import { PageLoading } from "@/components/adoption/ui";
import { ReceivedApplications } from "./ReceivedApplications";

export default function ReceivedApplicationsPage({ params }: PageProps<"/communaute/adoption/[id]/candidatures">) {
  return (
    <Suspense fallback={<PageLoading />}>
      {params.then(({ id }) => (
        <ReceivedApplications id={id} />
      ))}
    </Suspense>
  );
}
