import { Suspense } from "react";
import { AssistantChat } from "@/components/assistant/AssistantChat";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Assistant IA. `?adoption=1` envoie directement « Trouver mon compagnon » (bannière du fil d'adoption). */
export default function AssistantPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<p className="p-space-xl text-center text-on-surface-variant">Chargement…</p>}>
      <Assistant searchParams={searchParams} />
    </Suspense>
  );
}

async function Assistant({ searchParams }: { searchParams: SearchParams }) {
  const { adoption } = await searchParams;
  return <AssistantChat startWithAdoption={adoption === "1"} />;
}
