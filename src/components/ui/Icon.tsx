/**
 * Icône Material Symbols, comme dans les maquettes Stitch.
 * Liste des noms : https://fonts.google.com/icons
 */
export function Icon({
  name,
  filled = false,
  className = "",
}: {
  name: string;
  filled?: boolean;
  className?: string;
}) {
  return (
    <span aria-hidden className={`material-symbols-outlined ${filled ? "filled" : ""} ${className}`}>
      {name}
    </span>
  );
}
