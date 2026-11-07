"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { ReportButton } from "@/components/adoption/Dialog";
import { useAsync, useFavorites } from "@/components/adoption/hooks";
import { FavoriteButton } from "@/components/adoption/ListingCard";
import {
  AdoptMeTag,
  ApplicationStatusPill,
  Breadcrumb,
  ButtonLink,
  EmptyState,
  ListingStatusPill,
  PageLoading,
  PersonalityBadges,
  Photo,
  SectionCard,
} from "@/components/adoption/ui";
import { Avatar } from "@/components/ui/Avatar";
import { Alert } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import {
  ADOPTION_ROUTES,
  ENERGY_LEVELS,
  getListing,
  getMyApplication,
  listReceivedApplications,
  PENDING_STATUSES,
  SEXES,
  SIZES,
  SPECIES,
  type AdoptionListing,
} from "@/lib/adoption";
import { ROLE_LABELS } from "@/lib/users";

export function ListingDetail({ id }: { id: string }) {
  const load = useCallback(() => getListing(id), [id]);
  const { data: listing, error, loading } = useAsync(load);

  if (loading) return <PageLoading />;
  if (error) {
    return (
      <div className="max-w-xl mx-auto p-space-xl">
        <Alert>{error}</Alert>
      </div>
    );
  }
  if (!listing) {
    return (
      <div className="max-w-xl mx-auto p-space-xl">
        <EmptyState
          icon="search_off"
          title="Annonce introuvable"
          text="Cette annonce a peut-être été retirée par son auteur."
          action={<ButtonLink href={ADOPTION_ROUTES.feed}>Voir les animaux à adopter</ButtonLink>}
        />
      </div>
    );
  }
  return <Detail listing={listing} />;
}

function Detail({ listing }: { listing: AdoptionListing }) {
  const router = useRouter();
  const { isFavorite, toggle } = useFavorites();
  const [photoIndex, setPhotoIndex] = useState(0);
  const photos = listing.photos.length ? listing.photos : [listing.thumbnail];
  const species = SPECIES[listing.species];

  const infos = [
    listing.breed ? `${species.label} · ${listing.breed}` : species.label,
    `${SEXES[listing.sex].label} ${SEXES[listing.sex].symbol}`,
    listing.ageLabel,
    `Taille ${SIZES[listing.size].toLowerCase()}`,
  ].filter(Boolean);

  const compatibility = [
    { ok: listing.compatibility.kids, label: "OK avec les enfants" },
    { ok: listing.compatibility.cats, label: "OK avec les chats" },
    { ok: listing.compatibility.dogs, label: "OK avec les chiens" },
    { ok: !listing.compatibility.garden, label: listing.compatibility.garden ? "Besoin d'un jardin" : "Pas besoin de jardin" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-margin md:px-margin-md lg:px-margin-lg py-space-lg pb-28 md:pb-space-xl">
      <Breadcrumb
        items={[
          { label: "Communauté", href: "/communaute" },
          { label: "Adoption", href: ADOPTION_ROUTES.feed },
          { label: listing.name },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
        <div className="lg:col-span-7 flex flex-col gap-space-lg">
          {/* Galerie */}
          <div className="bg-surface-container-lowest rounded-2xl p-space-sm shadow-sm flex flex-col gap-space-sm">
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden">
              <Photo src={photos[photoIndex]} alt={`${listing.name} – photo ${photoIndex + 1}`} className="w-full h-full" />
              <button
                type="button"
                onClick={() => router.back()}
                className="absolute top-3 left-3 inline-flex items-center gap-1 h-9 px-space-md rounded-full bg-surface-container-lowest/90 backdrop-blur font-label-md text-label-md shadow-sm"
              >
                <Icon name="arrow_back" className="text-[18px]" />
                Retour
              </button>
              <FavoriteButton
                favorite={isFavorite(listing.id)}
                onToggle={() => toggle(listing.id)}
                name={listing.name}
                className="absolute top-3 right-3"
              />
              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Photo précédente"
                    onClick={() => setPhotoIndex((i) => (i - 1 + photos.length) % photos.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-surface-container-lowest/90 flex items-center justify-center shadow-sm"
                  >
                    <Icon name="chevron_left" />
                  </button>
                  <button
                    type="button"
                    aria-label="Photo suivante"
                    onClick={() => setPhotoIndex((i) => (i + 1) % photos.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-surface-container-lowest/90 flex items-center justify-center shadow-sm"
                  >
                    <Icon name="chevron_right" />
                  </button>
                  <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
                    {photos.map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        aria-label={`Photo ${index + 1}`}
                        aria-current={index === photoIndex}
                        onClick={() => setPhotoIndex(index)}
                        className={`h-2 rounded-full transition-all ${index === photoIndex ? "w-5 bg-surface-container-lowest" : "w-2 bg-surface-container-lowest/60"}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
            {photos.length > 1 && (
              <div className="hidden sm:grid grid-cols-5 gap-space-sm">
                {photos.map((photo, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setPhotoIndex(index)}
                    className={`aspect-square rounded-lg overflow-hidden ${index === photoIndex ? "ring-2 ring-primary-container" : "opacity-80 hover:opacity-100"}`}
                  >
                    <Photo src={photo} alt="" className="w-full h-full" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Infos (mobile : sous la galerie) */}
          <div className="lg:hidden">
            <InfoCard listing={listing} infos={infos} />
          </div>

          {listing.story && (
            <SectionCard icon="menu_book" title="Son histoire" subtitle={listing.title || undefined}>
              <p className="font-body-lg text-body-lg text-on-surface-variant whitespace-pre-line">{listing.story}</p>
            </SectionCard>
          )}

          <SectionCard icon="favorite" title="Ses besoins" subtitle="Pour assurer son bien-être">
            {listing.needs && <p className="font-body-md text-body-md text-on-surface-variant whitespace-pre-line">{listing.needs}</p>}
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
              {compatibility.map((item) => (
                <li key={item.label} className="flex items-center gap-space-xs font-body-md text-body-md">
                  <Icon
                    name={item.ok ? "check_circle" : "warning"}
                    className={`text-[20px] ${item.ok ? "text-emerald-600" : "text-amber-500"}`}
                  />
                  {item.label}
                </li>
              ))}
              <li className="flex items-center gap-space-xs font-body-md text-body-md">
                <Icon name="bolt" className="text-[20px] text-primary" />
                Énergie : {ENERGY_LEVELS[listing.energy].toLowerCase()}
              </li>
              <li className="flex items-center gap-space-xs font-body-md text-body-md">
                <Icon name="schedule" className="text-[20px] text-primary" />
                Peut rester seul(e) {listing.aloneHours} h
              </li>
            </ul>
          </SectionCard>

          {listing.conditions && (
            <SectionCard icon="verified_user" title="Conditions d'adoption" subtitle="Un cadre bienveillant pour l'animal">
              <p className="font-body-md text-body-md text-on-surface-variant whitespace-pre-line">{listing.conditions}</p>
            </SectionCard>
          )}

          <div className="flex items-center justify-between gap-space-sm px-space-xs">
            <span className="font-body-sm text-body-sm text-outline">Annonce n° {listing.id.slice(0, 8).toUpperCase()}</span>
            <ReportButton targetType="annonce" targetId={listing.id} />
          </div>
        </div>

        <aside className="lg:col-span-5 flex flex-col gap-space-lg lg:sticky lg:top-20">
          <div className="hidden lg:block">
            <InfoCard listing={listing} infos={infos} />
          </div>
          <ApplyCard listing={listing} />
          <PublisherCard listing={listing} />
        </aside>
      </div>
    </div>
  );
}

function InfoCard({ listing, infos }: { listing: AdoptionListing; infos: string[] }) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-sm">
      <div className="flex items-center justify-between gap-space-sm">
        <ListingStatusPill status={listing.status} />
        {listing.adoptMe && listing.status !== "adoptee" && <AdoptMeTag />}
      </div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface">{listing.name}</h1>
      <p className="flex flex-wrap items-center gap-x-space-sm gap-y-1 font-body-md text-body-md text-on-surface-variant">
        {infos.map((info, index) => (
          <span key={info} className="flex items-center gap-space-sm">
            {index > 0 && <span className="w-1 h-1 rounded-full bg-outline-variant" />}
            {info}
          </span>
        ))}
      </p>
      <p className="flex items-center gap-1 font-body-md text-body-md text-on-surface">
        <Icon name="location_on" className="text-[18px] text-primary" />
        {listing.city}
      </p>
      <PersonalityBadges traits={listing.personality} />
    </div>
  );
}

function ApplyCard({ listing }: { listing: AdoptionListing }) {
  const { user, loading: authLoading } = useAuth();
  const uid = user?.uid;
  const isOwner = uid === listing.ownerId;
  const loadMine = useCallback(() => getMyApplication(listing.id, uid ?? ""), [listing.id, uid]);
  const loadReceived = useCallback(() => listReceivedApplications(listing.id, listing.ownerId), [listing.id, listing.ownerId]);
  const mine = useAsync(uid && !isOwner ? loadMine : null);
  const received = useAsync(isOwner ? loadReceived : null);

  let content: React.ReactNode;
  let stickyCta: React.ReactNode = null;

  if (authLoading || (uid && !isOwner && mine.loading) || (isOwner && received.loading)) {
    content = <PageLoading />;
  } else if (isOwner) {
    const total = received.data?.length ?? 0;
    const fresh = received.data?.filter((a) => a.status === "envoyee").length ?? 0;
    content = (
      <>
        <h2 className="font-headline-sm text-headline-sm">C&apos;est votre annonce</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">
          {total} candidature{total > 1 ? "s" : ""}
          {fresh > 0 && ` dont ${fresh} nouvelle${fresh > 1 ? "s" : ""}`}.
        </p>
        <div className="flex flex-wrap gap-space-sm">
          <ButtonLink href={ADOPTION_ROUTES.received(listing.id)} icon="group">
            Voir les candidatures
          </ButtonLink>
          {listing.status !== "adoptee" && (
            <ButtonLink href={ADOPTION_ROUTES.edit(listing.id)} variant="secondary" icon="edit">
              Modifier
            </ButtonLink>
          )}
        </div>
      </>
    );
  } else if (listing.status === "adoptee") {
    const isAdopter = uid === listing.adopterId;
    content = (
      <>
        <h2 className="font-headline-sm text-headline-sm">{listing.name} a trouvé sa famille ! 🎉</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Merci à toute la communauté. D&apos;autres compagnons attendent encore un foyer.
        </p>
        {isAdopter ? (
          <ButtonLink href={ADOPTION_ROUTES.shareHappyTail(listing.id)} variant="coral" icon="favorite">
            Partager mon Happy Tail
          </ButtonLink>
        ) : (
          <ButtonLink href={ADOPTION_ROUTES.feed} variant="secondary">
            Voir les animaux à adopter
          </ButtonLink>
        )}
      </>
    );
  } else if (mine.data) {
    content = (
      <>
        <div className="flex items-center justify-between gap-space-sm">
          <h2 className="font-headline-sm text-headline-sm">Votre candidature</h2>
          <ApplicationStatusPill status={mine.data.status} />
        </div>
        <p className="font-body-md text-body-md text-on-surface-variant">
          {PENDING_STATUSES.includes(mine.data.status)
            ? `${listing.ownerName} étudie votre dossier, vous serez notifié(e) de sa réponse.`
            : "Retrouvez l'avancement de votre demande dans vos candidatures."}
        </p>
        <ButtonLink href={ADOPTION_ROUTES.myApplications} variant="secondary" icon="timeline">
          Suivre ma candidature
        </ButtonLink>
      </>
    );
  } else if (listing.status === "reservee") {
    content = (
      <>
        <h2 className="font-headline-sm text-headline-sm">{listing.name} est réservé(e)</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Une candidature a été acceptée : l&apos;adoption est en cours de finalisation.
        </p>
      </>
    );
  } else if (listing.status === "disponible") {
    const href = user ? ADOPTION_ROUTES.apply(listing.id) : "/connexion";
    content = (
      <>
        <h2 className="font-headline-sm text-headline-sm">Prêt(e) à lui ouvrir votre cœur ?</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Répondez à quelques questions sur votre foyer : {listing.ownerName} étudiera votre candidature.
        </p>
        <ButtonLink href={href} variant="coral" icon="pets" className="w-full">
          Je veux l&apos;adopter
        </ButtonLink>
      </>
    );
    stickyCta = (
      <div className="md:hidden fixed inset-x-0 bottom-16 z-40 p-space-sm bg-surface-container-lowest/95 backdrop-blur shadow-[0_-1px_8px_rgba(0,0,0,0.06)]">
        <ButtonLink href={href} variant="coral" icon="pets" className="w-full">
          Je veux l&apos;adopter
        </ButtonLink>
      </div>
    );
  } else {
    content = (
      <p className="font-body-md text-body-md text-on-surface-variant">Cette annonce n&apos;est plus en ligne.</p>
    );
  }

  return (
    <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-md">
      {content}
      {(mine.error || received.error) && <Alert>{mine.error || received.error}</Alert>}
      {stickyCta}
    </div>
  );
}

function PublisherCard({ listing }: { listing: AdoptionListing }) {
  const shelter = listing.ownerRole === "refuge";
  return (
    <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-sm">
      <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
        Publié par {shelter ? "le refuge" : "un particulier"}
      </span>
      <div className="flex items-center gap-space-sm">
        <Avatar name={listing.ownerName} className="w-12 h-12 text-label-lg" />
        <div className="min-w-0">
          <p className="font-headline-sm text-headline-sm text-on-surface truncate">{listing.ownerName}</p>
          <p className="flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant">
            <Icon name={shelter ? "home_work" : "person"} className="text-[16px]" />
            {ROLE_LABELS[listing.ownerRole]} · {listing.ownerCity}
          </p>
        </div>
      </div>
      <Link
        href={ADOPTION_ROUTES.feed}
        className="mt-space-xs flex items-center justify-between p-space-sm rounded-xl bg-surface-container-low font-label-md text-label-md text-primary hover:bg-surface-container transition-colors"
      >
        Voir d&apos;autres animaux à adopter
        <Icon name="chevron_right" className="text-[18px]" />
      </Link>
    </div>
  );
}
