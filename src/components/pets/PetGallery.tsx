"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { compressImage, LISTING_PHOTO_SIZE, thumbnailFrom } from "@/lib/images";
import { addPhoto, MAX_PET_PHOTOS, patchPet, SPECIES_INFO, type Pet } from "@/lib/pets";
import { errorMessage } from "@/lib/users";
import { Modal } from "./Modal";

/** Galerie de la fiche (maquette profil_de_milo) : grande photo, miniatures, favori, zoom, ajout. */
export function PetGallery({ pet, editable, onChange }: { pet: Pet; editable: boolean; onChange: (pet: Pet) => void }) {
  const [selected, setSelected] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [busy, setBusy] = useState<"favorite" | "photo" | null>(null);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const photo = pet.photos[Math.min(selected, pet.photos.length - 1)];

  async function toggleFavorite() {
    setBusy("favorite");
    setError("");
    try {
      onChange(await patchPet(pet.id, { favorite: !pet.favorite }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy("photo");
    setError("");
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("La photo doit faire moins de 10 Mo.");
      const url = await compressImage(file, LISTING_PHOTO_SIZE);
      const updated = await addPhoto(pet.id, { url, thumbnail: await thumbnailFrom(url) });
      onChange(updated);
      setSelected(updated.photos.length - 1);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm flex flex-col gap-space-md">
      <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-surface-container-high group">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url} alt={pet.name} className="w-full h-full object-cover transition-all duration-300 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[96px] bg-primary-fixed/30" aria-hidden>
            {SPECIES_INFO[pet.species].emoji}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10 pointer-events-none" />
        <span className="absolute top-3 left-3 bg-surface-container-lowest/90 backdrop-blur-md px-3 py-1 rounded-full font-label-md text-label-md text-primary font-semibold flex items-center gap-1 shadow-sm">
          <span aria-hidden>{SPECIES_INFO[pet.species].emoji}</span>
          {pet.species === "other" && pet.breed ? pet.breed : SPECIES_INFO[pet.species].label}
        </span>
        <button
          type="button"
          onClick={toggleFavorite}
          disabled={!editable || busy === "favorite"}
          aria-pressed={pet.favorite}
          aria-label={pet.favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          title={pet.favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          className={`absolute top-3 right-3 w-9 h-9 rounded-full bg-surface-container-lowest/90 backdrop-blur-md flex items-center justify-center shadow-sm transition-all disabled:cursor-default ${
            pet.favorite ? "text-rose-600" : "text-on-surface-variant hover:text-rose-600"
          }`}
        >
          <Icon name="favorite" filled={pet.favorite} className="text-[20px]" />
        </button>
        {photo && (
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-body-sm drop-shadow">
            <span className="flex items-center gap-1">
              <Icon name="photo_camera" className="text-[16px]" />
              {selected === 0 ? "Photo principale" : `Photo ${selected + 1} / ${pet.photos.length}`}
            </span>
            <button
              type="button"
              onClick={() => setZoom(true)}
              className="px-2.5 py-1 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md font-label-sm text-label-sm transition-colors flex items-center gap-1"
            >
              <Icon name="fullscreen" className="text-[14px]" />
              Zoom
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-space-xs overflow-x-auto pb-1">
        {pet.photos.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelected(i)}
            aria-label={`Afficher la photo ${i + 1}`}
            className={`relative shrink-0 w-16 h-16 rounded-lg overflow-hidden transition-all ${
              i === selected ? "ring-2 ring-primary ring-offset-2" : "ring-1 ring-black/10 opacity-80 hover:opacity-100 hover:ring-primary/60"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.thumbnail} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
        {editable && pet.photos.length < MAX_PET_PHOTOS && (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy === "photo"}
            title="Ajouter une photo"
            className="shrink-0 w-16 h-16 rounded-lg border-2 border-dashed border-outline-variant hover:border-primary bg-surface-container-low hover:bg-primary-fixed/20 text-on-surface-variant hover:text-primary flex flex-col items-center justify-center gap-0.5 transition-colors group disabled:opacity-60"
          >
            <Icon
              name={busy === "photo" ? "progress_activity" : "add_a_photo"}
              className={`text-[20px] ${busy === "photo" ? "animate-spin" : "group-hover:scale-110 transition-transform"}`}
            />
            <span className="font-label-sm text-[10px] uppercase font-bold tracking-tight">Ajouter</span>
          </button>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>
      {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}

      {zoom && photo && (
        <Modal title={pet.name} onClose={() => setZoom(false)} wide>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt={pet.name} className="w-full max-h-[70vh] object-contain rounded-lg" />
        </Modal>
      )}
    </div>
  );
}
