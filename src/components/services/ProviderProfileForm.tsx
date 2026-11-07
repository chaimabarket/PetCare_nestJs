"use client";

import { useRef, useState } from "react";
import { TextArea, TextField } from "@/components/ui/TextField";
import { Icon } from "@/components/ui/Icon";
import { compressImage, LISTING_PHOTO_SIZE } from "@/lib/images";
import {
  EMPTY_PROVIDER_INPUT,
  PROVIDER_DESCRIPTION_MAX,
  saveMyProvider,
  validateProvider,
  type ProviderField,
  type ProviderInput,
  type ServiceCategory,
  type ServiceProvider,
} from "@/lib/services";
import { errorMessage } from "@/lib/users";
import type { FieldErrors } from "@/lib/validation";

const pick = (p: ServiceProvider): ProviderInput => ({
  name: p.name,
  category: p.category,
  city: p.city,
  description: p.description,
  phone: p.phone,
  email: p.email,
  address: p.address,
  photo: p.photo,
});

/** Création ou modification du profil prestataire : chaque enregistrement le (re)met en validation. */
export function ProviderProfileForm({
  provider,
  categories,
  defaultEmail = "",
  onSaved,
  onCancel,
}: {
  provider?: ServiceProvider;
  categories: ServiceCategory[];
  defaultEmail?: string;
  onSaved: (provider: ServiceProvider) => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState<ProviderInput>(provider ? pick(provider) : { ...EMPTY_PROVIDER_INPUT, email: defaultEmail });
  const [errors, setErrors] = useState<FieldErrors<ProviderField>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const update = (key: keyof ProviderInput, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setProcessing(true);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("La photo doit faire moins de 10 Mo.");
      update("photo", await compressImage(file, LISTING_PHOTO_SIZE));
    } catch (e) {
      setErrors((er) => ({ ...er, photo: errorMessage(e) }));
    } finally {
      setProcessing(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function save() {
    setFormError("");
    const { errors: found } = validateProvider(form);
    if (Object.values(found).some(Boolean)) {
      setErrors(found);
      setFormError("Certains champs sont à corriger.");
      return;
    }
    setBusy(true);
    try {
      onSaved(await saveMyProvider(form));
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="flex flex-col gap-space-lg"
    >
      <div className="flex items-center gap-space-md">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="relative w-24 h-24 rounded-2xl overflow-hidden bg-primary-fixed/40 text-primary flex items-center justify-center shrink-0 group"
          aria-label="Choisir une photo"
        >
          {form.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.photo} alt="" className="w-full h-full object-cover" />
          ) : (
            <Icon name={processing ? "progress_activity" : "add_a_photo"} className={`text-[32px] ${processing ? "animate-spin" : ""}`} />
          )}
          <span className="absolute inset-x-0 bottom-0 bg-black/40 text-white text-[11px] py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            Changer
          </span>
        </button>
        <div className="flex flex-col gap-1">
          <span className="font-label-lg text-label-lg text-on-surface">Photo de l&apos;établissement</span>
          <span className="font-body-sm text-body-sm text-on-surface-variant">Facultative · JPG, PNG ou WebP, compressée automatiquement.</span>
          {form.photo && (
            <button type="button" onClick={() => update("photo", "")} className="self-start font-label-sm text-label-sm text-error hover:underline">
              Retirer la photo
            </button>
          )}
          {errors.photo && <span className="font-body-sm text-body-sm text-error">{errors.photo}</span>}
        </div>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
        <TextField label="Nom de l'établissement *" maxLength={80} placeholder="Ex : Toilettage Amine" value={form.name} onChange={(e) => update("name", e.target.value)} error={errors.name} />
        <label className="flex flex-col gap-space-xs">
          <span className={`font-label-lg text-label-lg ${errors.category ? "text-error" : "text-on-surface"}`}>Catégorie *</span>
          <select
            value={form.category}
            onChange={(e) => update("category", e.target.value)}
            className={`h-11 rounded-lg bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none focus:ring-2 ${errors.category ? "ring-2 ring-error" : "focus:ring-primary/20"}`}
          >
            <option value="">Choisir…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          {errors.category && <span className="font-body-sm text-body-sm text-error">{errors.category}</span>}
        </label>
        <TextField label="Ville *" icon="location_city" maxLength={60} placeholder="Ex : La Marsa" value={form.city} onChange={(e) => update("city", e.target.value)} error={errors.city} />
        <TextField label="Adresse" icon="location_on" hint="Facultatif" maxLength={200} placeholder="Ex : Avenue Habib Bourguiba" value={form.address} onChange={(e) => update("address", e.target.value)} error={errors.address} />
        <TextField label="Téléphone *" icon="call" type="tel" maxLength={20} placeholder="+216 98 123 456" value={form.phone} onChange={(e) => update("phone", e.target.value)} error={errors.phone} />
        <TextField label="E-mail de contact *" icon="mail" type="email" maxLength={120} placeholder="contact@exemple.tn" value={form.email} onChange={(e) => update("email", e.target.value)} error={errors.email} />
      </div>
      <TextArea
        label="Présentation"
        hint={`${form.description.length} / ${PROVIDER_DESCRIPTION_MAX}`}
        rows={4}
        maxLength={PROVIDER_DESCRIPTION_MAX}
        placeholder="Votre expérience, vos spécialités, votre façon de travailler…"
        value={form.description}
        onChange={(e) => update("description", e.target.value)}
        error={errors.description}
      />

      <p className="rounded-xl bg-amber-50 text-amber-900 p-space-md font-body-sm text-body-sm flex items-start gap-2">
        <Icon name="hourglass_top" className="text-[18px] mt-0.5" />
        {provider
          ? "Toute modification renvoie votre profil en validation : il sera masqué de l'annuaire jusqu'à la nouvelle validation par l'équipe PetCare."
          : "Votre profil sera visible dans l'annuaire après validation par l'équipe PetCare. Vous pouvez préparer vos prestations en attendant."}
      </p>
      {formError && <p role="alert" className="font-body-sm text-body-sm text-error">{formError}</p>}

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-space-sm">
        {onCancel && (
          <button type="button" onClick={onCancel} className="h-11 px-space-lg rounded-xl bg-surface-container text-on-surface font-label-md text-label-md">
            Annuler
          </button>
        )}
        <button
          type="submit"
          disabled={busy || processing}
          className="h-11 px-space-xl rounded-xl bg-primary text-on-primary font-label-md text-label-md shadow-md hover:bg-primary-container disabled:opacity-60 inline-flex items-center justify-center gap-2"
        >
          <Icon name={busy ? "progress_activity" : "send"} className={`text-[18px] ${busy ? "animate-spin" : ""}`} />
          {provider ? "Enregistrer et envoyer en validation" : "Créer mon profil"}
        </button>
      </div>
    </form>
  );
}
