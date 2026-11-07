"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { todayIso, type HealthRecord } from "@/lib/health-records";
import { getFullPet } from "@/lib/health-records-api";

/**
 * « Exporter en PDF » : génère le carnet dans le navigateur, puis propose « Partager » (si l'appareil sait
 * partager un fichier) ou « Enregistrer ». Le partage se fait sur un second clic : après la génération,
 * le navigateur n'accepterait plus navigator.share() sans nouveau geste de l'utilisateur.
 */
export function ExportPdfButton({ petId, records, disabled }: { petId: string; records: HealthRecord[]; disabled?: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setBusy(true);
    setError("");
    try {
      const [{ buildHealthPdf }, pet] = await Promise.all([import("./HealthPdf"), getFullPet(petId)]);
      setFile(await buildHealthPdf(pet, records, todayIso()));
    } catch (err) {
      console.error("Export PDF :", err);
      setError(err instanceof Error && err.message ? err.message : "Le PDF n'a pas pu être créé.");
    } finally {
      setBusy(false);
    }
  }

  function save() {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function share() {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: file.name });
    } catch (err) {
      // Partage annulé par l'utilisateur : rien à signaler.
      if (!(err instanceof DOMException && err.name === "AbortError")) save();
    }
  }

  const canShare = typeof navigator !== "undefined" && !!file && !!navigator.canShare?.({ files: [file] });

  if (!file) {
    return (
      <div className="flex flex-col gap-1">
        <Button type="button" variant="secondary" icon="picture_as_pdf" loading={busy} disabled={disabled} onClick={generate}>
          Exporter en PDF
        </Button>
        {error && (
          <p role="alert" className="font-body-sm text-body-sm text-error">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-space-xs" role="group" aria-label="PDF prêt">
      {canShare && (
        <Button type="button" variant="secondary" icon="share" onClick={share}>
          Partager
        </Button>
      )}
      <Button type="button" variant={canShare ? "secondary" : "primary"} icon="download" onClick={save}>
        Enregistrer le PDF
      </Button>
      <button
        type="button"
        onClick={() => setFile(null)}
        aria-label="Fermer"
        className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
      >
        <Icon name="close" className="text-[18px]" />
      </button>
    </div>
  );
}
