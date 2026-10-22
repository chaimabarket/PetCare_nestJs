/** Avatar rond avec les initiales (pas de photo dans la première version). */
export function Avatar({ name, className = "" }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <span
      aria-hidden
      className={`flex items-center justify-center rounded-full bg-primary-container text-on-primary font-semibold ${className}`}
    >
      {initials || "?"}
    </span>
  );
}
