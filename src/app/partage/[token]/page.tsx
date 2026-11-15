import { Suspense } from "react";
import { PageLoading } from "@/components/sante/ui";
import { SharedBook } from "./SharedBook";

export default function PartagePage({ params }: PageProps<"/partage/[token]">) {
  return (
    <Suspense fallback={<PageLoading label="Ouverture du carnet partagé…" />}>
      {params.then(({ token }) => (
        <SharedBook token={token} />
      ))}
    </Suspense>
  );
}
