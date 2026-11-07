"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/components/auth/AuthProvider";
import { Breadcrumb, ButtonLink, carnetHref, ConfirmDialog, PageLoading, pageClass, ReadOnlyBanner, usePet } from "@/components/sante/ui";
import { Button } from "@/components/ui/Button";
import { Alert, Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { formatFileSize, formatRecordDate, RECORD_TYPE_INFO, type HealthRecord } from "@/lib/health-records";
import { deleteHealthRecord, getHealthRecord, openAttachment } from "@/lib/health-records-api";
import { doseScheduleLabel } from "@/lib/health-summary";

export function RecordDetail({ petId, recordId }: { petId: string; recordId: string }) {
  return (
    <RequireAuth>
      <RecordDetailContent petId={petId} recordId={recordId} />
    </RequireAuth>
  );
}

/** Détail d'un acte médical, avec modification et suppression (sauf si l'animal est archivé). */
function RecordDetailContent({ petId, recordId }: { petId: string; recordId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [record, setRecord] = useState<HealthRecord | null>(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { name, readOnly } = usePet(petId, record?.petName);
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

  const closeDialog = useCallback(() => setConfirming(false), []);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteHealthRecord(recordId);
      router.push(`${back}${back.includes("?") ? "&" : "?"}supprime=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression impossible.");
      setConfirming(false);
      setDeleting(false);
    }
  }

  async function handleOpen(attachmentId: string) {
    setError("");
    try {
      await openAttachment(recordId, attachmentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ouverture impossible.");
    }
  }

  if (!record && !error) return <PageLoading label="Chargement de l'acte…" />;

  const breadcrumb = (
    <Breadcrumb
      items={[
        { label: "Santé", href: "/carnet-de-sante" },
        { label: name, href: back },
        { label: record?.title ?? "Acte médical" },
      ]}
    />
  );

  if (!record) {
    return (
      <div className={`${pageClass} max-w-3xl`}>
        {breadcrumb}
        <Card className="flex flex-col items-start gap-space-md">
          <Alert>{error}</Alert>
          <ButtonLink href={back} variant="secondary" icon="arrow_back">
            Retour au carnet
          </ButtonLink>
        </Card>
      </div>
    );
  }

  const info = RECORD_TYPE_INFO[record.type];
  const details: [string, string, string | null][] = [
    ["calendar_today", "Date de l'acte", formatRecordDate(record.date)],
    ["person", "Vétérinaire", record.veterinarian || null],
    ["location_on", "Lieu / Cabinet", record.clinic || null],
    ["tag", "Numéro de lot", record.lotNumber || null],
    ["event_repeat", "Prochain rappel", record.nextDueDate ? formatRecordDate(record.nextDueDate) : null],
    ["pill", "Posologie", record.dosage || null],
    ["schedule", "Prises", doseScheduleLabel(record) || null],
    ["event_available", "Fin du traitement", record.endDate ? formatRecordDate(record.endDate) : null],
  ];

  return (
    <div className={`${pageClass} max-w-3xl`}>
      {breadcrumb}
      <Card className="flex flex-col gap-space-lg p-space-lg md:p-space-xl">
        <div className="flex flex-col gap-space-xs">
          <span className={`self-start inline-flex items-center gap-1 px-space-sm py-0.5 rounded-full font-label-sm text-label-sm ${info.badge}`}>
            <Icon name={info.icon} className="text-[14px]" />
            {info.label}
          </span>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">{record.title}</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Carnet de {name} · modifié le {new Date(record.updatedAt).toLocaleDateString("fr-FR", { dateStyle: "long" })}
          </p>
        </div>

        {readOnly && <ReadOnlyBanner name={name} />}
        {error && <Alert>{error}</Alert>}

        <dl className="grid gap-space-md sm:grid-cols-2">
          {details
            .filter(([, , value]) => value)
            .map(([icon, label, value]) => (
              <div key={label} className="flex items-start gap-space-sm rounded-xl bg-surface-container-low p-space-md">
                <Icon name={icon} className="text-primary text-[20px]" />
                <div>
                  <dt className="font-label-sm text-label-sm uppercase tracking-wide text-on-surface-variant">{label}</dt>
                  <dd className="font-body-md text-body-md text-on-surface">{value}</dd>
                </div>
              </div>
            ))}
        </dl>

        <section className="flex flex-col gap-space-xs">
          <h2 className="font-label-lg text-label-lg text-on-surface">Observations</h2>
          <p className="font-body-md text-body-md text-on-surface-variant whitespace-pre-line">
            {record.notes || "Aucune observation."}
          </p>
        </section>

        {record.attachments.length > 0 && (
          <section className="flex flex-col gap-space-xs">
            <h2 className="font-label-lg text-label-lg text-on-surface">Documents & justificatifs</h2>
            <ul className="flex flex-col gap-space-xs">
              {record.attachments.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => handleOpen(a.id)}
                    className="w-full flex items-center gap-space-sm rounded-xl bg-surface-container-low px-space-md py-space-sm text-left hover:bg-surface-container transition-colors"
                  >
                    <Icon name={a.mimeType === "application/pdf" ? "picture_as_pdf" : "image"} className="text-primary" />
                    <span className="min-w-0 flex-1 truncate font-label-lg text-label-lg">{a.name}</span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">{formatFileSize(a.size)}</span>
                    <Icon name="open_in_new" className="text-[18px] text-outline" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-space-sm pt-space-lg border-t border-surface-container">
          <ButtonLink href={back} variant="secondary" icon="arrow_back">
            Retour au carnet
          </ButtonLink>
          {!readOnly && (
            <div className="flex flex-col-reverse sm:flex-row gap-space-sm">
              <Button type="button" variant="danger" onClick={() => setConfirming(true)}>
                Supprimer
              </Button>
              <ButtonLink href={`/animaux/${encodeURIComponent(petId)}/carnet-de-sante/${record.id}/modifier`} icon="edit">
                Modifier
              </ButtonLink>
            </div>
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={confirming}
        title="Supprimer cet acte ?"
        confirmLabel="Supprimer définitivement"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={closeDialog}
      >
        « {record.title} » du {formatRecordDate(record.date)} sera supprimé du carnet de {name}, avec ses pièces jointes.
        Cette action est irréversible.
      </ConfirmDialog>
    </div>
  );
}
