"use client";

import { useState } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { Icon } from "@/components/ui/Icon";
import {
  MAX_RANGES,
  saveMyAvailability,
  validateAvailability,
  WEEKDAY_LABELS,
  type DayAvailability,
} from "@/lib/services";
import { errorMessage } from "@/lib/users";

/** Créneaux de travail par jour (maquette disponibilit_s_r_servations_prestataire). */
export function AvailabilityEditor({ initial, onSaved }: { initial: DayAvailability[]; onSaved: (week: DayAvailability[]) => void }) {
  const [week, setWeek] = useState(initial);
  const [adding, setAdding] = useState<number | null>(null);
  const [draft, setDraft] = useState({ start: "09:00", end: "12:30" });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const activeDays = week.filter((d) => d.enabled).length;

  const change = (weekday: number, patch: Partial<DayAvailability>) => {
    setWeek((w) => w.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));
    setSaved(false);
    setError("");
  };

  function addRange(day: DayAvailability) {
    const next = { ...day, enabled: true, ranges: [...day.ranges, draft] };
    const { error: invalid } = validateAvailability([next]);
    if (invalid) {
      setError(invalid);
      return;
    }
    change(day.weekday, { enabled: true, ranges: validateAvailability([next]).value.find((d) => d.weekday === day.weekday)!.ranges });
    setAdding(null);
  }

  /** Recopie les plages du premier jour ouvert sur tous les jours ouverts. */
  function applyToWeek() {
    const model = week.find((d) => d.enabled && d.ranges.length);
    if (!model) return;
    setWeek((w) => w.map((d) => (d.enabled ? { ...d, ranges: model.ranges } : d)));
    setSaved(false);
  }

  async function save() {
    const { value, error: invalid } = validateAvailability(week);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await saveMyAvailability(value);
      setWeek(result);
      setSaved(true);
      onSaved(result);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-md">
      <div className="flex items-center justify-between gap-space-sm">
        <h2 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
          <Icon name="view_week" className="text-primary" />
          Créneaux de travail
        </h2>
        <span className="px-3 py-1 rounded-full bg-surface-container font-label-sm text-label-sm text-on-surface-variant">
          {activeDays} jour{activeDays > 1 ? "s" : ""} actif{activeDays > 1 ? "s" : ""}
        </span>
      </div>
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Heure de Tunis. Les clients réservent uniquement dans ces plages, par créneaux de 30 minutes.
      </p>

      <ul className="flex flex-col gap-space-sm">
        {week.map((day) => (
          <li key={day.weekday} className={`rounded-xl p-space-md flex flex-col gap-2 ${day.enabled ? "bg-surface-container-low/70" : ""}`}>
            <div className="flex items-center justify-between gap-space-sm">
              <span className="flex items-center gap-2">
                <span className="font-label-lg text-label-lg text-on-surface w-24">{WEEKDAY_LABELS[day.weekday]}</span>
                <span className="px-2 py-0.5 rounded-full bg-surface-container font-label-sm text-label-sm text-on-surface-variant">
                  {day.enabled ? `${day.ranges.length} créneau${day.ranges.length > 1 ? "x" : ""}` : "Fermé"}
                </span>
              </span>
              <Toggle
                checked={day.enabled}
                onChange={(enabled) => {
                  change(day.weekday, { enabled });
                  if (enabled && !day.ranges.length) setAdding(day.weekday);
                }}
                label={`${WEEKDAY_LABELS[day.weekday]} ouvert`}
              />
            </div>
            {day.enabled && (
              <div className="flex flex-wrap items-center gap-2">
                {day.ranges.map((r, i) => (
                  <span key={`${r.start}-${i}`} className="inline-flex items-center gap-1 h-8 pl-3 pr-1 rounded-full bg-primary-fixed/50 text-on-primary-fixed-variant font-label-md text-label-md">
                    {r.start} – {r.end}
                    <button
                      type="button"
                      aria-label={`Retirer ${r.start} – ${r.end}`}
                      onClick={() => change(day.weekday, { ranges: day.ranges.filter((_, j) => j !== i) })}
                      className="w-6 h-6 rounded-full hover:bg-black/10 flex items-center justify-center"
                    >
                      <Icon name="close" className="text-[14px]" />
                    </button>
                  </span>
                ))}
                {adding === day.weekday ? (
                  <span className="inline-flex flex-wrap items-center gap-1">
                    <input type="time" aria-label="Début" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} className="h-8 rounded-lg bg-surface-container-lowest px-2 font-body-sm text-body-sm" />
                    <span>–</span>
                    <input type="time" aria-label="Fin" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} className="h-8 rounded-lg bg-surface-container-lowest px-2 font-body-sm text-body-sm" />
                    <button type="button" onClick={() => addRange(day)} className="h-8 px-3 rounded-full bg-primary text-on-primary font-label-sm text-label-sm">
                      Ajouter
                    </button>
                    <button type="button" onClick={() => setAdding(null)} className="h-8 px-2 rounded-full text-on-surface-variant font-label-sm text-label-sm">
                      Annuler
                    </button>
                  </span>
                ) : (
                  day.ranges.length < MAX_RANGES && (
                    <button type="button" onClick={() => setAdding(day.weekday)} className="inline-flex items-center gap-1 h-8 px-3 rounded-full border border-dashed border-outline-variant text-primary font-label-md text-label-md hover:bg-primary/5">
                      <Icon name="add" className="text-[16px]" />
                      Plage
                    </button>
                  )
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={applyToWeek}
        disabled={!week.some((d) => d.enabled && d.ranges.length)}
        className="h-11 rounded-xl bg-primary-fixed/40 text-on-primary-fixed-variant font-label-md text-label-md inline-flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Icon name="auto_fix_high" className="text-[18px]" />
        Appliquer les horaires du premier jour ouvert à toute la semaine
      </button>
      {error && <p role="alert" className="font-body-sm text-body-sm text-error">{error}</p>}
      <div className="flex items-center justify-end gap-space-md">
        {saved && (
          <span className="font-body-sm text-body-sm text-primary flex items-center gap-1">
            <Icon name="check_circle" className="text-[16px]" />
            Disponibilités enregistrées
          </span>
        )}
        <button type="button" onClick={save} disabled={busy} className="h-11 px-space-xl rounded-xl bg-primary text-on-primary font-label-md text-label-md shadow-md hover:bg-primary-container disabled:opacity-60">
          {busy ? "Enregistrement…" : "Enregistrer les disponibilités"}
        </button>
      </div>
    </section>
  );
}
