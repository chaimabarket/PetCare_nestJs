"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { TextArea, TextField } from "@/components/ui/TextField";
import { compressImage, LISTING_PHOTO_SIZE, thumbnailFrom } from "@/lib/images";
import {
  addPhoto,
  ageLabel,
  createPet,
  EMPTY_PET_INPUT,
  formatKg,
  localDay,
  MAX_PET_PHOTOS,
  NOTES_MAX_LENGTH,
  PET_ROUTES,
  PET_SPECIES,
  removePhoto,
  SPECIES_INFO,
  updatePet,
  validatePetInput,
  validateWeight,
  WEIGHT_CONFIRM_RATIO,
  weightChangeRatio,
  type Pet,
  type PetField,
  type PetInput,
  type PetSex,
} from "@/lib/pets";
import { errorMessage } from "@/lib/users";
import type { FieldErrors } from "@/lib/validation";

/** Photo du formulaire : `id` pour une photo déjà enregistrée, absent pour une nouvelle. */
type FormPhoto = { key: string; id?: string; url: string; thumbnail: string };
type FormField = PetField | "weightKg" | "photos";

/** Taille maximale d'un fichier choisi (avant compression dans le navigateur). */
const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Poids cumulé des photos compressées (marge sous la limite du serveur). */
const MAX_PHOTOS_TOTAL = 1_600_000;

const toInput = (pet: Pet): PetInput => ({
  name: pet.name,
  species: pet.species,
  sex: pet.sex,
  breed: pet.breed,
  birthDate: pet.birthDate,
  birthDateEstimated: pet.birthDateEstimated,
  chipNumber: pet.chipNumber,
  sterilized: pet.sterilized,
  notes: pet.notes,
  vet: pet.vet,
});

let photoCounter = 0;
const newKey = () => `new-${++photoCounter}`;

/** Ajout (`pet` absent) ou modification d'un animal (maquette ajouter_un_animal_mes_animaux_petcare_community). */
export function PetForm({ pet }: { pet?: Pet }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<PetInput>(pet ? toInput(pet) : EMPTY_PET_INPUT);
  const [photos, setPhotos] = useState<FormPhoto[]>(pet ? pet.photos.map((p) => ({ ...p, key: p.id })) : []);
  const [weight, setWeight] = useState("");
  const [errors, setErrors] = useState<FieldErrors<FormField>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState<"draft" | "save" | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showVet, setShowVet] = useState(Boolean(pet && Object.values(pet.vet).some(Boolean)));
  const today = localDay();
  const canDraft = !pet || pet.status === "draft";
  const age = ageLabel(form.birthDate, today);

  function update<K extends keyof PetInput>(key: K, value: PetInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function updateVet(key: keyof PetInput["vet"], value: string) {
    setForm((f) => ({ ...f, vet: { ...f.vet, [key]: value } }));
    const field = `vet${key[0].toUpperCase()}${key.slice(1)}` as PetField;
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setErrors((e) => ({ ...e, photos: undefined }));
    const room = MAX_PET_PHOTOS - photos.length;
    const chosen = [...files].slice(0, room);
    if (chosen.some((f) => f.size > MAX_FILE_BYTES)) {
      setErrors((e) => ({ ...e, photos: "Chaque photo doit faire moins de 10 Mo." }));
      return;
    }
    setProcessing(true);
    try {
      const added = await Promise.all(
        chosen.map(async (file) => {
          const url = await compressImage(file, LISTING_PHOTO_SIZE);
          return { key: newKey(), url, thumbnail: await thumbnailFrom(url) };
        }),
      );
      const next = [...photos, ...added];
      if (next.reduce((sum, p) => sum + p.url.length + p.thumbnail.length, 0) > MAX_PHOTOS_TOTAL) {
        setErrors((e) => ({ ...e, photos: "Les photos sont trop lourdes : retirez-en une." }));
        return;
      }
      setPhotos(next);
      if (files.length > room) setErrors((e) => ({ ...e, photos: `${MAX_PET_PHOTOS} photos maximum.` }));
    } catch (error) {
      setErrors((e) => ({ ...e, photos: errorMessage(error) }));
    } finally {
      setProcessing(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function movePhoto(index: number, to: number) {
    setPhotos((list) => {
      const next = [...list];
      const [moved] = next.splice(index, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  async function save(draft: boolean) {
    setFormError("");
    const { value, errors: found } = validatePetInput(form, { draft, today });
    const next: FieldErrors<FormField> = { ...found };
    let weightValue: { day: string; weightKg: number } | undefined;
    if (weight.trim()) {
      const result = validateWeight({ day: today, weightKg: weight }, { today, birthDate: value.birthDate });
      if (result.errors.weightKg) next.weightKg = result.errors.weightKg;
      weightValue = { day: today, weightKg: result.value.weightKg };
    }
    if (Object.values(next).some(Boolean)) {
      setErrors(next);
      if (Object.keys(next).some((k) => k.startsWith("vet"))) setShowVet(true);
      setFormError("Certains champs sont à corriger.");
      return;
    }
    const previous = pet?.latestWeight;
    if (
      weightValue &&
      previous &&
      previous.day !== today &&
      weightChangeRatio(previous.kg, weightValue.weightKg) > WEIGHT_CONFIRM_RATIO &&
      !window.confirm(
        `Le dernier poids enregistré était de ${formatKg(previous.kg)}. Confirmez-vous ${formatKg(weightValue.weightKg)} ?`,
      )
    ) {
      return;
    }

    setBusy(draft ? "draft" : "save");
    try {
      if (!pet) {
        const created = await createPet({
          pet: value,
          draft,
          photos: photos.map(({ url, thumbnail }) => ({ url, thumbnail })),
          weight: weightValue,
        });
        router.push(PET_ROUTES.pet(created.id));
        return;
      }
      // Photos : retirer celles supprimées, envoyer les nouvelles, puis enregistrer l'ordre (couverture en premier).
      for (const old of pet.photos.filter((p) => !photos.some((f) => f.id === p.id))) {
        await removePhoto(pet.id, old.id);
      }
      const ids: string[] = [];
      for (const photo of photos) {
        if (photo.id) {
          ids.push(photo.id);
          continue;
        }
        const saved = await addPhoto(pet.id, { url: photo.url, thumbnail: photo.thumbnail });
        const id = saved.photos[saved.photos.length - 1].id;
        ids.push(id);
        // En cas d'erreur plus loin, un nouvel essai ne renverra pas cette photo.
        setPhotos((list) => list.map((p) => (p.key === photo.key ? { ...p, id } : p)));
      }
      await updatePet(pet.id, { pet: value, draft, photoOrder: ids, weight: weightValue });
      router.push(PET_ROUTES.pet(pet.id));
    } catch (error) {
      setFormError(errorMessage(error));
      setBusy(null);
    }
  }

  const backHref = pet ? PET_ROUTES.pet(pet.id) : PET_ROUTES.list;

  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-space-lg md:p-space-xl flex flex-col gap-space-xl">
      <div className="flex flex-col gap-space-sm bg-surface-container-low/40 p-space-lg rounded-xl relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-48 h-48 bg-primary/5 rounded-full pointer-events-none blur-2xl" />
        <div className="flex items-center gap-space-sm text-primary">
          <Icon name={pet ? "edit" : "add_circle"} filled className="text-[28px]" />
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary font-semibold">
            {pet ? (pet.status === "draft" ? "Brouillon" : "Fiche de l'animal") : "Nouveau compagnon"}
          </span>
        </div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
          {pet ? `Modifier la fiche de ${pet.name}` : "Ajouter un animal"}
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
          Renseignez les informations de votre compagnon pour suivre son poids, ses contacts utiles et son carnet au quotidien.
        </p>
      </div>

      {/* Photos */}
      <section className="flex flex-col gap-space-md">
        <div className="flex flex-col gap-space-xs">
          <div className="flex items-center justify-between">
            <span className="font-label-lg text-label-lg text-on-surface flex items-center gap-space-xs">
              Photos du compagnon
              <span className="text-on-surface-variant font-body-sm text-body-sm font-normal">({MAX_PET_PHOTOS} max)</span>
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant bg-surface-container-high px-space-sm py-0.5 rounded-full">
              {photos.length} / {MAX_PET_PHOTOS}
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Format JPG, PNG ou WEBP. La première photo sert de portrait principal ; utilisez les flèches pour changer l&apos;ordre.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-space-md">
          {photos.map((photo, index) => (
            <div key={photo.key} className="relative group aspect-square rounded-xl overflow-hidden bg-surface-container shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.thumbnail} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-inverse-surface/70 via-transparent to-transparent opacity-80" />
              {index === 0 ? (
                <span className="absolute top-2 left-2 bg-primary text-on-primary text-[10px] font-label-sm px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                  <Icon name="star" filled className="text-[12px]" />
                  Principale
                </span>
              ) : (
                <PhotoAction label="Choisir comme photo principale" icon="star" className="absolute top-2 left-2" onClick={() => movePhoto(index, 0)} />
              )}
              <div className="absolute bottom-2 inset-x-2 flex items-center justify-between gap-1">
                <div className="flex gap-1">
                  {index > 0 && <PhotoAction label="Déplacer vers la gauche" icon="chevron_left" onClick={() => movePhoto(index, index - 1)} />}
                  {index < photos.length - 1 && (
                    <PhotoAction label="Déplacer vers la droite" icon="chevron_right" onClick={() => movePhoto(index, index + 1)} />
                  )}
                </div>
                <PhotoAction
                  label="Retirer la photo"
                  icon="delete"
                  danger
                  onClick={() => setPhotos((list) => list.filter((p) => p.key !== photo.key))}
                />
              </div>
            </div>
          ))}
          {photos.length < MAX_PET_PHOTOS && (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={processing}
              className="aspect-square rounded-xl bg-surface-container-low hover:bg-surface-container transition-all flex flex-col items-center justify-center gap-1 group text-primary p-space-sm cursor-pointer shadow-sm disabled:opacity-60"
            >
              <span className="w-10 h-10 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-on-primary flex items-center justify-center transition-colors">
                <Icon name={processing ? "progress_activity" : "add_a_photo"} className={`text-[22px] ${processing ? "animate-spin" : ""}`} />
              </span>
              <span className="font-label-sm text-label-sm font-semibold mt-1">+ Ajouter</span>
              <span className="text-[10px] text-on-surface-variant">Max. 10 Mo</span>
            </button>
          )}
          {Array.from({ length: Math.max(0, MAX_PET_PHOTOS - photos.length - 1) }, (_, i) => (
            <div
              key={`empty-${i}`}
              aria-hidden
              className="hidden md:flex aspect-square rounded-xl bg-surface-container-lowest/60 flex-col items-center justify-center text-outline-variant"
            >
              <Icon name="image" className="text-[24px]" />
              <span className="text-[11px] font-body-sm mt-1">Emplacement {photos.length + i + 2}</span>
            </div>
          ))}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
        {errors.photos && <FieldError>{errors.photos}</FieldError>}
      </section>

      <div className="h-px bg-surface-container-high w-full" />

      <form
        className="flex flex-col gap-space-lg"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save(false);
        }}
      >
        {/* Nom et espèce */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-space-lg items-start">
          <TextField
            className="md:col-span-5"
            label="Nom de l'animal *"
            hint="Requis"
            placeholder="Ex : Milo, Nala, Rocky…"
            maxLength={80}
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            error={errors.name}
          />
          <fieldset className="md:col-span-7 flex flex-col gap-space-xs">
            <legend className="font-label-lg text-label-lg text-on-surface mb-space-xs">Espèce *</legend>
            <div className="flex flex-wrap items-center gap-space-xs">
              {PET_SPECIES.map((species) => {
                const selected = form.species === species;
                return (
                  <button
                    key={species}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => update("species", species)}
                    className={`h-11 px-space-md rounded-full font-label-md text-label-md flex items-center gap-space-xs transition-all ${
                      selected
                        ? "bg-primary text-on-primary shadow-sm shadow-primary/20"
                        : "bg-surface-container-low hover:bg-surface-container text-on-surface-variant"
                    }`}
                  >
                    <span className="text-[17px]">{SPECIES_INFO[species].emoji}</span>
                    <span className={selected ? "font-semibold" : ""}>{SPECIES_INFO[species].label}</span>
                    {selected && <Icon name="check_circle" filled className="text-[16px]" />}
                  </button>
                );
              })}
            </div>
            {errors.species && <FieldError>{errors.species}</FieldError>}
          </fieldset>
        </div>

        {/* Race (ou animal libre) et sexe */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-space-lg items-start">
          <TextField
            className="md:col-span-6"
            icon={form.species === "other" ? "pets" : "search"}
            label={form.species === "other" ? "Quel animal ? *" : "Race ou type racial"}
            hint={form.species === "other" ? "Requis" : "Facultatif"}
            placeholder={form.species === "other" ? "Ex : Furet, Tortue, Ours…" : "Ex : Européen, Golden Retriever, Croisé…"}
            help={form.species === "other" ? "Précisez l'animal : il s'affiche à la place de l'espèce." : "Indiquez « Croisé » en cas de doute."}
            maxLength={80}
            value={form.breed}
            onChange={(e) => update("breed", e.target.value)}
            error={errors.breed}
          />
          <fieldset className="md:col-span-6 flex flex-col gap-space-xs">
            <legend className="font-label-lg text-label-lg text-on-surface mb-space-xs">Sexe * &amp; stérilisation</legend>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-space-md">
              <div role="radiogroup" aria-label="Sexe" className="h-11 p-1 bg-surface-container-high rounded-full flex items-center flex-1">
                {(["male", "female"] as PetSex[]).map((sex) => (
                  <button
                    key={sex}
                    type="button"
                    role="radio"
                    aria-checked={form.sex === sex}
                    onClick={() => update("sex", sex)}
                    className={`flex-1 h-full rounded-full font-label-md text-label-md flex items-center justify-center gap-1.5 transition-all ${
                      form.sex === sex ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    <span className={`font-bold text-[15px] ${sex === "male" ? "text-primary" : "text-secondary"}`}>
                      {sex === "male" ? "♂" : "♀"}
                    </span>
                    {sex === "male" ? "Mâle" : "Femelle"}
                  </button>
                ))}
              </div>
              <label className="inline-flex items-center gap-space-sm px-space-md py-2 rounded-lg bg-surface-container-low cursor-pointer hover:bg-surface-container transition-colors shrink-0">
                <input
                  type="checkbox"
                  checked={form.sterilized}
                  onChange={(e) => update("sterilized", e.target.checked)}
                  className="w-4 h-4 rounded accent-primary"
                />
                <span className="font-label-md text-label-md text-on-surface">Stérilisé / Castré</span>
              </label>
            </div>
            {errors.sex && <FieldError>{errors.sex}</FieldError>}
          </fieldset>
        </div>

        {/* Naissance et poids */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-space-lg items-start">
          <div className="md:col-span-6 flex flex-col gap-space-xs">
            <TextField
              icon="calendar_today"
              type="date"
              label="Date de naissance"
              hint={
                age ? (
                  <span className="text-primary bg-primary-fixed/40 px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1">
                    <Icon name="hourglass_top" className="text-[13px]" />
                    {form.birthDateEstimated ? "Âge estimé" : "Âge"} : {age}
                  </span>
                ) : (
                  "Facultatif"
                )
              }
              max={today}
              value={form.birthDate}
              onChange={(e) => update("birthDate", e.target.value)}
              error={errors.birthDate}
              help="Si vous ne connaissez pas le jour exact, choisissez le 1er du mois présumé."
            />
            <label className="inline-flex items-center gap-space-sm cursor-pointer self-start">
              <input
                type="checkbox"
                checked={form.birthDateEstimated}
                disabled={!form.birthDate}
                onChange={(e) => update("birthDateEstimated", e.target.checked)}
                className="w-4 h-4 rounded accent-primary"
              />
              <span className="font-body-sm text-body-sm text-on-surface-variant">Date estimée</span>
            </label>
          </div>
          <TextField
            className="md:col-span-6"
            icon="scale"
            type="text"
            inputMode="decimal"
            label={pet ? "Pesée du jour (kg)" : "Poids actuel (kg)"}
            hint="Facultatif"
            placeholder={pet?.latestWeight ? `Dernier poids : ${formatKg(pet.latestWeight.kg)}` : "Ex : 4,2"}
            value={weight}
            onChange={(e) => {
              setWeight(e.target.value);
              setErrors((er) => ({ ...er, weightKg: undefined }));
            }}
            error={errors.weightKg}
            help="Enregistré comme pesée d'aujourd'hui : il alimente la courbe de poids."
          />
        </div>

        <TextField
          icon="qr_code_scanner"
          label="Numéro d'identification (puce)"
          hint="Facultatif · 15 chiffres"
          inputMode="numeric"
          placeholder="250 26 87 12 345678"
          maxLength={20}
          value={form.chipNumber}
          onChange={(e) => update("chipNumber", e.target.value)}
          error={errors.chipNumber}
        />

        <TextArea
          label="Notes de tempérament & particularités"
          hint={`${form.notes.length} / ${NOTES_MAX_LENGTH}`}
          rows={4}
          maxLength={NOTES_MAX_LENGTH}
          placeholder="Habitudes, allergies, régime alimentaire, craintes particulières (aspirateur, orages), entente avec ses congénères…"
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          error={errors.notes}
          help="Ces éléments aideront votre vétérinaire et les personnes qui gardent votre animal."
        />

        {/* Vétérinaire référent (saisi à la main) */}
        <section className="rounded-xl bg-surface-container-low/60 p-space-md flex flex-col gap-space-md">
          <button
            type="button"
            onClick={() => setShowVet((v) => !v)}
            aria-expanded={showVet}
            className="flex items-center justify-between gap-space-sm text-left"
          >
            <span className="flex items-center gap-space-sm">
              <span className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Icon name="stethoscope" className="text-[20px]" />
              </span>
              <span className="flex flex-col">
                <span className="font-label-lg text-label-lg text-on-surface">Vétérinaire référent</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">Facultatif · affiché sur la fiche avec un bouton d&apos;appel</span>
              </span>
            </span>
            <Icon name={showVet ? "expand_less" : "expand_more"} className="text-on-surface-variant" />
          </button>
          {showVet && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
              <TextField label="Nom" placeholder="Dr Sophie Martin" maxLength={120} value={form.vet.name} onChange={(e) => updateVet("name", e.target.value)} error={errors.vetName} />
              <TextField label="Clinique" placeholder="Clinique vétérinaire du Lac" maxLength={120} value={form.vet.clinic} onChange={(e) => updateVet("clinic", e.target.value)} error={errors.vetClinic} />
              <TextField label="Adresse" placeholder="12 rue des Jasmins, Tunis" maxLength={120} value={form.vet.address} onChange={(e) => updateVet("address", e.target.value)} error={errors.vetAddress} />
              <TextField label="Téléphone" type="tel" placeholder="+216 71 000 000" maxLength={20} value={form.vet.phone} onChange={(e) => updateVet("phone", e.target.value)} error={errors.vetPhone} />
            </div>
          )}
        </section>

        <div className="bg-surface-container-low/70 rounded-xl p-space-md flex items-start gap-space-md">
          <span className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Icon name="verified_user" className="text-[20px]" />
          </span>
          <span className="flex flex-col">
            <span className="font-label-md text-label-md text-on-surface font-semibold">Protection &amp; partage contrôlé</span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              La fiche reste privée. Le partage ne montre que le nom, l&apos;espèce, la race, le sexe et l&apos;âge : jamais la puce, les
              notes ni les données médicales.
            </span>
          </span>
        </div>

        {formError && <Alert>{formError}</Alert>}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-space-md pt-space-md">
          <Link
            href={backHref}
            className="w-full sm:w-auto h-11 px-space-lg rounded-full bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors flex items-center justify-center gap-space-xs"
          >
            <Icon name="arrow_back" className="text-[18px]" />
            Annuler
          </Link>
          <div className="flex flex-col-reverse sm:flex-row items-center gap-space-md w-full sm:w-auto">
            {canDraft && (
              <button
                type="button"
                onClick={() => void save(true)}
                disabled={Boolean(busy) || processing}
                className="h-11 px-space-md rounded-full text-primary hover:bg-primary/10 font-label-md text-label-md transition-colors inline-flex items-center gap-1 disabled:opacity-60"
              >
                <Icon name={busy === "draft" ? "progress_activity" : "drafts"} className={`text-[18px] ${busy === "draft" ? "animate-spin" : ""}`} />
                Enregistrer comme brouillon
              </button>
            )}
            <button
              type="submit"
              disabled={Boolean(busy) || processing}
              className="w-full sm:w-auto h-11 px-space-xl rounded-full bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-all shadow-md flex items-center justify-center gap-space-xs group disabled:opacity-70"
            >
              <Icon
                name={busy === "save" ? "progress_activity" : "pets"}
                filled
                className={`text-[20px] ${busy === "save" ? "animate-spin" : "transition-transform group-hover:scale-110"}`}
              />
              <span className="font-semibold tracking-wide">{pet && pet.status !== "draft" ? "Enregistrer" : "Enregistrer le profil"}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function PhotoAction({
  label,
  icon,
  onClick,
  danger = false,
  className = "",
}: {
  label: string;
  icon: string;
  onClick: () => void;
  danger?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`w-7 h-7 rounded-full bg-surface-container-lowest/90 backdrop-blur-sm flex items-center justify-center shadow-sm transition-colors ${
        danger ? "text-error hover:bg-error hover:text-on-error" : "text-on-surface hover:text-primary"
      } ${className}`}
    >
      <Icon name={icon} className="text-[15px]" />
    </button>
  );
}

function FieldError({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-1 font-body-sm text-body-sm text-error">
      <Icon name="warning" className="text-[16px]" />
      {children}
    </p>
  );
}
