"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Alert, Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { TextArea, TextField } from "@/components/ui/TextField";
import {
  addMonthsIso,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_TYPES,
  ATTACHMENTS_MAX_COUNT,
  EMPTY_RECORD_INPUT,
  formatFileSize,
  NOTES_MAX_LENGTH,
  RECORD_TYPE_INFO,
  RECORD_TYPES,
  todayIso,
  validateHealthRecord,
  type HealthRecord,
  type HealthRecordField,
  type HealthRecordInput,
} from "@/lib/health-records";
import {
  createHealthRecord,
  fileToAttachment,
  HealthApiError,
  scheduleVaccineReminder,
  updateHealthRecord,
} from "@/lib/health-records-api";
import { hasErrors, type FieldErrors } from "@/lib/validation";

const chip = (active: boolean) =>
  `h-8 px-space-md rounded-full font-label-md text-label-md transition-colors ${
    active ? "bg-primary text-on-primary" : "bg-surface-container-low text-primary hover:bg-surface-container"
  }`;

/** Formulaire d'ajout ou de modification d'un acte médical (maquette « Ajouter un acte médical »). */
export function RecordForm({
  petId,
  petName,
  record,
  backHref,
}: {
  petId: string;
  petName: string;
  /** Acte à modifier ; absent pour un ajout. */
  record?: HealthRecord;
  backHref: string;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<HealthRecordInput>(() =>
    record
      ? {
          petId,
          petName: record.petName || petName,
          type: record.type,
          title: record.title,
          date: record.date,
          veterinarian: record.veterinarian,
          clinic: record.clinic,
          notes: record.notes,
          lotNumber: record.lotNumber,
          nextDueDate: record.nextDueDate ?? "",
          dosage: record.dosage,
          endDate: record.endDate ?? "",
        }
      : { ...EMPTY_RECORD_INPUT, petId, petName, date: todayIso() },
  );
  const [kept, setKept] = useState(record?.attachments ?? []);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<FieldErrors<HealthRecordField>>({});
  const [formError, setFormError] = useState("");
  const [fileError, setFileError] = useState("");
  const [saving, setSaving] = useState(false);

  const info = RECORD_TYPE_INFO[values.type];
  const set = <K extends HealthRecordField>(field: K, value: HealthRecordInput[K]) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  function addFiles(list: FileList | null) {
    setFileError("");
    if (!list) return;
    const next = [...files];
    for (const file of Array.from(list)) {
      if (!ATTACHMENT_TYPES.includes(file.type)) {
        setFileError(`« ${file.name} » : formats acceptés PDF, JPG, PNG ou WebP.`);
      } else if (file.size > ATTACHMENT_MAX_BYTES) {
        setFileError(`« ${file.name} » dépasse 2 Mo.`);
      } else if (kept.length + next.length >= ATTACHMENTS_MAX_COUNT) {
        setFileError(`${ATTACHMENTS_MAX_COUNT} pièces jointes maximum par acte.`);
        break;
      } else {
        next.push(file);
      }
    }
    setFiles(next);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    // Le nom de l'animal peut arriver après l'ouverture du formulaire (lecture du module Mes animaux).
    const { value, errors: found } = validateHealthRecord({ ...values, petName }, { today: todayIso() });
    setErrors(found);
    if (hasErrors(found)) {
      setFormError("Vérifiez les champs signalés en rouge.");
      return;
    }
    setSaving(true);
    try {
      const newAttachments = await Promise.all(files.map(fileToAttachment));
      const saved = record
        ? await updateHealthRecord(record.id, value, { keepAttachmentIds: kept.map((a) => a.id), newAttachments })
        : await createHealthRecord(value, newAttachments);
      if (!record && user) {
        // Facultatif : un rappel non programmé ne doit pas bloquer l'enregistrement.
        await scheduleVaccineReminder(saved, user.uid).catch((err) => console.error("Rappel non programmé :", err));
      }
      router.push(`${backHref}${backHref.includes("?") ? "&" : "?"}${record ? "modifie" : "ajoute"}=1`);
    } catch (err) {
      if (err instanceof HealthApiError && Object.keys(err.fieldErrors).length) {
        setErrors(err.fieldErrors as FieldErrors<HealthRecordField>);
      }
      setFormError(err instanceof Error ? err.message : "Une erreur est survenue. Réessayez.");
      setSaving(false);
    }
  }

  return (
    <Card className="p-space-lg md:p-space-xl">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-space-xl">
        <div className="flex flex-col gap-space-xs pb-space-lg border-b border-surface-container">
          <span className="self-start inline-flex items-center gap-1 px-space-sm py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant font-label-sm text-label-sm">
            <Icon name={record ? "edit" : "medical_services"} className="text-[14px]" />
            {record ? "Modification" : "Nouveau soin vétérinaire"}
          </span>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
            {record ? "Modifier l'acte médical" : "Ajouter un acte médical"}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            {record
              ? `Mettez à jour le carnet de santé de ${petName}.`
              : `Complétez le carnet de santé de ${petName} pour assurer un suivi préventif rigoureux.`}
          </p>
        </div>

        <fieldset className="flex flex-col gap-space-sm">
          <div className="flex items-center justify-between">
            <legend className="font-label-lg text-label-lg text-on-surface">
              Type d&apos;acte médical <span className="text-error">*</span>
            </legend>
            <span className="font-label-sm text-label-sm text-on-surface-variant">Obligatoire</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-space-sm" role="radiogroup">
            {RECORD_TYPES.map((type) => {
              const active = values.type === type;
              return (
                <button
                  key={type}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => set("type", type)}
                  className={`relative flex flex-col items-center justify-center gap-1 rounded-xl px-space-sm py-space-md text-center font-label-md text-label-md transition-all ${
                    active
                      ? "bg-primary-container text-on-primary shadow-md"
                      : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                  }`}
                >
                  {active && <Icon name="check_circle" filled className="absolute top-1.5 right-1.5 text-[16px]" />}
                  <Icon name={RECORD_TYPE_INFO[type].icon} className="text-[22px]" />
                  {RECORD_TYPE_INFO[type].label}
                </button>
              );
            })}
          </div>
          {values.type === "vaccin" && (
            <p className="flex items-start gap-space-xs rounded-xl bg-primary-fixed/30 p-space-sm font-body-sm text-body-sm text-on-primary-fixed-variant">
              <Icon name="info" className="text-[16px] mt-0.5" />
              Indiquez la date du prochain rappel : PetCare vous enverra une notification 7 jours avant l&apos;échéance.
            </p>
          )}
        </fieldset>

        <div className="grid gap-space-lg md:grid-cols-2">
          <TextField
            label="Intitulé"
            icon="title"
            hint="Requis"
            placeholder={values.type === "vaccin" ? "Ex. Typhus / Coryza / Leucose" : "Ex. Visite annuelle de routine"}
            value={values.title}
            maxLength={120}
            onChange={(e) => set("title", e.target.value)}
            error={errors.title}
          />
          <div className="flex flex-col gap-space-xs">
            <TextField
              label="Date de l'acte"
              icon="calendar_today"
              hint="Requis"
              type="date"
              max={todayIso()}
              value={values.date}
              onChange={(e) => set("date", e.target.value)}
              error={errors.date}
            />
            <div className="flex gap-space-xs">
              <button type="button" className={chip(values.date === todayIso())} onClick={() => set("date", todayIso())}>
                Aujourd&apos;hui
              </button>
              <button type="button" className={chip(values.date === todayIso(-1))} onClick={() => set("date", todayIso(-1))}>
                Hier
              </button>
            </div>
          </div>
          <TextField
            label="Vétérinaire praticien"
            icon="person"
            hint={info.vetRequired ? "Requis" : "Facultatif"}
            placeholder="Ex. Dr. Sophie Martin"
            value={values.veterinarian}
            maxLength={120}
            onChange={(e) => set("veterinarian", e.target.value)}
            error={errors.veterinarian}
          />
          <TextField
            label="Lieu d'intervention / Cabinet"
            icon="location_on"
            hint="Facultatif"
            placeholder="Ex. Clinique Féline République"
            value={values.clinic}
            maxLength={120}
            onChange={(e) => set("clinic", e.target.value)}
            error={errors.clinic}
          />
        </div>

        {values.type === "vaccin" && (
          <section className="rounded-2xl bg-surface-container-low p-space-lg flex flex-col gap-space-md">
            <h2 className="flex items-center gap-space-sm font-headline-sm text-headline-sm text-on-surface">
              <Icon name="vaccines" className="text-primary" />
              Détails du vaccin
            </h2>
            <div className="grid gap-space-lg md:grid-cols-2">
              <TextField
                label="Numéro de lot"
                icon="tag"
                hint="Facultatif"
                placeholder="Ex. Lot #V98201"
                value={values.lotNumber}
                maxLength={120}
                onChange={(e) => set("lotNumber", e.target.value)}
                error={errors.lotNumber}
              />
              <div className="flex flex-col gap-space-xs">
                <TextField
                  label="Date du prochain rappel"
                  icon="event_repeat"
                  hint="Facultatif"
                  type="date"
                  min={values.date || undefined}
                  value={values.nextDueDate}
                  onChange={(e) => set("nextDueDate", e.target.value)}
                  error={errors.nextDueDate}
                />
                {values.date && (
                  <div className="flex flex-wrap gap-space-xs">
                    {[
                      { label: "+ 1 an (recommandé)", months: 12 },
                      { label: "+ 6 mois", months: 6 },
                      { label: "+ 3 ans (Rage)", months: 36 },
                    ].map(({ label, months }) => {
                      const due = addMonthsIso(values.date, months);
                      return (
                        <button key={months} type="button" className={chip(values.nextDueDate === due)} onClick={() => set("nextDueDate", due)}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {values.type === "traitement" && (
          <section className="rounded-2xl bg-surface-container-low p-space-lg flex flex-col gap-space-md">
            <h2 className="flex items-center gap-space-sm font-headline-sm text-headline-sm text-on-surface">
              <Icon name="medication" className="text-primary" />
              Posologie & durée
            </h2>
            <div className="grid gap-space-lg md:grid-cols-2">
              <TextField
                label="Posologie"
                icon="pill"
                hint="Facultatif"
                placeholder="Ex. 1 comprimé matin et soir"
                value={values.dosage}
                maxLength={120}
                onChange={(e) => set("dosage", e.target.value)}
                error={errors.dosage}
              />
              <TextField
                label="Fin du traitement"
                icon="event_available"
                hint="Facultatif"
                type="date"
                min={values.date || undefined}
                value={values.endDate}
                onChange={(e) => set("endDate", e.target.value)}
                error={errors.endDate}
              />
            </div>
          </section>
        )}

        <TextArea
          label="Observations médicales & détails"
          hint={`${values.notes.length} / ${NOTES_MAX_LENGTH} caractères`}
          help="Précisez tout comportement ou posologie utile pour un prochain confrère."
          rows={5}
          maxLength={NOTES_MAX_LENGTH}
          placeholder="Température, poids, réaction au soin, recommandations…"
          value={values.notes}
          onChange={(e) => set("notes", e.target.value)}
          error={errors.notes}
        />

        <section className="flex flex-col gap-space-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-label-lg text-label-lg text-on-surface">Documents & justificatifs (ordonnance, vignette, facture)</h2>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              PDF, JPG, PNG (2 Mo max, {ATTACHMENTS_MAX_COUNT} fichiers)
            </span>
          </div>
          <label
            className={`flex flex-col items-center justify-center gap-space-xs rounded-2xl border-2 border-dashed border-outline-variant bg-surface-container-low/50 p-space-lg text-center transition-colors ${
              kept.length + files.length >= ATTACHMENTS_MAX_COUNT ? "opacity-60" : "cursor-pointer hover:bg-surface-container-low"
            }`}
          >
            <Icon name="cloud_upload" className="text-[28px] text-primary" />
            <span className="font-body-md text-body-md text-on-surface">
              Ajoutez une ordonnance, un certificat ou une photo de vignette
            </span>
            <span className="font-body-sm text-body-sm text-primary underline">Parcourir vos fichiers</span>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={ATTACHMENT_TYPES.join(",")}
              className="sr-only"
              disabled={kept.length + files.length >= ATTACHMENTS_MAX_COUNT}
              onChange={(e) => addFiles(e.target.files)}
            />
          </label>
          {fileError && <Alert>{fileError}</Alert>}
          {(kept.length > 0 || files.length > 0) && (
            <ul className="flex flex-col gap-space-xs">
              {kept.map((a) => (
                <AttachmentRow key={a.id} name={a.name} detail={`${formatFileSize(a.size)} · déjà enregistré`} onRemove={() => setKept(kept.filter((k) => k.id !== a.id))} />
              ))}
              {files.map((file, index) => (
                <AttachmentRow
                  key={`${file.name}-${index}`}
                  name={file.name}
                  detail={`${formatFileSize(file.size)} · à envoyer`}
                  onRemove={() => setFiles(files.filter((_, i) => i !== index))}
                />
              ))}
            </ul>
          )}
        </section>

        {formError && <Alert>{formError}</Alert>}

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-space-sm pt-space-lg border-t border-surface-container">
          <button
            type="button"
            onClick={() => router.push(backHref)}
            disabled={saving}
            className="h-11 px-space-lg rounded-full font-label-lg text-label-lg text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            Annuler
          </button>
          <Button type="submit" loading={saving} icon="check_circle">
            {record ? "Enregistrer les modifications" : "Enregistrer l'acte"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function AttachmentRow({ name, detail, onRemove }: { name: string; detail: string; onRemove: () => void }) {
  return (
    <li className="flex items-center gap-space-sm rounded-xl bg-surface-container-low px-space-md py-space-sm">
      <Icon name={name.toLowerCase().endsWith(".pdf") ? "picture_as_pdf" : "image"} className="text-primary" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-label-lg text-label-lg text-on-surface">{name}</p>
        <p className="font-body-sm text-body-sm text-on-surface-variant">{detail}</p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Retirer ${name}`}
        className="w-9 h-9 rounded-full flex items-center justify-center text-error hover:bg-error-container/40 transition-colors"
      >
        <Icon name="delete" className="text-[20px]" />
      </button>
    </li>
  );
}
