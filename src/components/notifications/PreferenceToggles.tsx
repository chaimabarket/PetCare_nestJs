"use client";

import { Icon } from "@/components/ui/Icon";
import { Toggle } from "@/components/ui/Toggle";
import { PREF_OPTIONS } from "@/lib/notification-prefs";
import type { NotificationPrefs } from "@/lib/users";

/** Liste des préférences d'alerte avec leurs interrupteurs. */
export function PreferenceToggles({
  prefs,
  onToggle,
  city,
  disabled = false,
  compact = false,
}: {
  prefs: NotificationPrefs;
  onToggle: (key: keyof NotificationPrefs, value: boolean) => void;
  city?: string;
  disabled?: boolean;
  /** Version resserrée (panneau latéral). */
  compact?: boolean;
}) {
  return (
    <ul className={compact ? "space-y-space-md" : "flex flex-col gap-space-sm"}>
      {PREF_OPTIONS.map((option) => (
        <li
          key={option.key}
          className={`flex items-center justify-between gap-space-md ${
            compact ? "" : "p-space-md rounded-xl bg-surface-container-low/70 hover:bg-surface-container-low transition-colors"
          }`}
        >
          <div className={`flex items-center ${compact ? "gap-space-sm" : "gap-space-md"}`}>
            <div
              className={`rounded-full flex items-center justify-center shrink-0 ${option.iconStyle} ${
                compact ? "w-8 h-8" : "w-10 h-10"
              }`}
            >
              <Icon name={option.icon} className={compact ? "text-[18px]" : "text-[22px]"} />
            </div>
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-on-surface">{option.title}</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">{option.description(city)}</span>
            </div>
          </div>
          <Toggle
            label={option.title}
            checked={!option.soon && prefs[option.key]}
            disabled={disabled || option.soon}
            onChange={(value) => onToggle(option.key, value)}
          />
        </li>
      ))}
    </ul>
  );
}
