"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { ARCHIVE_REASON_MAX_LENGTH, archivePet, type Pet } from "@/lib/pets";
import { errorMessage } from "@/lib/users";
import { Modal } from "./Modal";

/**
 * Confirmation d'archivage (maquette confirmation_d_archivage_milo). L'animal quitte les actifs,
 * tout est conservé. Les rendez-vous et annonces liés seront vérifiés quand ces modules existeront.
 */
export function ArchiveDialog({ pet, onClose, onArchived }: { pet: Pet; onClose: () => void; onArchived: (pet: Pet) => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      onArchived(await archivePet(pet.id, reason.trim()));
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Archiver la fiche de ${pet.name}`}
      icon="inventory_2"
      onClose={onClose}
      subtitle={
        <span className="flex items-center gap-1.5 text-primary font-label-md text-label-md">
          <Icon name="verified" className="text-[16px]" />
          Historique et poids intégralement conservés
        </span>
      }
    >
      <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed mb-space-lg">
        L&apos;archivage retire {pet.name} de vos compagnons actifs, mais sa fiche, ses photos, ses contacts et son historique de
        poids restent conservés et consultables à tout moment dans l&apos;onglet « Archivés ». Vous pourrez restaurer la fiche
        quand vous le souhaitez. Rien n&apos;est supprimé.
      </p>
      <label className="flex flex-col gap-space-xs mb-space-lg">
        <span className="font-label-lg text-label-lg text-on-surface flex justify-between">
          Motif
          <span className="font-label-sm text-label-sm text-on-surface-variant">Facultatif</span>
        </span>
        <textarea
          rows={2}
          maxLength={ARCHIVE_REASON_MAX_LENGTH}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ex : confié à un proche, décédé…"
          className="w-full rounded-lg bg-surface-container-low p-3 font-body-md text-body-md resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </label>
      {error && <p className="font-body-sm text-body-sm text-error mb-space-md">{error}</p>}
      <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-space-md">
        <button
          type="button"
          onClick={onClose}
          className="w-full sm:w-auto px-space-xl py-2.5 rounded-full bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={busy}
          className="w-full sm:w-auto px-space-xl py-2.5 rounded-full bg-secondary text-on-secondary font-label-md text-label-md hover:opacity-90 transition-all flex items-center justify-center gap-space-sm shadow-sm disabled:opacity-70"
        >
          <Icon name={busy ? "progress_activity" : "archive"} className={`text-[18px] ${busy ? "animate-spin" : ""}`} />
          Archiver la fiche
        </button>
      </div>
    </Modal>
  );
}
