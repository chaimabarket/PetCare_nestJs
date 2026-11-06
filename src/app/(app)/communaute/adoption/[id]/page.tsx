import { Suspense } from "react";
import { PageLoading } from "@/components/adoption/ui";
import { ListingDetail } from "./ListingDetail";

export default function AdoptionListingPage({ params }: PageProps<"/communaute/adoption/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      {params.then(({ id }) => (
        <ListingDetail id={id} />
      ))}
    </Suspense>
  );
}
