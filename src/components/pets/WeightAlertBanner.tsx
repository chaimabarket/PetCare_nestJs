"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { WEIGHT_ALERT_DISCLAIMER, WEIGHT_ALERT_INFO, WEIGHT_SOURCES } from "@/lib/pet-weight-alert";
import { formatDay, formatKg, patchPet, type Pet } from "@/lib/pets";
import { errorMessage } from "@/lib/users";
import { COMING_SOON, LINKED_MODULES } from "./ui";

const tones = {
  consult: { box: "bg-error-container/50 text-on-error-container", icon: "text-error", label: "Consultez votre vétérinaire" },
  watch: { box: "bg-amber-50 text-amber-900", icon: "text-amber-600", label: "À surveiller" },
};

const action =
  "inline-flex items-center gap-1.5 h-10 px-space-md rounded-full font-label-md text-label-md transition-colors";

/** Bandeau de l'alerte intelligente de poids sur la fiche (masqué après « Ignorer » pour cet épisode). */
export function WeightAlertBanner({ pet, onChange }: { pet: Pet; onChange: (pet: Pet) => void }) {
  const [showSources, setShowSources] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const alert = pet.weightAlert;
  if (!alert || alert.dismissed) return null;

  const info = WEIGHT_ALERT_INFO[alert.rule];
  const tone = tones[alert.level];
  const change = `${alert.changePct > 0 ? "+" : ""}${alert.changePct.toLocaleString("fr-FR")} %`;
  const appointments = LINKED_MODULES.bookAppointment?.(pet);
  const vets = LINKED_MODULES.vets?.(pet);
  const vetPhone = pet.vet.phone.replace(/[^\d+]/g, "");

  async function dismiss() {
    setBusy(true);
    setError("");
    try {
      onChange(await patchPet(pet.id, { dismissAlert: true }));
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <section role="alert" className={`rounded-2xl p-space-lg flex flex-col gap-space-md ${tone.box}`}>
      <div className="flex items-start gap-space-md">
        <Icon name={alert.level === "consult" ? "warning" : "monitor_weight"} filled className={`text-[28px] shrink-0 ${tone.icon}`} />
        <div className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold">{tone.label}</span>
          <h2 className="font-headline-sm text-headline-sm">
            {info.title} : {pet.name}
          </h2>
          <p className="font-body-md text-body-md">
            {formatKg(alert.referenceKg)} le {formatDay(alert.referenceDay)} → {formatKg(alert.latestKg)} le {formatDay(alert.latestDay)}{" "}
            (<strong>{change}</strong>).
          </p>
          <p className="font-body-md text-body-md">{info.advice}</p>
          <p className="font-body-sm text-body-sm opacity-80 flex items-start gap-1">
            <Icon name="info" className="text-[16px] mt-0.5" />
            {WEIGHT_ALERT_DISCLAIMER}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-space-sm">
        {appointments ? (
          <Link href={appointments} className={`${action} bg-primary text-on-primary hover:bg-primary-container`}>
            <Icon name="event" className="text-[18px]" />
            Prendre rendez-vous
          </Link>
        ) : vetPhone ? (
          <a href={`tel:${vetPhone}`} className={`${action} bg-primary text-on-primary hover:bg-primary-container`}>
            <Icon name="call" className="text-[18px]" />
            Appeler {pet.vet.name || "le vétérinaire"}
          </a>
        ) : (
          <span title={COMING_SOON} className={`${action} bg-surface-container-lowest/70 opacity-70 cursor-not-allowed`}>
            <Icon name="event" className="text-[18px]" />
            Prendre rendez-vous · {COMING_SOON}
          </span>
        )}
        {vets ? (
          <Link href={vets} className={`${action} bg-surface-container-lowest hover:bg-surface-container`}>
            <Icon name="stethoscope" className="text-[18px]" />
            Voir les vétérinaires
          </Link>
        ) : (
          <span title={COMING_SOON} className={`${action} bg-surface-container-lowest/70 opacity-70 cursor-not-allowed`}>
            <Icon name="stethoscope" className="text-[18px]" />
            Voir les vétérinaires · {COMING_SOON}
          </span>
        )}
        <button
          type="button"
          onClick={() => setShowSources((s) => !s)}
          aria-expanded={showSources}
          className={`${action} bg-surface-container-lowest hover:bg-surface-container`}
        >
          <Icon name="menu_book" className="text-[18px]" />
          Sources
        </button>
        <button type="button" onClick={dismiss} disabled={busy} className={`${action} hover:bg-black/5 ml-auto disabled:opacity-60`}>
          <Icon name="close" className="text-[18px]" />
          Ignorer
        </button>
      </div>

      {showSources && (
        <ul className="bg-surface-container-lowest/80 rounded-xl p-space-md flex flex-col gap-1 font-body-sm text-body-sm text-on-surface">
          {WEIGHT_SOURCES.map((s) => (
            <li key={s.href}>
              <a href={s.href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                {s.label}
                <Icon name="open_in_new" className="text-[14px]" />
              </a>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
    </section>
  );
}
