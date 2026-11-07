"use client";

import { useCallback, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import {
  addWeight,
  daysAgoLabel,
  deleteWeight,
  formatDay,
  formatKg,
  listWeights,
  localDay,
  updateWeight,
  validateWeight,
  WEIGHT_CONFIRM_RATIO,
  WEIGHT_NOTE_MAX_LENGTH,
  weightChangeRatio,
  type Pet,
  type PetWeight,
} from "@/lib/pets";
import { errorMessage } from "@/lib/users";
import { ErrorState, LoadingState, useLoad } from "./ui";

const CHART_POINTS = 6;
/** En dessous de cet écart (1 %), le poids est considéré stable. */
const STABLE_RATIO = 0.01;

const shortDay = (day: string) => formatDay(day, { day: "numeric", month: "short" });
const signedKg = (kg: number) => `${kg > 0 ? "+" : kg < 0 ? "−" : ""}${Math.abs(kg).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kg`;

/** Poids & courbe d'évolution (maquette profil_de_milo) : ajout, courbe des 6 dernières pesées, historique. */
export function WeightSection({ pet, editable, onChanged }: { pet: Pet; editable: boolean; onChanged: () => void }) {
  const load = useCallback(() => listWeights(pet.id), [pet.id]);
  const { data: weights, error, loading, reload } = useLoad(load);
  const [adding, setAdding] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const today = localDay();

  const refresh = () => {
    reload();
    onChanged(); // dernier poids et alerte de la fiche
  };

  const sorted = weights ?? []; // du plus récent au plus ancien
  const latest = sorted[0];
  const previous = sorted[1];
  const trend = latest && previous ? latest.weightKg - previous.weightKg : 0;
  const stable = latest && previous ? weightChangeRatio(previous.weightKg, latest.weightKg) < STABLE_RATIO : true;

  return (
    <section className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
        <div className="flex items-center gap-space-sm">
          <span className="w-10 h-10 rounded-full bg-surface-container-high text-primary flex items-center justify-center shrink-0">
            <Icon name="monitor_weight" className="text-[22px]" />
          </span>
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Poids &amp; courbe d&apos;évolution</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Les {CHART_POINTS} dernières pesées · une par jour</p>
          </div>
        </div>
        <div className="flex items-center gap-space-sm">
          {latest && (
            <div className="rounded-xl bg-primary-fixed/30 px-space-md py-space-sm flex items-baseline gap-2">
              <span className="font-headline-md text-headline-md text-primary font-bold">{latest.weightKg.toLocaleString("fr-FR")}</span>
              <span className="font-label-md text-label-md text-primary">kg</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant bg-surface-container-lowest rounded-full px-2 py-0.5">
                {previous ? (stable ? "Stable" : `${signedKg(trend)} depuis le ${shortDay(previous.day)}`) : daysAgoLabel(latest.day, today)}
              </span>
            </div>
          )}
          {editable && !adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1.5 h-11 px-space-md rounded-full bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container shadow-sm"
            >
              <Icon name="add" className="text-[18px]" />
              Ajouter une mesure
            </button>
          )}
        </div>
      </div>

      {adding && (
        <WeightForm
          petId={pet.id}
          birthDate={pet.birthDate}
          weights={sorted}
          onCancel={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            refresh();
          }}
        />
      )}

      {loading && !weights && <LoadingState text="Chargement des pesées…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {weights && weights.length === 0 && (
        <p className="font-body-sm text-body-sm text-on-surface-variant bg-surface-container-low rounded-xl p-space-md">
          Aucune pesée pour l&apos;instant. Pesez {pet.name} régulièrement : la courbe et l&apos;alerte de poids s&apos;appuient sur ces
          mesures.
        </p>
      )}

      {weights && weights.length > 0 && (
        <>
          <WeightChart weights={sorted.slice(0, CHART_POINTS).reverse()} name={pet.name} />
          <div className="flex flex-col gap-space-xs">
            <h3 className="font-label-lg text-label-lg text-on-surface">Historique</h3>
            <ul className="flex flex-col divide-y divide-surface-container">
              {(showAll ? sorted : sorted.slice(0, CHART_POINTS)).map((w, i) => (
                <WeightRow
                  key={w.id}
                  petId={pet.id}
                  weight={w}
                  previous={sorted[i + 1]}
                  editable={editable}
                  today={today}
                  onChanged={refresh}
                />
              ))}
            </ul>
            {sorted.length > CHART_POINTS && (
              <button type="button" onClick={() => setShowAll((s) => !s)} className="self-start text-primary hover:underline font-label-md text-label-md">
                {showAll ? "Afficher moins" : `Voir tout l'historique (${sorted.length} pesées)`}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/** Ajout d'une pesée : date (aujourd'hui par défaut), poids, note ; confirmation au-delà de 30 % d'écart. */
function WeightForm({
  petId,
  birthDate,
  weights,
  onCancel,
  onSaved,
}: {
  petId: string;
  birthDate: string;
  weights: PetWeight[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const today = localDay();
  const [day, setDay] = useState(today);
  const [kg, setKg] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError("");
    const { value, errors } = validateWeight({ day, weightKg: kg, note }, { today, birthDate });
    const first = Object.values(errors).find(Boolean);
    if (first) {
      setError(first);
      return;
    }
    if (weights.some((w) => w.day === value.day)) {
      setError(`Une pesée existe déjà le ${formatDay(value.day)} : corrigez-la dans l'historique.`);
      return;
    }
    // Pesée précédente : la plus récente avant ce jour (ou la suivante si c'est la plus ancienne).
    const before = weights.find((w) => w.day < value.day) ?? weights[weights.length - 1];
    if (
      before &&
      weightChangeRatio(before.weightKg, value.weightKg) > WEIGHT_CONFIRM_RATIO &&
      !window.confirm(
        `Écart de plus de 30 % avec la pesée du ${formatDay(before.day)} (${formatKg(before.weightKg)}). ` +
          `Confirmez-vous ${formatKg(value.weightKg)} ?`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await addWeight(petId, value);
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  const input = "h-11 w-full rounded-lg bg-surface-container-lowest px-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/20";
  return (
    <div className="bg-surface-container-low rounded-xl p-space-md flex flex-col gap-space-md">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
        <label className="flex flex-col gap-1">
          <span className="font-label-md text-label-md">Date</span>
          <input type="date" max={today} value={day} onChange={(e) => setDay(e.target.value)} className={input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-md text-label-md">Poids (kg)</span>
          <input
            type="text"
            inputMode="decimal"
            autoFocus
            placeholder="Ex : 4,6"
            value={kg}
            onChange={(e) => setKg(e.target.value)}
            className={input}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-md text-label-md">Note</span>
          <input
            type="text"
            maxLength={WEIGHT_NOTE_MAX_LENGTH}
            placeholder="Facultatif"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={input}
          />
        </label>
      </div>
      {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
      <div className="flex justify-end gap-space-sm">
        <button type="button" onClick={onCancel} className="h-10 px-space-md rounded-full bg-surface-container font-label-md text-label-md">
          Annuler
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="h-10 px-space-lg rounded-full bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container disabled:opacity-70"
        >
          {busy ? "Enregistrement…" : "Enregistrer la pesée"}
        </button>
      </div>
    </div>
  );
}

/** Ligne de l'historique : correction du poids et de la note (la date ne change pas) ou suppression. */
function WeightRow({
  petId,
  weight,
  previous,
  editable,
  today,
  onChanged,
}: {
  petId: string;
  weight: PetWeight;
  previous?: PetWeight;
  editable: boolean;
  today: string;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [kg, setKg] = useState(String(weight.weightKg).replace(".", ","));
  const [note, setNote] = useState(weight.note);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const diff = previous ? weight.weightKg - previous.weightKg : null;

  async function save() {
    setError("");
    const { value, errors } = validateWeight({ day: weight.day, weightKg: kg, note }, { today });
    const first = Object.values(errors).find(Boolean);
    if (first) {
      setError(first);
      return;
    }
    setBusy(true);
    try {
      await updateWeight(petId, weight.id, { weightKg: value.weightKg, note: value.note });
      setEditing(false);
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Supprimer la pesée du ${formatDay(weight.day)} (${formatKg(weight.weightKg)}) ?`)) return;
    setBusy(true);
    try {
      await deleteWeight(petId, weight.id);
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <li className="py-space-sm flex flex-col gap-space-sm">
        <div className="flex flex-wrap items-center gap-space-sm">
          <span className="font-label-md text-label-md text-on-surface w-28">{formatDay(weight.day, { dateStyle: "medium" })}</span>
          <input
            type="text"
            inputMode="decimal"
            aria-label="Poids (kg)"
            value={kg}
            onChange={(e) => setKg(e.target.value)}
            className="h-9 w-24 rounded-lg bg-surface-container-low px-2 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <span className="text-on-surface-variant">kg</span>
          <input
            type="text"
            aria-label="Note"
            maxLength={WEIGHT_NOTE_MAX_LENGTH}
            placeholder="Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="h-9 flex-1 min-w-[140px] rounded-lg bg-surface-container-low px-2 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button type="button" onClick={() => setEditing(false)} className="h-9 px-space-sm rounded-full bg-surface-container font-label-sm text-label-sm">
            Annuler
          </button>
          <button type="button" onClick={save} disabled={busy} className="h-9 px-space-md rounded-full bg-primary text-on-primary font-label-sm text-label-sm disabled:opacity-70">
            Enregistrer
          </button>
        </div>
        {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
      </li>
    );
  }

  return (
    <li className="py-space-sm flex items-center gap-space-sm">
      <span className="font-label-md text-label-md text-on-surface w-28 shrink-0">{formatDay(weight.day, { dateStyle: "medium" })}</span>
      <span className="font-label-lg text-label-lg text-on-surface w-20 shrink-0">{formatKg(weight.weightKg)}</span>
      {diff !== null && (
        <span
          className={`font-label-sm text-label-sm w-20 shrink-0 ${
            Math.abs(diff) < 0.005 ? "text-on-surface-variant" : diff > 0 ? "text-amber-700" : "text-sky-700"
          }`}
        >
          {Math.abs(diff) < 0.005 ? "=" : signedKg(diff)}
        </span>
      )}
      <span className="font-body-sm text-body-sm text-on-surface-variant flex-1 truncate" title={weight.note}>
        {weight.note}
      </span>
      {editable && (
        <span className="flex gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Corriger la pesée du ${formatDay(weight.day)}`}
            title="Corriger"
            className="w-8 h-8 rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-container flex items-center justify-center"
          >
            <Icon name="edit" className="text-[16px]" />
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            aria-label={`Supprimer la pesée du ${formatDay(weight.day)}`}
            title="Supprimer"
            className="w-8 h-8 rounded-full text-on-surface-variant hover:text-error hover:bg-error-container/40 flex items-center justify-center"
          >
            <Icon name="delete" className="text-[16px]" />
          </button>
        </span>
      )}
      {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
    </li>
  );
}

/** Courbe SVG des dernières pesées (de la plus ancienne à la plus récente). */
function WeightChart({ weights, name }: { weights: PetWeight[]; name: string }) {
  const W = 600;
  const H = 220;
  const pad = { top: 28, right: 24, bottom: 30, left: 48 };
  const values = weights.map((w) => w.weightKg);
  let min = Math.min(...values);
  let max = Math.max(...values);
  const margin = Math.max((max - min) * 0.15, max * 0.02, 0.1);
  min = Math.max(0, min - margin);
  max += margin;
  const x = (i: number) =>
    weights.length === 1 ? (pad.left + W - pad.right) / 2 : pad.left + (i * (W - pad.left - pad.right)) / (weights.length - 1);
  const y = (kg: number) => pad.top + ((max - kg) * (H - pad.top - pad.bottom)) / (max - min);
  const points = weights.map((w, i) => `${x(i)},${y(w.weightKg)}`).join(" ");
  const area = `${x(0)},${H - pad.bottom} ${points} ${x(weights.length - 1)},${H - pad.bottom}`;
  const ticks = [max, (max + min) / 2, min];
  const label = (kg: number) => kg.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

  return (
    <figure className="bg-surface-container-low/60 rounded-xl p-space-sm">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Courbe de poids de ${name} : ${weights.map((w) => `${shortDay(w.day)} ${label(w.weightKg)} kg`).join(", ")}`}
        className="w-full h-auto"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} className="stroke-outline-variant/40" strokeDasharray="4 4" />
            <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" className="fill-on-surface-variant text-[11px]">
              {label(t)} kg
            </text>
          </g>
        ))}
        {weights.length > 1 && (
          <>
            <polygon points={area} className="fill-primary/10" />
            <polyline points={points} fill="none" className="stroke-primary" strokeWidth={2.5} strokeLinejoin="round" />
          </>
        )}
        {weights.map((w, i) => (
          <g key={w.id}>
            <circle cx={x(i)} cy={y(w.weightKg)} r={5} className="fill-surface-container-lowest stroke-primary" strokeWidth={2.5} />
            <text x={x(i)} y={y(w.weightKg) - 11} textAnchor="middle" className="fill-on-surface text-[11px] font-semibold">
              {label(w.weightKg)}
            </text>
            <text x={x(i)} y={H - 8} textAnchor="middle" className="fill-on-surface-variant text-[11px]">
              {shortDay(w.day)}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  );
}
