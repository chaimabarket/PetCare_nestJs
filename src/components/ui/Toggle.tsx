/** Interrupteur on/off (préférences). */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Libellé lu par les lecteurs d'écran. */
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="w-11 h-6 bg-surface-container rounded-full peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 peer-checked:bg-primary-container peer-disabled:opacity-60 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface-container-lowest after:rounded-full after:h-5 after:w-5 after:shadow-sm after:transition-all peer-checked:after:translate-x-full" />
    </label>
  );
}
