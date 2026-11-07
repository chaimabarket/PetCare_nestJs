"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { HappyTailCard } from "@/components/adoption/HappyTailCard";
import { useAsync } from "@/components/adoption/hooks";
import { Breadcrumb, ButtonLink, EmptyState, PageLoading, Photo } from "@/components/adoption/ui";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { TextArea } from "@/components/ui/TextField";
import {
  ADOPTION_ROUTES,
  getHappyTail,
  getListing,
  HAPPY_TAIL_MAX_LENGTH,
  publishHappyTail,
  type AdoptionListing,
} from "@/lib/adoption";
import { compressImage, STORY_PHOTO_SIZE } from "@/lib/images";
import { errorMessage, type UserProfile } from "@/lib/users";

export function ShareHappyTail({ id }: { id: string }) {
  return (
    <RequireAuth>
      <Loader id={id} />
    </RequireAuth>
  );
}

function Loader({ id }: { id: string }) {
  const { user, profile } = useAuth();
  const uid = user?.uid ?? "";
  const load = useCallback(async () => {
    const [listing, existing] = await Promise.all([getListing(id), getHappyTail(id)]);
    return { listing, existing };
  }, [id]);
  const { data, error, loading } = useAsync(load);

  if (loading) return <PageLoading />;
  if (error || !profile) {
    return (
      <div className="max-w-xl mx-auto p-space-xl">
        <Alert>{error ?? "Votre profil est introuvable. Reconnectez-vous puis réessayez."}</Alert>
      </div>
    );
  }
  const listing = data?.listing;
  if (!listing || listing.status !== "adoptee" || listing.adopterId !== uid) {
    return (
      <div className="max-w-xl mx-auto p-space-xl">
        <EmptyState
          icon="lock"
          title="Partage réservé à l'adoptant"
          text="Seule la personne qui a adopté l'animal peut partager son Happy Tail."
          action={<ButtonLink href={ADOPTION_ROUTES.happyTails}>Voir les Happy Tails</ButtonLink>}
        />
      </div>
    );
  }
  if (data?.existing) {
    return (
      <div className="max-w-xl mx-auto p-space-xl">
        <EmptyState
          icon="auto_awesome"
          title="Histoire déjà partagée"
          text={`Merci ! L'histoire de ${listing.name} est déjà publiée.`}
          action={<ButtonLink href={ADOPTION_ROUTES.happyTails}>Voir les Happy Tails</ButtonLink>}
        />
      </div>
    );
  }
  return <Form listing={listing} profile={profile} />;
}

function Form({ listing, profile }: { listing: AdoptionListing; profile: UserProfile }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [afterPhoto, setAfterPhoto] = useState("");
  const [story, setStory] = useState("");
  const [errors, setErrors] = useState<{ photo?: string; story?: string }>({});
  const [message, setMessage] = useState("");
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const beforePhoto = listing.photos[0] ?? listing.thumbnail;

  async function choosePhoto(file?: File) {
    if (!file) return;
    setProcessing(true);
    setErrors((e) => ({ ...e, photo: undefined }));
    try {
      setAfterPhoto(await compressImage(file, STORY_PHOTO_SIZE));
    } catch (error) {
      setErrors((e) => ({ ...e, photo: errorMessage(error) }));
    } finally {
      setProcessing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function publish() {
    const next = {
      photo: afterPhoto ? undefined : "Ajoutez une photo « après » de votre compagnon.",
      story: story.trim().length < 30 ? "Racontez votre histoire en quelques phrases (30 caractères minimum)." : undefined,
    };
    setErrors(next);
    if (next.photo || next.story) return;
    setSaving(true);
    setMessage("");
    try {
      await publishHappyTail(listing, profile, afterPhoto, story.trim());
      router.push(ADOPTION_ROUTES.happyTails);
    } catch (error) {
      setMessage(errorMessage(error));
      setSaving(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-margin md:px-margin-md lg:px-margin-lg py-space-lg">
      <Breadcrumb items={[{ label: "Happy Tails", href: ADOPTION_ROUTES.happyTails }, { label: "Partager notre histoire" }]} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
        <section className="lg:col-span-7 bg-surface-container-lowest rounded-2xl p-space-lg md:p-space-xl shadow-sm flex flex-col gap-space-lg">
          <div className="flex items-center gap-space-md">
            <Photo src={listing.thumbnail} alt={listing.name} className="w-16 h-16 rounded-full ring-4 ring-secondary-fixed" />
            <div>
              <h1 className="font-headline-lg text-headline-lg">Partager notre histoire</h1>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Donnez des nouvelles de {listing.name} à la communauté et à {listing.ownerName}.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-space-md">
            <div className="flex flex-col gap-space-xs">
              <span className="font-label-lg text-label-lg">Avant</span>
              <Photo src={beforePhoto} alt={`${listing.name} avant`} className="aspect-square w-full rounded-2xl" />
              <span className="font-body-sm text-body-sm text-on-surface-variant">Photo de l&apos;annonce</span>
            </div>
            <div className="flex flex-col gap-space-xs">
              <span className="font-label-lg text-label-lg">Après</span>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={processing}
                className="relative aspect-square w-full rounded-2xl overflow-hidden border-2 border-dashed border-secondary-container text-[#E07A5F] flex flex-col items-center justify-center gap-1 hover:bg-secondary-fixed/20 transition-colors"
              >
                {afterPhoto ? (
                  <Photo src={afterPhoto} alt={`${listing.name} aujourd'hui`} className="absolute inset-0 w-full h-full" />
                ) : (
                  <>
                    <Icon name={processing ? "progress_activity" : "add_a_photo"} className={`text-[32px] ${processing ? "animate-spin" : ""}`} />
                    <span className="font-label-md text-label-md">Ajouter une photo</span>
                  </>
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => choosePhoto(e.target.files?.[0])} />
              {errors.photo ? (
                <span className="font-body-sm text-body-sm text-error">{errors.photo}</span>
              ) : (
                afterPhoto && (
                  <button type="button" onClick={() => fileRef.current?.click()} className="self-start font-label-sm text-label-sm text-primary hover:underline">
                    Changer la photo
                  </button>
                )
              )}
            </div>
          </div>

          <TextArea
            label="Racontez votre histoire"
            hint={`${story.length} / ${HAPPY_TAIL_MAX_LENGTH}`}
            rows={7}
            maxLength={HAPPY_TAIL_MAX_LENGTH}
            value={story}
            onChange={(e) => setStory(e.target.value)}
            placeholder={`Comment se passent les premières semaines avec ${listing.name} ?`}
            error={errors.story}
          />

          {message && <Alert>{message}</Alert>}

          <div className="flex justify-end">
            <Button type="button" variant="coral" loading={saving} disabled={processing} onClick={publish}>
              Publier
            </Button>
          </div>
        </section>

        <aside className="lg:col-span-5 flex flex-col gap-space-sm lg:sticky lg:top-20">
          <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Aperçu</span>
          <HappyTailCard
            preview
            tail={{
              id: listing.id,
              animalName: listing.name,
              adopterName: profile.displayName,
              ownerName: listing.ownerName,
              beforePhoto,
              afterPhoto,
              story: story.trim(),
              likedBy: [],
            }}
          />
        </aside>
      </div>
    </div>
  );
}
