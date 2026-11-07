"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/components/auth/AuthProvider";
import { ExportPdfButton } from "@/components/sante/ExportPdfButton";
import { ShareDialog } from "@/components/sante/ShareDialog";
import { Button } from "@/components/ui/Button";
import {
  Breadcrumb,
  ButtonLink,
  carnetHref,
  ConfirmDialog,
  PageLoading,
  pageClass,
  PetThumb,
  petSubtitle,
  ReadOnlyBanner,
  usePet,
} from "@/components/sante/ui";
import { Alert, Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { formatRecordDate, RECORD_TYPE_INFO, RECORD_TYPES, todayIso, type HealthRecord, type RecordType } from "@/lib/health-records";
import { deleteHealthRecord, listHealthRecords, openAttachment } from "@/lib/health-records-api";
import { doseScheduleLabel } from "@/lib/health-summary";

const SUCCESS_MESSAGES: Record<string, string> = {
  ajoute: "L'acte médical a été ajouté au carnet.",
  modifie: "L'acte médical a été modifié.",
  supprime: "L'acte médical a été supprimé.",
};

export function HealthBook({ petId }: { petId: string }) {
  return (
    <RequireAuth>
      <HealthBookContent petId={petId} />
    </RequireAuth>
  );
}

function HealthBookContent({ petId }: { petId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [records, setRecords] = useState<HealthRecord[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState<RecordType | "all">("all");
  const [search, setSearch] = useState("");
  const [toDelete, setToDelete] = useState<HealthRecord | null>(null);
  const [sharing, setSharing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState(() => {
    const key = Object.keys(SUCCESS_MESSAGES).find((k) => searchParams.has(k));
    return key ? SUCCESS_MESSAGES[key] : "";
  });

  const { pet, name, readOnly } = usePet(petId, records?.[0]?.petName || searchParams.get("nom") || undefined);
  const selfHref = carnetHref(petId, name);

  const load = useCallback(async () => {
    setLoadError("");
    try {
      setRecords(await listHealthRecords(petId));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Chargement impossible.");
      setRecords([]);
    }
  }, [petId]);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement initial depuis l'API
    load();
  }, [user, load]);

  // Retire ?ajoute=1 de l'adresse pour que le message ne revienne pas au rechargement.
  useEffect(() => {
    if (Object.keys(SUCCESS_MESSAGES).some((k) => searchParams.has(k))) router.replace(selfHref, { scroll: false });
  }, [searchParams, router, selfHref]);

  const closeDialog = useCallback(() => setToDelete(null), []);
  // Fonction stable : la fenêtre (Modal) réinstalle son écoute d'Échap à chaque changement de onClose.
  const closeShare = useCallback(() => setSharing(false), []);

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    setActionError("");
    try {
      await deleteHealthRecord(toDelete.id);
      setRecords((list) => list?.filter((r) => r.id !== toDelete.id) ?? null);
      setSuccess(SUCCESS_MESSAGES.supprime);
      setToDelete(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Suppression impossible.");
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  async function handleOpenAttachment(recordId: string, attachmentId: string) {
    setActionError("");
    try {
      await openAttachment(recordId, attachmentId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Ouverture impossible.");
    }
  }

  if (records === null) return <PageLoading />;

  const term = search.trim().toLowerCase();
  const visible = records.filter(
    (r) =>
      (filter === "all" || r.type === filter) &&
      (!term || [r.title, r.notes, r.veterinarian, r.clinic].some((v) => v.toLowerCase().includes(term))),
  );
  const today = todayIso();
  const upcomingVaccines = records
    .filter((r) => r.type === "vaccin" && r.nextDueDate && r.nextDueDate >= today)
    .sort((a, b) => a.nextDueDate!.localeCompare(b.nextDueDate!));
  const activeTreatments = records.filter((r) => r.type === "traitement" && (!r.endDate || r.endDate >= today));
  const allergies = records.filter((r) => r.type === "allergie");
  const addHref = `/animaux/${encodeURIComponent(petId)}/carnet-de-sante/ajouter?nom=${encodeURIComponent(name)}`;

  return (
    <div className={pageClass}>
      <Breadcrumb items={[{ label: "Santé", href: "/carnet-de-sante" }, { label: name }, { label: "Carnet de santé" }]} />

      <Card className="flex flex-col md:flex-row md:items-center justify-between gap-space-lg mb-space-xl">
        <div className="flex items-center gap-space-md min-w-0">
          <PetThumb src={pet?.thumbnail} name={name} size="w-16 h-16" />
          <div className="min-w-0 flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-space-sm">
              <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight truncate">{name}</h1>
              {petSubtitle(pet) && (
                <span className="px-space-sm py-0.5 rounded-full bg-primary-fixed/40 text-on-primary-fixed-variant font-label-sm text-label-sm">
                  {petSubtitle(pet)}
                </span>
              )}
            </div>
            <span className="self-start inline-flex items-center gap-1 px-space-sm py-0.5 rounded-full bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm">
              <Icon name="lock" className="text-[14px]" />
              Privé · Accessible uniquement par vous
            </span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-space-sm shrink-0">
          <Button type="button" variant="secondary" icon="share" disabled={!pet} onClick={() => setSharing(true)}>
            Partager
          </Button>
          <ExportPdfButton petId={petId} records={records} disabled={!pet} />
          {!readOnly && (
            <ButtonLink href={addHref} icon="add">
              Ajouter un soin
            </ButtonLink>
          )}
        </div>
      </Card>

      <div className="flex flex-col gap-space-sm mb-space-lg empty:hidden">
        {readOnly && <ReadOnlyBanner name={name} />}
        {success && <Alert tone="success">{success}</Alert>}
        {actionError && <Alert>{actionError}</Alert>}
        {loadError && <Alert>{loadError}</Alert>}
      </div>

      <div className="grid gap-space-lg lg:grid-cols-[240px_1fr_300px]">
        <aside className="flex flex-col gap-space-lg">
          <Card className="p-space-md">
            <h2 className="px-space-sm pb-space-sm font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
              Sections médicales
            </h2>
            <ul className="flex flex-row lg:flex-col gap-1 overflow-x-auto">
              {(["all", ...RECORD_TYPES] as const).map((key) => {
                const active = filter === key;
                const count = key === "all" ? records.length : records.filter((r) => r.type === key).length;
                return (
                  <li key={key} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => setFilter(key)}
                      aria-pressed={active}
                      className={`w-full flex items-center gap-space-sm rounded-xl px-space-sm py-2 font-label-lg text-label-lg transition-colors ${
                        active ? "bg-primary-container text-on-primary" : "text-on-surface hover:bg-surface-container-low"
                      }`}
                    >
                      <Icon name={key === "all" ? "dataset" : RECORD_TYPE_INFO[key].icon} className="text-[20px]" />
                      <span className="flex-1 text-left whitespace-nowrap">{key === "all" ? "Tous les soins" : RECORD_TYPE_INFO[key].plural}</span>
                      <span
                        className={`min-w-6 px-1.5 rounded-full font-label-sm text-label-sm ${
                          active ? "bg-on-primary/20" : "bg-surface-container text-on-surface-variant"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </aside>

        <section className="flex flex-col gap-space-md min-w-0" aria-label="Historique des soins">
          <Card className="p-space-sm">
            <label className="relative flex items-center">
              <Icon name="search" className="pointer-events-none absolute left-3 text-outline" />
              <span className="sr-only">Rechercher un soin</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un soin, vaccin, vétérinaire…"
                className="h-11 w-full rounded-lg bg-surface-container-low pl-10 pr-3 font-body-md text-body-md placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </label>
          </Card>

          {visible.length === 0 ? (
            <Card className="flex flex-col items-center gap-space-sm text-center p-space-xl">
              <Icon name="medical_information" className="text-[40px] text-outline" />
              <p className="font-headline-sm text-headline-sm">
                {records.length === 0 ? "Le carnet est vide" : "Aucun soin ne correspond"}
              </p>
              <p className="font-body-md text-body-md text-on-surface-variant max-w-sm">
                {records.length === 0
                  ? readOnly
                    ? `Aucun acte n'a été enregistré pour ${name}.`
                    : `Ajoutez le premier acte médical de ${name} : vaccin, consultation, traitement…`
                  : "Modifiez la recherche ou choisissez une autre section."}
              </p>
              {records.length === 0 && !readOnly && (
                <ButtonLink href={addHref} icon="add" className="mt-space-sm">
                  Ajouter un soin
                </ButtonLink>
              )}
            </Card>
          ) : (
            <ol className="relative flex flex-col gap-space-md before:absolute before:left-[15px] before:top-4 before:bottom-4 before:w-0.5 before:bg-surface-container">
              {visible.map((record) => (
                <RecordCard
                  key={record.id}
                  record={record}
                  petId={petId}
                  readOnly={readOnly}
                  onDelete={() => setToDelete(record)}
                  onOpenAttachment={(attachmentId) => handleOpenAttachment(record.id, attachmentId)}
                />
              ))}
            </ol>
          )}
        </section>

        <aside className="flex flex-col gap-space-lg">
          <SidePanel icon="event_repeat" title="Prochains rappels" empty="Aucun rappel de vaccin à venir.">
            {upcomingVaccines.map((r) => (
              <SideItem key={r.id} href={`/animaux/${encodeURIComponent(petId)}/carnet-de-sante/${r.id}`} title={r.title} tone="bg-tertiary-fixed/50">
                Échéance le <strong>{formatRecordDate(r.nextDueDate!)}</strong>
              </SideItem>
            ))}
          </SidePanel>
          <SidePanel icon="medication" title="Traitements en cours" empty="Aucun traitement en cours.">
            {activeTreatments.map((r) => (
              <SideItem key={r.id} href={`/animaux/${encodeURIComponent(petId)}/carnet-de-sante/${r.id}`} title={r.title} tone="bg-surface-container-low">
                {r.dosage || "Posologie non précisée"}
                {r.doseTimes.length > 0 && ` · ${doseScheduleLabel(r)}`}
                {r.endDate && ` · jusqu'au ${formatRecordDate(r.endDate, { dateStyle: "medium" })}`}
              </SideItem>
            ))}
          </SidePanel>
          <SidePanel icon="warning" title="Allergies & vigilances" empty="Aucune allergie signalée.">
            {allergies.map((r) => (
              <SideItem key={r.id} href={`/animaux/${encodeURIComponent(petId)}/carnet-de-sante/${r.id}`} title={r.title} tone="bg-error-container/30">
                {r.notes ? r.notes.slice(0, 90) + (r.notes.length > 90 ? "…" : "") : "Voir le détail"}
              </SideItem>
            ))}
          </SidePanel>
        </aside>
      </div>

      {sharing && <ShareDialog petId={petId} petName={name} onClose={closeShare} />}

      <ConfirmDialog
        open={toDelete !== null}
        title="Supprimer cet acte ?"
        confirmLabel="Supprimer définitivement"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={closeDialog}
      >
        « {toDelete?.title} » du {toDelete && formatRecordDate(toDelete.date)} sera supprimé du carnet de {name}, avec ses
        pièces jointes. Cette action est irréversible.
      </ConfirmDialog>
    </div>
  );
}

function RecordCard({
  record,
  petId,
  readOnly,
  onDelete,
  onOpenAttachment,
}: {
  record: HealthRecord;
  petId: string;
  readOnly: boolean;
  onDelete: () => void;
  onOpenAttachment: (attachmentId: string) => void;
}) {
  const info = RECORD_TYPE_INFO[record.type];
  const base = `/animaux/${encodeURIComponent(petId)}/carnet-de-sante/${record.id}`;
  return (
    <li className="relative pl-12">
      <span className={`absolute left-0 top-5 w-8 h-8 rounded-full flex items-center justify-center ring-4 ring-background ${info.dot}`}>
        <Icon name={info.icon} className="text-[16px]" />
      </span>
      <Card className="flex flex-col gap-space-sm">
        <div className="flex flex-wrap items-start justify-between gap-space-sm">
          <div className="min-w-0">
            <p className="font-label-md text-label-md uppercase tracking-wide text-primary">
              {formatRecordDate(record.date, { dateStyle: "medium" })} · {info.label}
            </p>
            <Link href={base} className="font-headline-sm text-headline-sm text-on-surface hover:text-primary transition-colors">
              {record.title}
            </Link>
          </div>
          {record.nextDueDate && (
            <span className="px-space-sm py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant font-label-sm text-label-sm">
              Rappel le {formatRecordDate(record.nextDueDate, { dateStyle: "medium" })}
            </span>
          )}
        </div>
        {record.notes && <p className="font-body-md text-body-md text-on-surface-variant line-clamp-3 whitespace-pre-line">{record.notes}</p>}
        {record.dosage && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            <strong className="text-on-surface">Posologie :</strong> {record.dosage}
          </p>
        )}
        {record.doseTimes.length > 0 && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            <strong className="text-on-surface">Prises :</strong> {doseScheduleLabel(record)}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-space-sm pt-space-xs">
          <p className="flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant">
            <Icon name="person" className="text-[16px]" />
            {[record.veterinarian, record.clinic].filter(Boolean).join(" · ") || "Vétérinaire non précisé"}
          </p>
          <div className="flex flex-wrap gap-space-xs">
            {record.attachments.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onOpenAttachment(a.id)}
                className="inline-flex items-center gap-1 h-8 px-space-sm rounded-full bg-surface-container-low text-on-surface font-label-sm text-label-sm hover:bg-surface-container max-w-48"
              >
                <Icon name="attach_file" className="text-[16px]" />
                <span className="truncate">{a.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-space-xs border-t border-surface-container pt-space-sm">
          <Link href={base} className="inline-flex items-center gap-1 h-9 px-space-md rounded-full font-label-md text-label-md text-on-surface-variant hover:bg-surface-container">
            <Icon name="visibility" className="text-[18px]" />
            Détails
          </Link>
          {!readOnly && (
            <>
              <Link href={`${base}/modifier`} className="inline-flex items-center gap-1 h-9 px-space-md rounded-full font-label-md text-label-md text-primary hover:bg-surface-container-low">
                <Icon name="edit" className="text-[18px]" />
                Modifier
              </Link>
              <button type="button" onClick={onDelete} className="inline-flex items-center gap-1 h-9 px-space-md rounded-full font-label-md text-label-md text-error hover:bg-error-container/40">
                <Icon name="delete" className="text-[18px]" />
                Supprimer
              </button>
            </>
          )}
        </div>
      </Card>
    </li>
  );
}

function SidePanel({ icon, title, empty, children }: { icon: string; title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <Card className="flex flex-col gap-space-sm">
      <h2 className="flex items-center gap-space-sm font-headline-sm text-headline-sm text-on-surface">
        <Icon name={icon} className="text-primary" />
        {title}
      </h2>
      {children.length ? children : <p className="font-body-sm text-body-sm text-on-surface-variant">{empty}</p>}
    </Card>
  );
}

function SideItem({ href, title, tone, children }: { href: string; title: string; tone: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={`block rounded-xl p-space-sm hover:shadow-sm transition-shadow ${tone}`}>
      <p className="font-label-lg text-label-lg text-on-surface">{title}</p>
      <p className="font-body-sm text-body-sm text-on-surface-variant">{children}</p>
    </Link>
  );
}
