import { Suspense } from "react";
import { LoadingState } from "@/components/pets/ui";
import { PetDetail } from "./PetDetail";

export default function PetPage({ params }: PageProps<"/animaux/[id]">) {
  return <Suspense fallback={<LoadingState />}>{params.then(({ id }) => <PetDetail id={id} />)}</Suspense>;
}
