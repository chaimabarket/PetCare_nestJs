import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { ADOPTION_ROUTES, type AdoptionListing } from "@/lib/adoption";
import { AdoptMeTag, ListingStatusPill, PersonalityBadges, Photo } from "./ui";

export function FavoriteButton({
  favorite,
  onToggle,
  name,
  className = "",
}: {
  favorite: boolean;
  onToggle: () => void;
  name: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={favorite}
      aria-label={favorite ? `Retirer ${name} des favoris` : `Ajouter ${name} aux favoris`}
      title={favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
      className={`w-9 h-9 rounded-full bg-surface-container-lowest/90 backdrop-blur flex items-center justify-center shadow-sm hover:scale-105 transition-transform ${
        favorite ? "text-[#E07A5F]" : "text-on-surface-variant"
      } ${className}`}
    >
      <Icon name="favorite" filled={favorite} className="text-[20px]" />
    </button>
  );
}

/** Carte d'annonce du fil et des favoris. */
export function ListingCard({
  listing,
  favorite,
  onToggleFavorite,
}: {
  listing: AdoptionListing;
  favorite?: boolean;
  onToggleFavorite?: () => void;
}) {
  const adopted = listing.status === "adoptee";
  const reserved = listing.status === "reservee";

  return (
    <article
      className={`group relative bg-surface-container-lowest rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col ${
        adopted ? "opacity-60" : ""
      }`}
    >
      <Link href={ADOPTION_ROUTES.listing(listing.id)} className="flex flex-col flex-1">
        <div className="relative aspect-[4/5] overflow-hidden">
          <Photo
            src={listing.thumbnail || listing.photos[0]}
            alt={listing.name}
            className="w-full h-full group-hover:scale-[1.03] transition-transform duration-300"
          />
          {listing.adoptMe && !adopted && <AdoptMeTag className="absolute top-2 left-2 shadow-sm" />}
          {reserved && (
            <span className="absolute bottom-0 inset-x-0 py-1 bg-amber-500/95 text-white text-center font-label-md text-label-md uppercase tracking-wider">
              Réservé
            </span>
          )}
          {adopted && <ListingStatusPill status="adoptee" className="absolute bottom-2 left-2 shadow-sm" />}
        </div>
        <div className="p-space-sm sm:p-space-md flex flex-col gap-1.5 flex-1">
          <h3 className="font-headline-sm text-headline-sm text-on-surface truncate">
            {listing.name}
            {listing.ageLabel && <span className="font-body-md text-body-md text-on-surface-variant"> · {listing.ageLabel}</span>}
          </h3>
          <p className="flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant truncate">
            <Icon name="location_on" className="text-[16px] text-primary" />
            {listing.city}
          </p>
          <div className="mt-auto pt-1">
            <PersonalityBadges traits={listing.personality} max={3} size="sm" />
          </div>
        </div>
      </Link>
      {onToggleFavorite && (
        <FavoriteButton
          favorite={Boolean(favorite)}
          onToggle={onToggleFavorite}
          name={listing.name}
          className="absolute top-2 right-2"
        />
      )}
    </article>
  );
}
