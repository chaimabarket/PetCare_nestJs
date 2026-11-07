"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { HappyTail } from "@/lib/adoption";
import { ReportButton } from "./Dialog";
import { Photo } from "./ui";

const PREVIEW_LENGTH = 180;

/** Carte « Avant / Après » d'une histoire d'adoption. */
export function HappyTailCard({
  tail,
  liked = false,
  onToggleLike,
  preview = false,
}: {
  tail: Pick<HappyTail, "id" | "animalName" | "adopterName" | "ownerName" | "beforePhoto" | "afterPhoto" | "story" | "likedBy">;
  liked?: boolean;
  onToggleLike?: () => void;
  /** Aperçu du formulaire : pas d'actions. */
  preview?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const long = tail.story.length > PREVIEW_LENGTH;
  const text = expanded || !long ? tail.story : `${tail.story.slice(0, PREVIEW_LENGTH).trimEnd()}…`;

  return (
    <article className="break-inside-avoid mb-space-lg bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
      <div className="grid grid-cols-2 gap-0.5">
        {[
          { src: tail.beforePhoto, label: "Avant" },
          { src: tail.afterPhoto, label: "Après" },
        ].map((photo) => (
          <div key={photo.label} className="relative aspect-square">
            <Photo src={photo.src} alt={`${tail.animalName} – ${photo.label.toLowerCase()}`} className="w-full h-full" />
            <span
              className={`absolute top-2 left-2 px-2 py-0.5 rounded-full font-label-sm text-label-sm shadow-sm ${
                photo.label === "Après" ? "bg-[#E07A5F] text-white" : "bg-surface-container-lowest/90 text-on-surface"
              }`}
            >
              {photo.label}
            </span>
          </div>
        ))}
      </div>
      <div className="p-space-md flex flex-col gap-space-sm">
        <div>
          <h3 className="font-headline-sm text-headline-sm">{tail.animalName || "Votre compagnon"}</h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            adopté(e) par {tail.adopterName} · {tail.ownerName}
          </p>
        </div>
        <p className="font-body-md text-body-md text-on-surface whitespace-pre-line">
          {text || <span className="text-outline">Votre histoire apparaîtra ici…</span>}
        </p>
        {long && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="self-start font-label-md text-label-md text-primary hover:underline"
          >
            {expanded ? "Réduire" : "Lire plus"}
          </button>
        )}
        <div className="flex items-center justify-between pt-space-xs">
          <button
            type="button"
            onClick={onToggleLike}
            disabled={preview}
            aria-pressed={liked}
            aria-label={liked ? "Retirer mon cœur" : "Envoyer un cœur"}
            className={`inline-flex items-center gap-1 h-9 px-space-md rounded-full font-label-md text-label-md transition-colors ${
              liked ? "bg-secondary-fixed text-[#E07A5F]" : "bg-surface-container-low text-on-surface-variant hover:text-[#E07A5F]"
            }`}
          >
            <Icon name="favorite" filled={liked} className="text-[18px]" />
            {tail.likedBy.length}
          </button>
          {!preview && <ReportButton targetType="happy-tail" targetId={tail.id} />}
        </div>
      </div>
    </article>
  );
}
