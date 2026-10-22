import { NOTIFICATION_TYPES, type NotificationType } from "@/lib/notifications";

// Classes écrites en entier pour que Tailwind les détecte.
const tones = {
  primary: {
    bar: "bg-primary",
    iconBox: "bg-primary/10 text-primary",
    badge: "bg-primary-fixed text-on-primary-fixed",
    dot: "bg-primary",
    tint: "bg-primary/5",
    button: "bg-primary text-on-primary hover:bg-primary-container",
  },
  secondary: {
    bar: "bg-secondary",
    iconBox: "bg-secondary-fixed text-secondary",
    badge: "bg-secondary-fixed text-on-secondary-fixed",
    dot: "bg-secondary",
    tint: "bg-secondary/5",
    button: "bg-secondary text-on-secondary hover:bg-secondary-container hover:text-on-secondary-container",
  },
  tertiary: {
    bar: "bg-tertiary",
    iconBox: "bg-tertiary-fixed text-tertiary",
    badge: "bg-error-container text-on-error-container",
    dot: "bg-tertiary",
    tint: "bg-tertiary-fixed/30",
    button: "bg-tertiary text-on-tertiary hover:bg-tertiary-container",
  },
  neutral: {
    bar: "bg-outline",
    iconBox: "bg-surface-container text-on-surface-variant",
    badge: "bg-surface-container text-on-surface-variant",
    dot: "bg-outline",
    tint: "bg-surface-container-low/60",
    button: "bg-primary text-on-primary hover:bg-primary-container",
  },
};

export function notificationStyle(type: NotificationType) {
  const config = NOTIFICATION_TYPES[type] ?? NOTIFICATION_TYPES.compte;
  return { ...config, ...tones[config.tone] };
}
