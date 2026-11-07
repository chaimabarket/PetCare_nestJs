import { Suspense } from "react";
import { PageLoading } from "@/components/adoption/ui";
import { ShareHappyTail } from "./ShareHappyTail";

export default function ShareHappyTailPage({ params }: PageProps<"/communaute/adoption/[id]/happy-tail">) {
  return (
    <Suspense fallback={<PageLoading />}>
      {params.then(({ id }) => (
        <ShareHappyTail id={id} />
      ))}
    </Suspense>
  );
}
