"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/pets/Modal";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { TextField } from "@/components/ui/TextField";
import {
  SHARE_DURATIONS,
  SHARE_LABEL_MAX_LENGTH,
  SHARE_SCOPE_INFO,
  SHARE_SCOPES,
  shareStatus,
  shareUrl,
  type HealthShare,
  type ShareScope,
} from "@/lib/health-share";
import { createShare, listShares, revokeShare } from "@/lib/health-records-api";

/**
 * Adresse mise dans le lien et le QR code : NEXT_PUBLIC_SHARE_ORIGIN si elle est définie (adresse du PC sur le
 * Wi-Fi en développement, ou domaine de production), sinon l'adresse du site ouvert.
 */
function shareOrigin(): string {
  return (process.env.NEXT_PUBLIC_SHARE_ORIGIN || window.location.origin).replace(/\/+$/, "");
}

/** Un lien en localhost ne s'ouvre que sur l'ordinateur qui fait tourner le site. */
const isLocalOnly = (url: string) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(url);

const dateTime = (iso: string) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });

const STATUS_LABEL = {
  active: { text: "Actif", className: "bg-emerald-50 text-emerald-800" },
  expired: { text: "Expiré", className: "bg-surface-container text-on-surface-variant" },
  revoked: { text: "Désactivé", className: "bg-error-container/60 text-on-error-container" },
};

/**
 * « Partager le carnet » : crée un lien temporaire en lecture seule (et son QR code), liste les liens
 * existants avec leurs consultations, et permet de les désactiver. Le lien n'est affiché qu'une fois.
 */
export function ShareDialog({ petId, petName, onClose }: { petId: string; petName: string; onClose: () => void }) {
  const [shares, setShares] = useState<HealthShare[] | null>(null);
  const [scope, setScope] = useState<ShareScope>("urgence");
  const [hours, setHours] = useState<number>(SHARE_DURATIONS[0].hours);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ url: string; qr: string; share: HealthShare } | null>(null);

  const load = useCallback(async () => {
    try {
      setShares(await listShares(petId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chargement impossible.");
      setShares([]);
    }
  }, [petId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement initial depuis l'API
    load();
  }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { share, token } = await createShare(petId, { scope, durationHours: hours, label });
      const url = shareUrl(shareOrigin(), token);
      const QRCode = (await import("qrcode")).default;
      const qr = await QRCode.toDataURL(url, { width: 480, margin: 1, errorCorrectionLevel: "M" });
      setCreated({ url, qr, share });
      setShares((list) => [share, ...(list ?? [])]);
      setLabel("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Le lien n'a pas pu être créé.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(share: HealthShare) {
    setError("");
    try {
      const updated = await revokeShare(share.id);
      setShares((list) => list?.map((s) => (s.id === updated.id ? updated : s)) ?? null);
      if (created?.share.id === share.id) setCreated(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Le lien n'a pas pu être désactivé.");
    }
  }

  return (
    <Modal
      title="Partager le carnet"
      icon="share"
      subtitle={`Un lien en lecture seule vers le carnet de ${petName}, valable pour une durée limitée et désactivable à tout moment.`}
      onClose={onClose}
      wide
    >
      <div className="flex flex-col gap-space-lg">
        {error && <Alert>{error}</Alert>}

        {created ? (
          <CreatedLink url={created.url} qr={created.qr} share={created.share} petName={petName} onDone={() => setCreated(null)} />
        ) : (
          <form onSubmit={create} className="flex flex-col gap-space-md rounded-2xl bg-surface-container-low p-space-md">
            <fieldset className="flex flex-col gap-space-xs">
              <legend className="font-label-lg text-label-lg text-on-surface mb-space-xs">Ce que le lien montre</legend>
              <div className="grid gap-space-sm sm:grid-cols-2">
                {SHARE_SCOPES.map((key) => {
                  const info = SHARE_SCOPE_INFO[key];
                  const active = scope === key;
                  return (
                    <label
                      key={key}
                      className={`flex cursor-pointer gap-space-sm rounded-xl p-space-sm transition-colors ${
                        active ? "bg-primary-container text-on-primary" : "bg-surface-container-lowest hover:bg-surface-container"
                      }`}
                    >
                      <input type="radio" name="scope" value={key} checked={active} onChange={() => setScope(key)} className="sr-only" />
                      <Icon name={info.icon} className="text-[22px]" />
                      <span>
                        <span className="block font-label-lg text-label-lg">{info.label}</span>
                        <span className={`block font-body-sm text-body-sm ${active ? "text-on-primary/90" : "text-on-surface-variant"}`}>
                          {info.description}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-space-xs">
              <legend className="font-label-lg text-label-lg text-on-surface mb-space-xs">Valable pendant</legend>
              <div className="flex flex-wrap gap-space-xs">
                {SHARE_DURATIONS.map((d) => (
                  <button
                    key={d.hours}
                    type="button"
                    aria-pressed={hours === d.hours}
                    onClick={() => setHours(d.hours)}
                    className={`h-8 px-space-md rounded-full font-label-md text-label-md transition-colors ${
                      hours === d.hours ? "bg-primary text-on-primary" : "bg-surface-container-lowest text-primary hover:bg-surface-container"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <TextField
              label="Nom du lien"
              hint="Facultatif"
              icon="label"
              placeholder="Ex. Dr Trabelsi, pet-sitter Nour…"
              value={label}
              maxLength={SHARE_LABEL_MAX_LENGTH}
              onChange={(e) => setLabel(e.target.value)}
            />

            <p className="flex items-start gap-space-xs font-body-sm text-body-sm text-on-surface-variant">
              <Icon name="shield" className="text-[16px] mt-0.5 text-primary" />
              Toute personne qui a le lien peut voir ces informations jusqu&apos;à son expiration. Vos coordonnées et les
              contacts de la fiche ne sont jamais montrés ; les pièces jointes non plus.
            </p>
            <Button type="submit" icon="link" loading={busy} className="self-start">
              Créer le lien
            </Button>
          </form>
        )}

        <section className="flex flex-col gap-space-sm">
          <h3 className="font-label-lg text-label-lg text-on-surface">Liens créés</h3>
          {shares === null ? (
            <p className="font-body-sm text-body-sm text-on-surface-variant">Chargement…</p>
          ) : shares.length === 0 ? (
            <p className="font-body-sm text-body-sm text-on-surface-variant">Aucun lien pour le moment.</p>
          ) : (
            <ul className="flex flex-col gap-space-xs">
              {shares.map((share) => {
                const status = shareStatus(share);
                return (
                  <li key={share.id} className="flex flex-wrap items-center gap-space-sm rounded-xl bg-surface-container-low p-space-sm">
                    <Icon name={SHARE_SCOPE_INFO[share.scope].icon} className="text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="font-label-lg text-label-lg text-on-surface truncate">
                        {share.label || SHARE_SCOPE_INFO[share.scope].label}
                        <span className={`ml-space-xs px-space-sm py-0.5 rounded-full font-label-sm text-label-sm ${STATUS_LABEL[status].className}`}>
                          {STATUS_LABEL[status].text}
                        </span>
                      </p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        {SHARE_SCOPE_INFO[share.scope].label} · {status === "active" ? "expire le" : "valable jusqu'au"} {dateTime(share.expiresAt)}
                        {" · "}
                        {share.accessCount
                          ? `${share.accessCount} consultation${share.accessCount > 1 ? "s" : ""}, dernière le ${dateTime(share.lastAccessAt!)}`
                          : "jamais consulté"}
                      </p>
                    </div>
                    {status === "active" && (
                      <button
                        type="button"
                        onClick={() => revoke(share)}
                        className="inline-flex items-center gap-1 h-9 px-space-md rounded-full font-label-md text-label-md text-error hover:bg-error-container/40"
                      >
                        <Icon name="link_off" className="text-[18px]" />
                        Désactiver
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  );
}

/** Lien juste créé : affiché une seule fois, avec QR code, copie, partage et téléchargement du QR. */
function CreatedLink({ url, qr, share, petName, onDone }: { url: string; qr: string; share: HealthShare; petName: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const action =
    "inline-flex items-center gap-1 h-9 px-space-md rounded-full font-label-md text-label-md bg-surface-container-lowest text-primary shadow-sm hover:bg-primary-fixed/40";

  return (
    <div className="flex flex-col sm:flex-row gap-space-lg rounded-2xl bg-primary-fixed/25 p-space-md">
      {/* eslint-disable-next-line @next/next/no-img-element -- QR code généré dans le navigateur (data URL) */}
      <img src={qr} alt={`QR code du lien vers le carnet de ${petName}`} className="w-44 h-44 self-center rounded-xl bg-white p-2" />
      <div className="flex min-w-0 flex-1 flex-col gap-space-sm">
        <p className="flex items-center gap-space-xs font-label-lg text-label-lg text-on-surface">
          <Icon name="check_circle" filled className="text-emerald-600" />
          Lien créé · {SHARE_SCOPE_INFO[share.scope].label}, jusqu&apos;au {dateTime(share.expiresAt)}
        </p>
        <input
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
          aria-label="Lien de partage"
          className="h-10 w-full rounded-lg bg-surface-container-lowest px-3 font-body-sm text-body-sm text-on-surface"
        />
        {isLocalOnly(url) && (
          <p role="alert" className="flex items-start gap-space-xs rounded-lg bg-tertiary-fixed/50 p-space-xs font-body-sm text-body-sm text-on-tertiary-fixed-variant">
            <Icon name="wifi_off" className="text-[16px] mt-0.5" />
            Ce lien pointe vers « localhost » : il ne s&apos;ouvrira que sur cet ordinateur, pas sur un téléphone. Définissez
            NEXT_PUBLIC_SHARE_ORIGIN (adresse du PC sur le Wi-Fi) dans .env.local, puis relancez le serveur.
          </p>
        )}
        <p className="flex items-start gap-space-xs font-body-sm text-body-sm text-on-surface-variant">
          <Icon name="visibility_off" className="text-[16px] mt-0.5" />
          Copiez-le maintenant : pour votre sécurité, il ne sera plus affiché. Vous pourrez le désactiver dans la liste ci-dessous.
        </p>
        <div className="flex flex-wrap gap-space-xs">
          <button type="button" className={action} onClick={copy}>
            <Icon name={copied ? "check" : "content_copy"} className="text-[18px]" />
            {copied ? "Copié" : "Copier le lien"}
          </button>
          {canShare && (
            <button
              type="button"
              className={action}
              onClick={() => navigator.share({ title: `Carnet de santé de ${petName}`, url }).catch(() => undefined)}
            >
              <Icon name="share" className="text-[18px]" />
              Partager
            </button>
          )}
          <a className={action} href={qr} download={`qr-carnet-${petName.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.png`}>
            <Icon name="qr_code_2" className="text-[18px]" />
            Télécharger le QR code
          </a>
          <button type="button" className={action} onClick={onDone}>
            <Icon name="add_link" className="text-[18px]" />
            Créer un autre lien
          </button>
        </div>
      </div>
    </div>
  );
}
