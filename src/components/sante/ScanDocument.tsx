"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { ATTACHMENT_MAX_BYTES, todayIso } from "@/lib/health-records";
import { compressImage } from "@/lib/images";
import { parseScannedText, type ScanKind, type ScanSuggestion } from "@/lib/scan-parse";

/** Côté le plus long de la photo : assez net pour la lecture, assez léger pour être joint (2 Mo maximum). */
const SCAN_SIZE = 1800;

/** Photo compressée en JPEG, prête à être jointe à l'acte. */
async function compressedPhoto(file: File): Promise<File | null> {
  for (const [size, quality] of [[SCAN_SIZE, 0.8], [1400, 0.7], [1000, 0.6]] as const) {
    const dataUrl = await compressImage(file, size, quality);
    const blob = await (await fetch(dataUrl)).blob();
    if (blob.size <= ATTACHMENT_MAX_BYTES) {
      const base = file.name.replace(/\.[^.]+$/, "") || "scan";
      return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
    }
  }
  return null;
}

/**
 * « Scanner un document » : photo (appareil ou galerie) → texte lu dans le navigateur avec Tesseract.js
 * (gratuit, sans quota ; le modèle français est téléchargé une fois puis gardé en cache) → suggestions.
 * Rien n'est enregistré : le formulaire est pré-rempli et l'utilisateur vérifie avant d'enregistrer.
 */
export function ScanDocument({
  kind,
  onResult,
}: {
  kind: ScanKind;
  onResult: (suggestion: ScanSuggestion, photo: File | null) => void;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  async function scan(file: File | undefined) {
    if (camera.current) camera.current.value = "";
    if (gallery.current) gallery.current.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage({ tone: "error", text: "Choisissez une photo (JPG, PNG ou WebP)." });
      return;
    }
    setMessage(null);
    setProgress(0);
    try {
      const photo = await compressedPhoto(file);
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("fra", 1, {
        logger: (m) => {
          if (m.status === "recognizing text") setProgress(Math.round(m.progress * 100));
        },
      });
      try {
        const { data } = await worker.recognize(photo ?? file);
        const suggestion = parseScannedText(data.text, kind, todayIso());
        onResult(suggestion, photo);
        const count = Object.keys(suggestion).length;
        setMessage(
          count
            ? { tone: "info", text: `${count} champ${count > 1 ? "s" : ""} pré-rempli${count > 1 ? "s" : ""} : vérifiez-les avant d'enregistrer.` }
            : { tone: "error", text: "Aucune information reconnue. Reprenez la photo bien à plat et éclairée, ou saisissez les champs." },
        );
      } finally {
        await worker.terminate();
      }
    } catch (err) {
      console.error("Scan :", err);
      setMessage({ tone: "error", text: "La lecture du document a échoué. Vérifiez votre connexion au premier usage, puis réessayez." });
    } finally {
      setProgress(null);
    }
  }

  const busy = progress !== null;
  const button =
    "inline-flex h-9 items-center gap-1.5 rounded-full bg-surface-container-lowest px-space-md font-label-md text-label-md text-primary shadow-sm hover:bg-primary-fixed/40 disabled:opacity-60";

  return (
    <section className="flex flex-col gap-space-sm rounded-2xl border border-dashed border-primary/40 bg-primary-fixed/20 p-space-md">
      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <div className="flex items-start gap-space-sm">
          <Icon name="document_scanner" className="text-primary text-[22px]" />
          <div>
            <h2 className="font-label-lg text-label-lg text-on-surface">
              Scanner {kind === "vaccin" ? "une vignette vaccinale" : "une ordonnance"}
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Lecture sur votre appareil. Aucun diagnostic ni dosage n&apos;est proposé : vous vérifiez chaque champ.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-space-xs">
          <button type="button" className={button} disabled={busy} onClick={() => camera.current?.click()}>
            <Icon name="photo_camera" className="text-[18px]" />
            Prendre une photo
          </button>
          <button type="button" className={button} disabled={busy} onClick={() => gallery.current?.click()}>
            <Icon name="photo_library" className="text-[18px]" />
            Galerie
          </button>
        </div>
      </div>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} onChange={(e) => scan(e.target.files?.[0])} />
      <input ref={gallery} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => scan(e.target.files?.[0])} />
      {busy && (
        <div role="status" className="flex items-center gap-space-sm font-body-sm text-body-sm text-on-surface-variant">
          <Icon name="progress_activity" className="animate-spin text-primary text-[18px]" />
          Lecture du document… {progress ? `${progress} %` : "(préparation)"}
          <span className="h-1.5 flex-1 rounded-full bg-surface-container overflow-hidden">
            <span className="block h-full bg-primary transition-all" style={{ width: `${progress ?? 0}%` }} />
          </span>
        </div>
      )}
      {message && (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={`font-body-sm text-body-sm ${message.tone === "error" ? "text-error" : "text-on-primary-fixed-variant"}`}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
