import type { NotificationType } from "./notifications";
import type { NotificationPrefs } from "./users";

export type PrefOption = {
  key: keyof NotificationPrefs;
  icon: string;
  iconStyle: string;
  title: string;
  description: (city?: string) => string;
  /** Types de notification masqués quand l'option est désactivée. */
  types: NotificationType[];
  /** Pas encore géré par l'application (affiché désactivé). */
  soon?: boolean;
};

/** Liste unique des préférences, utilisée par le profil et la page Notifications. */
export const PREF_OPTIONS: PrefOption[] = [
  {
    key: "appointments",
    icon: "calendar_month",
    iconStyle: "bg-primary/10 text-primary",
    title: "Rendez-vous & services",
    description: () => "Confirmations, reports et annulations de vos rendez-vous et réservations",
    types: ["rendez-vous", "service"],
  },
  {
    key: "careReminders",
    icon: "vaccines",
    iconStyle: "bg-primary-fixed/50 text-on-primary-fixed",
    title: "Rappels de soins & santé",
    description: () => "Rappels de vaccins, traitements et suivi du carnet de santé",
    types: ["rappel", "sante"],
  },
  {
    key: "adoption",
    icon: "favorite",
    iconStyle: "bg-secondary-fixed text-secondary",
    title: "Adoptions & candidatures",
    description: () => "Nouvelles candidatures, réponses et confirmations d'adoption",
    types: ["adoption"],
  },
  {
    key: "lostFoundAlerts",
    icon: "campaign",
    iconStyle: "bg-tertiary-fixed text-tertiary",
    title: "Perdus & trouvés",
    description: (city) => `Animaux perdus ou trouvés signalés près de chez vous${city ? ` (${city})` : ""}`,
    types: ["perdu-trouve"],
  },
  {
    key: "email",
    icon: "outgoing_mail",
    iconStyle: "bg-surface-container text-on-surface-variant",
    title: "Récapitulatif par e-mail",
    description: () => "Bientôt disponible — les notifications s'affichent pour l'instant dans l'application",
    types: [],
    soon: true,
  },
];

/** Vrai si une notification de ce type doit être affichée avec ces préférences. */
export function isTypeEnabled(type: NotificationType, prefs: NotificationPrefs): boolean {
  const option = PREF_OPTIONS.find((o) => o.types.includes(type));
  return option ? prefs[option.key] : true;
}
