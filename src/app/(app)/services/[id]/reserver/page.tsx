import { Suspense } from "react";
import { LoadingState } from "@/components/services/ui";
import { BookingForm } from "./BookingForm";

export default function BookPage({ params }: PageProps<"/services/[id]/reserver">) {
  return <Suspense fallback={<LoadingState />}>{params.then(({ id }) => <BookingForm id={id} />)}</Suspense>;
}
