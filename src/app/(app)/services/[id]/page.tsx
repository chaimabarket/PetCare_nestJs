import { Suspense } from "react";
import { LoadingState } from "@/components/services/ui";
import { ProviderView } from "./ProviderView";

export default function ProviderPage({ params }: PageProps<"/services/[id]">) {
  return <Suspense fallback={<LoadingState />}>{params.then(({ id }) => <ProviderView id={id} />)}</Suspense>;
}
