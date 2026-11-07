import { Suspense } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { Loading } from "@/components/rendez-vous/ui";
import { AppointmentDetail } from "./AppointmentDetail";

export default function AppointmentDetailPage({ params }: PageProps<"/rendez-vous/[id]">) {
  return (
    <RequireAuth>
      <Suspense fallback={<Loading />}>
        {params.then(({ id }) => (
          <AppointmentDetail id={id} />
        ))}
      </Suspense>
    </RequireAuth>
  );
}
