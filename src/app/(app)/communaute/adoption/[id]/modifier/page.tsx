import { Suspense } from "react";
import { PageLoading } from "@/components/adoption/ui";
import { EditListing } from "./EditListing";

export default function EditListingPage({ params }: PageProps<"/communaute/adoption/[id]/modifier">) {
  return (
    <Suspense fallback={<PageLoading />}>
      {params.then(({ id }) => (
        <EditListing id={id} />
      ))}
    </Suspense>
  );
}
