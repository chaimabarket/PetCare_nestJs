"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { ACTIONS, describeAction, type AssistantAction } from "@/lib/assistant/actions";

const ICONS: Record<AssistantAction["type"], string> = {
  ajouter_soin: "medical_information",
  ajouter_traitement: "medication",
  creer_rendez_vous: "event_available",
  ajouter_pesee: "monitor_weight",
  creer_rappel: "alarm_add",
};

/** Page où retrouver l'enregistrement (`null` si l'animal n'existe plus). */
function viewHref(action: AssistantAction, pet: { id: string; name: string } | null): string | null {
  if (action.type === "creer_rendez_vous") return "/rendez-vous";
  if (action.type === "creer_rappel") return "/rappels";
  if (!pet) return null;
  if (action.type === "ajouter_pesee") return `/animaux/${encodeURIComponent(pet.id)}`;
  return `/animaux/${encodeURIComponent(pet.id)}/carnet-de-sante?nom=${encodeURIComponent(pet.name)}`;
}

/** Carte de confirmation d'une action préparée par l'assistant : rien n'est enregistré avant « Confirmer ». */
export function ActionCard({
  action,
  pet,
  saving = false,
  error,
  onConfirm,
  onCancel,
}: {
  action: AssistantAction;
  pet: { id: string; name: string } | null;
  saving?: boolean;
  error?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}) {
  const { label } = ACTIONS[action.type];
  const done = action.status === "done";
  const cancelled = action.status === "cancelled";
  const href = done ? viewHref(action, pet) : null;
  const title = done ? `${label} · enregistré` : cancelled ? `${label} · annulé` : `${label} ?`;

  return (
    <div
      className={`rounded-2xl px-space-md py-space-sm ring-1 ${
        done
          ? "bg-primary-fixed/30 ring-primary/30"
          : cancelled
            ? "bg-surface-container-low ring-outline-variant/40"
            : "bg-secondary-fixed/30 ring-secondary/30"
      }`}
    >
      <p className={`flex items-center gap-space-xs font-label-lg text-label-lg ${done ? "text-primary" : cancelled ? "text-on-surface-variant" : "text-secondary"}`}>
        <Icon name={done ? "check_circle" : ICONS[action.type]} filled={done} className="text-[20px]" />
        {title}
      </p>
      <dl className={`mt-space-xs grid grid-cols-[auto_1fr] gap-x-space-sm gap-y-0.5 font-body-md text-body-md ${cancelled ? "line-through opacity-70" : ""}`}>
        {describeAction(action).map(([name, value]) => (
          <div key={name} className="contents">
            <dt className="text-on-surface-variant">{name}</dt>
            <dd className="font-medium text-on-surface break-words">{value}</dd>
          </div>
        ))}
      </dl>
      {error && (
        <p role="alert" className="mt-space-xs font-body-sm text-body-sm text-error">
          {error}
        </p>
      )}
      {action.status === "pending" && (
        <div className="mt-space-sm flex justify-end gap-space-xs">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="h-9 px-space-md rounded-full font-label-lg text-label-lg text-on-surface-variant hover:bg-surface-container disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="inline-flex items-center gap-1 h-9 px-space-md rounded-full bg-primary text-on-primary font-label-lg text-label-lg hover:bg-primary-container disabled:opacity-60"
          >
            <Icon name={saving ? "progress_activity" : "check"} className={`text-[18px] ${saving ? "animate-spin" : ""}`} />
            {error ? "Réessayer" : "Confirmer"}
          </button>
        </div>
      )}
      {href && (
        <div className="mt-space-xs flex justify-end">
          <Link href={href} className="font-label-lg text-label-lg text-primary hover:underline">
            Voir
          </Link>
        </div>
      )}
    </div>
  );
}
