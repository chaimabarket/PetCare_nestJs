"use client";

import { useState } from "react";
import { Modal } from "@/components/pets/Modal";
import { TextArea, TextField } from "@/components/ui/TextField";
import {
  createService,
  DURATION_MAX,
  formatDuration,
  SERVICE_DESCRIPTION_MAX,
  updateService,
  validateService,
  type ProviderService,
  type ServiceCategory,
  type ServiceField,
} from "@/lib/services";
import { errorMessage } from "@/lib/users";
import type { FieldErrors } from "@/lib/validation";

const QUICK_DURATIONS = [15, 30, 45, 60, 90, 120];

/** Ajout ou modification d'une prestation (nom, catégorie, durée, prix, description). */
export function ServiceDialog({
  service,
  categories,
  defaultCategory,
  onClose,
  onSaved,
}: {
  service?: ProviderService;
  categories: ServiceCategory[];
  defaultCategory: string;
  onClose: () => void;
  onSaved: (service: ProviderService) => void;
}) {
  const [form, setForm] = useState({
    name: service?.name ?? "",
    category: service?.category ?? defaultCategory,
    durationMinutes: String(service?.durationMinutes ?? 30),
    price: service ? String(service.price).replace(".", ",") : "",
    description: service?.description ?? "",
  });
  const [errors, setErrors] = useState<FieldErrors<ServiceField>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const overnight = Number(form.durationMinutes) === DURATION_MAX;

  const update = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  async function save() {
    setFormError("");
    const input = { ...form, durationMinutes: Number(form.durationMinutes), status: service?.status ?? "published" };
    const { value, errors: found } = validateService(input);
    if (Object.values(found).some(Boolean)) {
      setErrors(found);
      return;
    }
    setBusy(true);
    try {
      onSaved(service ? await updateService(service.id, value) : await createService(value));
    } catch (e) {
      setFormError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Modal title={service ? "Modifier la prestation" : "Nouvelle prestation"} icon="design_services" onClose={onClose}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="flex flex-col gap-space-md"
      >
        <TextField label="Nom de la prestation *" maxLength={80} placeholder="Ex : Bain complet & démêlage doux" value={form.name} onChange={(e) => update("name", e.target.value)} error={errors.name} />
        <label className="flex flex-col gap-space-xs">
          <span className="font-label-lg text-label-lg text-on-surface">Catégorie *</span>
          <select
            value={form.category}
            onChange={(e) => update("category", e.target.value)}
            className="h-11 rounded-lg bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          {errors.category && <span className="font-body-sm text-body-sm text-error">{errors.category}</span>}
        </label>
        <div className="flex flex-col gap-space-xs">
          <span className={`font-label-lg text-label-lg ${errors.durationMinutes ? "text-error" : "text-on-surface"}`}>Durée *</span>
          <div className="flex flex-wrap items-center gap-2">
            {QUICK_DURATIONS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => update("durationMinutes", String(m))}
                className={`h-9 px-3 rounded-full font-label-md text-label-md ${Number(form.durationMinutes) === m ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface-variant"}`}
              >
                {formatDuration(m)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => update("durationMinutes", String(DURATION_MAX))}
              className={`h-9 px-3 rounded-full font-label-md text-label-md ${overnight ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface-variant"}`}
            >
              1 nuit (pension)
            </button>
            {!overnight && (
              <span className="inline-flex items-center gap-1">
                <input
                  type="number"
                  min={5}
                  max={DURATION_MAX}
                  step={5}
                  aria-label="Durée en minutes"
                  value={form.durationMinutes}
                  onChange={(e) => update("durationMinutes", e.target.value)}
                  className="h-9 w-20 rounded-lg bg-surface-container-low px-2 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <span className="font-body-sm text-body-sm text-on-surface-variant">min</span>
              </span>
            )}
          </div>
          {errors.durationMinutes && <span className="font-body-sm text-body-sm text-error">{errors.durationMinutes}</span>}
        </div>
        <TextField
          label="Prix indicatif (DT) *"
          icon="payments"
          inputMode="decimal"
          placeholder="Ex : 35"
          value={form.price}
          onChange={(e) => update("price", e.target.value)}
          error={errors.price}
          help="Réglé sur place : aucun paiement en ligne. 0 = gratuit."
        />
        <TextArea
          label="Description"
          hint={`${form.description.length} / ${SERVICE_DESCRIPTION_MAX}`}
          rows={3}
          maxLength={SERVICE_DESCRIPTION_MAX}
          placeholder="Ex : chiens petits et moyens, shampoing doux, séchage…"
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          error={errors.description}
        />
        {formError && <p role="alert" className="font-body-sm text-body-sm text-error">{formError}</p>}
        <div className="flex justify-end gap-space-sm">
          <button type="button" onClick={onClose} className="h-11 px-space-lg rounded-xl bg-surface-container text-on-surface font-label-md text-label-md">
            Annuler
          </button>
          <button type="submit" disabled={busy} className="h-11 px-space-xl rounded-xl bg-primary text-on-primary font-label-md text-label-md shadow-md hover:bg-primary-container disabled:opacity-60">
            {busy ? "Enregistrement…" : service ? "Enregistrer" : "Créer la prestation"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
