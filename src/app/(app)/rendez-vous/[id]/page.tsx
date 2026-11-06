import { Suspense } from "react";
import { Loading } from "@/components/rendez-vous/ui";
import { AppointmentDetail } from "./AppointmentDetail";

export default function AppointmentDetailPage({ params }: PageProps<"/rendez-vous/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      {params.then(({ id }) => (
        <AppointmentDetail id={id} />
      ))}
    </Suspense>
  );
}
