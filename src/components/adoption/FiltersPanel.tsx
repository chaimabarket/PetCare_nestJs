"use client";

import { Icon } from "@/components/ui/Icon";
import { Toggle } from "@/components/ui/Toggle";
import {
  AGE_GROUPS,
  activeFilterCount,
  keysOf,
  PERSONALITY,
  SEXES,
  SIZES,
  SPECIES,
  type ListingFilters,
} from "@/lib/adoption";
import { Chip } from "./ui";

function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-space-xs">
      <span className="font-label-md text-label-md text-on-surface">{title}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/** Filtres du fil : barre latérale sur ordinateur, panneau du bas sur mobile. */
export function FiltersPanel({
  filters,
  onChange,
  cities,
}: {
  filters: ListingFilters;
  onChange: (filters: ListingFilters) => void;
  cities: string[];
}) {
  const set = <K extends keyof ListingFilters>(key: K, value: ListingFilters[K]) => onChange({ ...filters, [key]: value });

  return (
    <div className="flex flex-col gap-space-lg">
      <div className="p-space-sm rounded-xl bg-secondary-fixed/25 flex items-center justify-between gap-space-sm">
        <div className="flex flex-col">
          <span className="flex items-center gap-1 font-label-md text-label-md text-on-surface">
            <Icon name="favorite" filled className="text-[16px] text-[#E07A5F]" />
            Adopte-moi uniquement
          </span>
          <span className="font-body-sm text-body-sm text-on-surface-variant">Coups de cœur &amp; urgences</span>
        </div>
        <Toggle
          checked={filters.adoptMeOnly}
          onChange={(value) => set("adoptMeOnly", value)}
          label="Adopte-moi uniquement"
        />
      </div>

      <Section title="Espèce">
        {keysOf(SPECIES).map((s) => (
          <Chip key={s} selected={filters.species.includes(s)} onClick={() => set("species", toggleIn(filters.species, s))}>
            {SPECIES[s].emoji} {SPECIES[s].label}
          </Chip>
        ))}
      </Section>

      <Section title="Âge">
        {keysOf(AGE_GROUPS).map((a) => (
          <Chip key={a} selected={filters.ages.includes(a)} onClick={() => set("ages", toggleIn(filters.ages, a))}>
            {AGE_GROUPS[a]}
          </Chip>
        ))}
      </Section>

      <Section title="Sexe">
        <Chip selected={!filters.sex} onClick={() => set("sex", "")}>
          Indifférent
        </Chip>
        {keysOf(SEXES).map((s) => (
          <Chip key={s} selected={filters.sex === s} onClick={() => set("sex", filters.sex === s ? "" : s)}>
            {SEXES[s].label} {SEXES[s].symbol}
          </Chip>
        ))}
      </Section>

      <Section title="Taille">
        {keysOf(SIZES).map((s) => (
          <Chip key={s} selected={filters.sizes.includes(s)} onClick={() => set("sizes", toggleIn(filters.sizes, s))}>
            {SIZES[s]}
          </Chip>
        ))}
      </Section>

      <label className="flex flex-col gap-space-xs">
        <span className="font-label-md text-label-md text-on-surface">Ville</span>
        <span className="relative flex items-center bg-surface-container-low rounded-xl px-space-md h-11">
          <Icon name="location_on" className="text-outline mr-space-sm text-[18px]" />
          <select
            value={filters.city}
            onChange={(e) => set("city", e.target.value)}
            className="w-full bg-transparent outline-none font-body-md text-body-md text-on-surface cursor-pointer"
          >
            <option value="">Toutes les villes</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </span>
      </label>

      <Section title="Personnalité">
        {keysOf(PERSONALITY).map((t) => (
          <Chip key={t} selected={filters.traits.includes(t)} onClick={() => set("traits", toggleIn(filters.traits, t))}>
            {PERSONALITY[t].emoji} {PERSONALITY[t].label}
          </Chip>
        ))}
      </Section>
    </div>
  );
}

export function FilterCountBadge({ filters }: { filters: ListingFilters }) {
  const count = activeFilterCount(filters);
  if (!count) return null;
  return (
    <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-primary text-on-primary text-[10px] font-bold">
      {count}
    </span>
  );
}
