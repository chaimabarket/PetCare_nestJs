"use client";

import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ListingWriterButton } from "@/components/assistant/ListingWriterButton";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { TextArea, TextField } from "@/components/ui/TextField";
import { Toggle } from "@/components/ui/Toggle";
import {
  ADOPTION_ROUTES,
  AGE_GROUPS,
  createListing,
  ENERGY_LEVELS,
  keysOf,
  MAX_ALONE_HOURS,
  MAX_PHOTOS,
  PERSONALITY,
  SEXES,
  SIZES,
  SPECIES,
  STORY_MAX_LENGTH,
  TEXT_MAX_LENGTH,
  updateListing,
  type AdoptionListing,
  type Compatibility,
  type ListingInput,
} from "@/lib/adoption";
import { compressImage, dataUrlBytes, LISTING_PHOTO_SIZE, MAX_PHOTOS_BYTES, thumbnailFrom } from "@/lib/images";
import { errorMessage } from "@/lib/users";
import { ListingCard } from "./ListingCard";
import { Chip } from "./ui";

type Errors = Partial<Record<"name" | "ageLabel" | "city" | "photos" | "story", string>>;

function emptyInput(city: string): ListingInput {
  return {
    name: "",
    title: "",
    species: "chat",
    breed: "",
    sex: "femelle",
    ageGroup: "adulte",
    ageLabel: "",
    size: "moyen",
    city,
    photos: [],
    thumbnail: "",
    story: "",
    needs: "",
    conditions: "",
    personality: [],
    compatibility: { kids: false, cats: false, dogs: false, garden: false },
    energy: "moyen",
    aloneHours: 4,
    adoptMe: false,
  };
}

function inputFrom(listing: AdoptionListing): ListingInput {
  const base = emptyInput(listing.city);
  return Object.fromEntries(Object.keys(base).map((key) => [key, listing[key as keyof ListingInput]])) as ListingInput;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-space-xs">
      <span className="font-label-lg text-label-lg text-on-surface">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FormCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-md">
      <h2 className="font-headline-sm text-headline-sm text-on-surface">{title}</h2>
      {children}
    </section>
  );
}

const COMPATIBILITY_LABELS: Record<keyof Compatibility, string> = {
  kids: "OK enfants",
  cats: "OK chats",
  dogs: "OK chiens",
  garden: "Besoin d'un jardin",
};

/** Formulaire de publication / modification d'une annonce (5.9). */
export function ListingForm({ listing }: { listing?: AdoptionListing }) {
  const router = useRouter();
  const { profile } = useAuth();
  const [form, setForm] = useState<ListingInput>(() => (listing ? inputFrom(listing) : emptyInput(profile?.city ?? "")));
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);
  const [processing, setProcessing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isDraft = !listing || listing.status === "brouillon";

  function update<K extends keyof ListingInput>(key: K, value: ListingInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setProcessing(true);
    setErrors((e) => ({ ...e, photos: undefined }));
    try {
      const room = MAX_PHOTOS - form.photos.length;
      const added = await Promise.all([...files].slice(0, room).map((file) => compressImage(file, LISTING_PHOTO_SIZE)));
      const photos = [...form.photos, ...added];
      if (dataUrlBytes(photos) > MAX_PHOTOS_BYTES) {
        setErrors((e) => ({ ...e, photos: "Les photos sont trop lourdes : retirez-en une ou choisissez des images plus légères." }));
        return;
      }
      setForm((current) => ({ ...current, photos }));
      if (files.length > room) setErrors((e) => ({ ...e, photos: `${MAX_PHOTOS} photos maximum.` }));
    } catch (error) {
      setErrors((e) => ({ ...e, photos: errorMessage(error) }));
    } finally {
      setProcessing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removePhoto(index: number) {
    update("photos", form.photos.filter((_, i) => i !== index));
  }

  function makeCover(index: number) {
    const photos = [...form.photos];
    const [photo] = photos.splice(index, 1);
    update("photos", [photo, ...photos]);
  }

  function validate(publish: boolean): boolean {
    const next: Errors = {};
    if (!form.name.trim()) next.name = "Le nom de l'animal est obligatoire.";
    if (publish) {
      if (!form.ageLabel.trim()) next.ageLabel = "Indiquez l'âge (ex. « 2 ans »).";
      if (!form.city.trim()) next.city = "La ville est obligatoire.";
      if (form.photos.length === 0) next.photos = "Ajoutez au moins une photo.";
      if (form.story.trim().length < 30) next.story = "Racontez son histoire en quelques phrases (30 caractères minimum).";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function save(publish: boolean) {
    setMessage("");
    if (!validate(publish) || !profile) return;
    setSaving(publish ? "publish" : "draft");
    try {
      const input: ListingInput = {
        ...form,
        name: form.name.trim(),
        title: form.title.trim(),
        breed: form.breed.trim(),
        ageLabel: form.ageLabel.trim(),
        city: form.city.trim(),
        story: form.story.trim(),
        needs: form.needs.trim(),
        conditions: form.conditions.trim(),
        thumbnail: form.photos[0] ? await thumbnailFrom(form.photos[0]) : "",
      };
      const id = listing ? listing.id : await createListing(profile, input, publish);
      if (listing) await updateListing(listing, input, publish);
      router.push(publish || !isDraft ? ADOPTION_ROUTES.listing(id) : ADOPTION_ROUTES.myListings);
    } catch (error) {
      setMessage(errorMessage(error));
      setSaving(null);
    }
  }

  const preview: AdoptionListing = {
    ...form,
    id: listing?.id ?? "apercu",
    thumbnail: form.photos[0] ?? "",
    name: form.name || "Nom de l'animal",
    city: form.city || "Ville",
    ownerId: profile?.uid ?? "",
    ownerName: profile?.displayName ?? "",
    ownerRole: profile?.role ?? "proprietaire",
    ownerCity: profile?.city ?? "",
    status: "disponible",
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save(isDraft);
        }}
        className="lg:col-span-8 flex flex-col gap-space-lg"
      >
        <FormCard title="Photos">
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-space-sm">
            {form.photos.map((photo, index) => (
              <div key={index} className="relative aspect-square rounded-xl overflow-hidden group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                {index === 0 ? (
                  <span className="absolute bottom-1 left-1 px-2 py-0.5 rounded-full bg-primary text-on-primary font-label-sm text-label-sm">
                    Couverture
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => makeCover(index)}
                    className="absolute bottom-1 left-1 px-2 py-0.5 rounded-full bg-surface-container-lowest/90 font-label-sm text-label-sm opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  >
                    Couverture
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  aria-label={`Retirer la photo ${index + 1}`}
                  className="absolute top-1 right-1 w-7 h-7 rounded-full bg-surface-container-lowest/90 text-error flex items-center justify-center shadow-sm"
                >
                  <Icon name="close" className="text-[16px]" />
                </button>
              </div>
            ))}
            {form.photos.length < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={processing}
                className="aspect-square rounded-xl border-2 border-dashed border-outline-variant text-primary flex flex-col items-center justify-center gap-1 hover:bg-surface-container-low transition-colors disabled:opacity-60"
              >
                <Icon name={processing ? "progress_activity" : "add_a_photo"} className={`text-[28px] ${processing ? "animate-spin" : ""}`} />
                <span className="font-label-sm text-label-sm">
                  {form.photos.length}/{MAX_PHOTOS}
                </span>
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => addPhotos(e.target.files)}
          />
          {errors.photos && <p className="font-body-sm text-body-sm text-error">{errors.photos}</p>}
          <p className="font-body-sm text-body-sm text-on-surface-variant">La première photo sert de couverture.</p>
        </FormCard>

        <FormCard title="L'animal">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
            <TextField label="Nom" hint="Requis" value={form.name} maxLength={40} onChange={(e) => update("name", e.target.value)} error={errors.name} />
            <TextField
              label="Titre de l'annonce"
              hint="Facultatif"
              placeholder="Douce chatte cherche foyer calme"
              maxLength={80}
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
            />
          </div>
          <Field label="Espèce">
            {keysOf(SPECIES).map((s) => (
              <Chip key={s} selected={form.species === s} onClick={() => update("species", s)}>
                {SPECIES[s].emoji} {SPECIES[s].label}
              </Chip>
            ))}
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
            <TextField label="Race" hint="Facultatif" placeholder="Européen, croisé…" maxLength={60} value={form.breed} onChange={(e) => update("breed", e.target.value)} />
            <TextField
              label="Âge"
              placeholder="2 ans, 4 mois…"
              maxLength={30}
              value={form.ageLabel}
              onChange={(e) => update("ageLabel", e.target.value)}
              error={errors.ageLabel}
            />
          </div>
          <Field label="Tranche d'âge">
            {keysOf(AGE_GROUPS).map((a) => (
              <Chip key={a} selected={form.ageGroup === a} onClick={() => update("ageGroup", a)}>
                {AGE_GROUPS[a]}
              </Chip>
            ))}
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
            <Field label="Sexe">
              {keysOf(SEXES).map((s) => (
                <Chip key={s} selected={form.sex === s} onClick={() => update("sex", s)}>
                  {SEXES[s].label} {SEXES[s].symbol}
                </Chip>
              ))}
            </Field>
            <Field label="Taille">
              {keysOf(SIZES).map((s) => (
                <Chip key={s} selected={form.size === s} onClick={() => update("size", s)}>
                  {SIZES[s]}
                </Chip>
              ))}
            </Field>
          </div>
          <TextField
            label="Ville"
            icon="location_on"
            maxLength={60}
            value={form.city}
            onChange={(e) => update("city", e.target.value)}
            error={errors.city}
          />
        </FormCard>

        <FormCard title="Son histoire et sa personnalité">
          <TextArea
            label="Son histoire"
            hint={`${form.story.length} / ${STORY_MAX_LENGTH}`}
            rows={6}
            maxLength={STORY_MAX_LENGTH}
            value={form.story}
            onChange={(e) => update("story", e.target.value)}
            placeholder="D'où vient-il ? Comment se comporte-t-il au quotidien ?"
            error={errors.story}
          />
          <ListingWriterButton form={form} onUse={(text) => update("story", text.slice(0, STORY_MAX_LENGTH))} />
          <Field label="Personnalité">
            {keysOf(PERSONALITY).map((t) => (
              <Chip
                key={t}
                selected={form.personality.includes(t)}
                onClick={() =>
                  update(
                    "personality",
                    form.personality.includes(t) ? form.personality.filter((p) => p !== t) : [...form.personality, t],
                  )
                }
              >
                {PERSONALITY[t].emoji} {PERSONALITY[t].label}
              </Chip>
            ))}
          </Field>
          <div className="flex items-center justify-between gap-space-md p-space-md rounded-xl bg-secondary-fixed/25">
            <span className="flex flex-col">
              <span className="flex items-center gap-1 font-label-lg text-label-lg">
                <Icon name="favorite" filled className="text-[18px] text-[#E07A5F]" />
                Mettre en avant « Adopte-moi »
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">Pour un coup de cœur ou une adoption urgente</span>
            </span>
            <Toggle checked={form.adoptMe} onChange={(v) => update("adoptMe", v)} label="Mettre en avant Adopte-moi" />
          </div>
        </FormCard>

        <FormCard title="Compatibilité">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
            {keysOf(COMPATIBILITY_LABELS).map((key) => (
              <div key={key} className="flex items-center justify-between gap-space-md p-space-sm rounded-xl bg-surface-container-low/60">
                <span className="font-label-lg text-label-lg">{COMPATIBILITY_LABELS[key]}</span>
                <Toggle
                  checked={form.compatibility[key]}
                  onChange={(v) => update("compatibility", { ...form.compatibility, [key]: v })}
                  label={COMPATIBILITY_LABELS[key]}
                />
              </div>
            ))}
          </div>
          <Field label="Niveau d'énergie">
            {keysOf(ENERGY_LEVELS).map((e) => (
              <Chip key={e} selected={form.energy === e} onClick={() => update("energy", e)}>
                {ENERGY_LEVELS[e]}
              </Chip>
            ))}
          </Field>
          <label className="flex flex-col gap-space-sm">
            <span className="flex items-center justify-between font-label-lg text-label-lg">
              Peut rester seul (heures)
              <span className="text-primary">
                {form.aloneHours}
                {form.aloneHours >= MAX_ALONE_HOURS ? "+" : ""} h
              </span>
            </span>
            <input
              type="range"
              min={0}
              max={MAX_ALONE_HOURS}
              value={form.aloneHours}
              onChange={(e) => update("aloneHours", Number(e.target.value))}
              className="w-full accent-[#0f766e]"
            />
          </label>
        </FormCard>

        <FormCard title="Besoins et conditions">
          <TextArea
            label="Ses besoins"
            hint={`${form.needs.length} / ${TEXT_MAX_LENGTH}`}
            rows={4}
            maxLength={TEXT_MAX_LENGTH}
            value={form.needs}
            onChange={(e) => update("needs", e.target.value)}
            placeholder="Alimentation, environnement, présence…"
          />
          <TextArea
            label="Conditions d'adoption"
            hint={`${form.conditions.length} / ${TEXT_MAX_LENGTH}`}
            rows={4}
            maxLength={TEXT_MAX_LENGTH}
            value={form.conditions}
            onChange={(e) => update("conditions", e.target.value)}
            placeholder="Frais de participation, visite de rencontre, suivi…"
          />
        </FormCard>

        {message && <Alert>{message}</Alert>}

        <div className="flex flex-wrap items-center justify-end gap-space-sm">
          {isDraft ? (
            <>
              <Button type="button" variant="secondary" loading={saving === "draft"} disabled={Boolean(saving) || processing} onClick={() => save(false)}>
                Enregistrer le brouillon
              </Button>
              <Button type="submit" loading={saving === "publish"} disabled={Boolean(saving) || processing}>
                Publier
              </Button>
            </>
          ) : (
            <Button type="submit" loading={Boolean(saving)} disabled={processing}>
              Enregistrer les modifications
            </Button>
          )}
        </div>
      </form>

      <aside className="hidden lg:flex lg:col-span-4 flex-col gap-space-sm sticky top-20">
        <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Aperçu</span>
        <div className="max-w-[260px] pointer-events-none">
          <ListingCard listing={preview} />
        </div>
      </aside>
    </div>
  );
}
