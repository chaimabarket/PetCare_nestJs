import { Suspense } from "react";
import { LoadingState } from "@/components/pets/ui";
import { EditPet } from "./EditPet";

export default function EditPetPage({ params }: PageProps<"/animaux/[id]/modifier">) {
  return <Suspense fallback={<LoadingState />}>{params.then(({ id }) => <EditPet id={id} />)}</Suspense>;
}
