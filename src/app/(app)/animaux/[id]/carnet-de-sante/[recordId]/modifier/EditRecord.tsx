"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/components/auth/AuthProvider";
import { RecordForm } from "@/components/sante/RecordForm";
import { Breadcrumb, ButtonLink, carnetHref, PageLoading, pageClass, usePet } from "@/components/sante/ui";
import { Alert, Card } from "@/components/ui/Card";
import type { HealthRecord } from "@/lib/health-records";
import { getHealthRecord } from "@/lib/health-records-api";

export function EditRecord({ petId, recordId }: { petId: string; recordId: string }) {
  return (
    <RequireAuth>
      <EditRecordContent petId={petId} recordId={recordId} />
    </RequireAuth>
  );
}

function EditRecordContent({ petId, recordId }: { petId: string; recordId: string }) {
  const { user } = useAuth();
  const [record, setRecord] = useState<HealthRecord | null>(null);
  const [error, setError] = useState("");
  const { name } = usePet(petId, record?.petName);
  const back = carnetHref(petId, name);

  useEffect(() => {
    if (!user) return;
    let active = true;
    getHealthRecord(recordId)
      .then((r) => active && setRecord(r))
      .catch((err) => active && setError(err instanceof Error ? err.message : "Chargement impossible."));
    return () => {
      active = false;
    };
  }, [user, recordId]);

  if (!record && !error) return <PageLoading label="Chargement de l'acte…" />;

  return (
    <div className={`${pageClass} max-w-4xl`}>
      <Breadcrumb
        items={[
          { label: "Carnets de santé", href: "/carnet-de-sante" },
          { label: name, href: back },
          { label: "Modifier l'acte médical" },
        ]}
      />
      {record ? (
        <RecordForm petId={petId} petName={name} record={record} backHref={back} />
      ) : (
        <Card className="flex flex-col items-start gap-space-md">
          <Alert>{error}</Alert>
          <ButtonLink href={back} variant="secondary" icon="arrow_back">
            Retour au carnet
          </ButtonLink>
        </Card>
      )}
    </div>
  );
}
