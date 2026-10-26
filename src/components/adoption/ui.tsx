import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import {
  APPLICATION_STATUS,
  LISTING_STATUS,
  PERSONALITY,
  type ApplicationStatus,
  type ListingStatus,
  type PersonalityTrait,
  type StatusTone,
} from "@/lib/adoption";
import { gaugeTone } from "@/lib/adoption-compatibility";

// Classes écrites en entier pour que Tailwind les détecte.
const pillTones: Record<StatusTone, { pill: string; dot: string }> = {
  green: { pill: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  amber: { pill: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  coral: { pill: "bg-secondary-fixed text-on-secondary-fixed-variant", dot: "bg-[#E07A5F]" },
  grey: { pill: "bg-surface-container text-on-surface-variant", dot: "bg-outline" },
};

export function StatusPill({ tone, children, className = "" }: { tone: StatusTone; children: ReactNode; className?: string }) {
  const style = pillTones[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-label-sm text-label-sm whitespace-nowrap ${style.pill} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {children}
    </span>
  );
}

export function ListingStatusPill({ status, className }: { status: ListingStatus; className?: string }) {
  const config = LISTING_STATUS[status];
  return (
    <StatusPill tone={config.tone} className={className}>
      {config.label}
    </StatusPill>
  );
}

export function ApplicationStatusPill({ status, className }: { status: ApplicationStatus; className?: string }) {
  const config = APPLICATION_STATUS[status];
  return (
    <StatusPill tone={config.tone} className={className}>
      {config.label}
    </StatusPill>
  );
}

/** Étiquette corail « ADOPTE-MOI ». */
export function AdoptMeTag({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-fixed text-[#E07A5F] font-label-sm text-label-sm font-bold uppercase tracking-wide ${className}`}
    >
      <Icon name="favorite" filled className="text-[13px]" />
      Adopte-moi
    </span>
  );
}

/** Puce de filtre sélectionnable. */
export function Chip({
  selected,
  onClick,
  children,
  className = "",
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-full font-label-md text-label-md transition-colors shrink-0 ${
        selected
          ? "bg-primary-container text-on-primary shadow-sm"
          : "bg-surface-container-low text-on-surface hover:bg-surface-container"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function PersonalityBadges({
  traits,
  max,
  size = "md",
}: {
  traits: PersonalityTrait[];
  max?: number;
  size?: "sm" | "md";
}) {
  const shown = max ? traits.slice(0, max) : traits;
  if (shown.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {shown.map((trait) => (
        <li
          key={trait}
          className={`inline-flex items-center gap-1 rounded-full bg-surface-container-low text-on-surface ${
            size === "sm" ? "px-2 py-0.5 font-label-sm text-label-sm" : "px-3 py-1 font-label-md text-label-md"
          }`}
        >
          <span aria-hidden>{PERSONALITY[trait].emoji}</span>
          {PERSONALITY[trait].label}
        </li>
      ))}
    </ul>
  );
}

/**
 * Photo d'annonce (data URL compressée). <img> plutôt que next/image :
 * les photos sont déjà redimensionnées et stockées dans Firestore.
 */
export function Photo({ src, alt, className = "" }: { src?: string; alt: string; className?: string }) {
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-surface-container text-outline ${className}`}>
        <Icon name="pets" className="text-[32px]" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={`object-cover ${className}`} />;
}

const gaugeColors = {
  teal: { stroke: "stroke-primary-container", text: "text-primary" },
  amber: { stroke: "stroke-amber-500", text: "text-amber-600" },
  grey: { stroke: "stroke-outline", text: "text-on-surface-variant" },
};

/** Jauge circulaire de compatibilité. */
export function CompatibilityGauge({ score, size = 56 }: { score: number; size?: number }) {
  const colors = gaugeColors[gaugeTone(score)];
  const radius = 15.5;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${score} % de compatibilité`}>
      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
        <circle cx="18" cy="18" r={radius} fill="none" strokeWidth="3" className="stroke-surface-container" />
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score / 100)}
          className={colors.stroke}
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center font-bold ${colors.text}`}
        style={{ fontSize: Math.max(11, size * 0.24) }}
      >
        {score}%
      </span>
    </div>
  );
}

/** Sélecteur − n + . */
export function Counter({
  label,
  value,
  onChange,
  min = 0,
  max = 10,
  icon,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  icon?: string;
}) {
  const buttonClass =
    "w-9 h-9 rounded-full flex items-center justify-center bg-surface-container-low text-primary hover:bg-primary-container hover:text-on-primary transition-colors disabled:opacity-40 disabled:pointer-events-none";
  return (
    <div className="flex items-center justify-between gap-space-md p-space-sm rounded-xl bg-surface-container-low/60">
      <span className="flex items-center gap-space-sm font-label-lg text-label-lg text-on-surface">
        {icon && <Icon name={icon} className="text-[20px] text-primary" />}
        {label}
      </span>
      <div className="flex items-center gap-space-sm">
        <button type="button" className={buttonClass} onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`${label} : moins`}>
          <Icon name="remove" className="text-[20px]" />
        </button>
        <span className="w-6 text-center font-headline-sm text-headline-sm" aria-live="polite">
          {value}
        </span>
        <button type="button" className={buttonClass} onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`${label} : plus`}>
          <Icon name="add" className="text-[20px]" />
        </button>
      </div>
    </div>
  );
}

export type Choice<T extends string> = { value: T; label: string; icon?: string; description?: string };

/** Grandes cartes sélectionnables (questions du formulaire de candidature). */
export function ChoiceCards<T extends string>({
  label,
  options,
  value,
  onChange,
  columns = 2,
}: {
  label: string;
  options: Choice<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  columns?: 2 | 3;
}) {
  return (
    <fieldset className="flex flex-col gap-space-sm">
      <legend className="font-label-lg text-label-lg text-on-surface mb-space-sm">{label}</legend>
      <div className={`grid gap-space-sm ${columns === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={`flex flex-col items-center justify-center gap-1 p-space-md rounded-2xl text-center transition-all ${
                selected
                  ? "bg-primary/10 ring-2 ring-primary-container text-primary"
                  : "bg-surface-container-low text-on-surface hover:bg-surface-container"
              }`}
            >
              {option.icon && <Icon name={option.icon} filled={selected} className="text-[28px]" />}
              <span className="font-label-lg text-label-lg">{option.label}</span>
              {option.description && (
                <span className="font-body-sm text-body-sm text-on-surface-variant">{option.description}</span>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Fil d'Ariane" className="flex flex-wrap items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant mb-space-md">
      <Link href="/" className="hover:text-primary transition-colors flex items-center gap-1">
        <Icon name="home" className="text-[16px]" />
        Accueil
      </Link>
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-space-xs">
          <Icon name="chevron_right" className="text-[14px] text-outline" />
          {item.href ? (
            <Link href={item.href} className="hover:text-primary transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-on-surface font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: string;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl p-space-2xl shadow-sm flex flex-col items-center text-center gap-space-sm">
      <div className="w-20 h-20 rounded-full bg-secondary-fixed/60 flex items-center justify-center">
        <Icon name={icon} filled className="text-secondary text-[40px]" />
      </div>
      <h2 className="font-headline-sm text-headline-sm text-on-surface">{title}</h2>
      <p className="font-body-md text-body-md text-on-surface-variant max-w-sm">{text}</p>
      {action && <div className="mt-space-sm">{action}</div>}
    </div>
  );
}

export function SectionCard({
  icon,
  title,
  subtitle,
  children,
  className = "",
}: {
  icon: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-md ${className}`}>
      <div className="flex items-start gap-space-sm">
        <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon name={icon} className="text-[22px]" />
        </span>
        <div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">{title}</h2>
          {subtitle && <p className="font-body-sm text-body-sm text-on-surface-variant">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function PageLoading({ text = "Chargement…" }: { text?: string }) {
  return <p className="p-space-xl text-center text-on-surface-variant">{text}</p>;
}

/** Lien stylé comme un bouton (mêmes variantes visuelles que <Button>). */
export function ButtonLink({
  href,
  variant = "primary",
  icon,
  children,
  className = "",
}: {
  href: string;
  variant?: "primary" | "secondary" | "coral";
  icon?: string;
  children: ReactNode;
  className?: string;
}) {
  const variants = {
    primary: "bg-primary text-on-primary shadow-sm hover:bg-primary-container",
    secondary: "bg-surface-container-low text-primary hover:bg-primary-container hover:text-on-primary",
    coral: "bg-[#E07A5F] text-white shadow-sm hover:bg-secondary",
  };
  return (
    <Link
      href={href}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-full px-space-lg font-label-lg text-label-lg transition-all ${variants[variant]} ${className}`}
    >
      {icon && <Icon name={icon} className="text-[18px]" />}
      <span>{children}</span>
    </Link>
  );
}
