"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { ageLabel, daysAgoLabel, formatKg, PET_ROUTES, SEX_INFO, speciesLine, type Pet } from "@/lib/pets";
import { ModuleLink, PetAvatar, StatusBadge, WeightAlertBadge } from "./ui";

const shortcut =
  "flex-1 inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl font-label-md text-label-md transition-all";

/** Carte de la liste « Mes animaux » (maquette mes_animaux_petcare_community). */
export function PetCard({ pet, today }: { pet: Pet; today: string }) {
  const href = PET_ROUTES.pet(pet.id);
  const age = ageLabel(pet.birthDate, today);
  return (
    <article className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group relative overflow-hidden">
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-2">
          <Link href={href} aria-label={`Voir la fiche de ${pet.name}`}>
            <PetAvatar pet={pet} className="w-16 h-16 group-hover:scale-105 transition-transform duration-300" />
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {pet.status === "draft" && <StatusBadge tone="amber">Brouillon</StatusBadge>}
            {pet.status === "archived" && <StatusBadge tone="grey">Archivé</StatusBadge>}
            {pet.weightAlert && <WeightAlertBadge alert={pet.weightAlert} />}
            {pet.favorite && <Icon name="favorite" filled className="text-[20px] text-secondary" />}
          </div>
        </div>

        <Link href={href} className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight truncate group-hover:text-primary transition-colors">
              {pet.name}
            </h2>
            {pet.sex && (
              <span title={SEX_INFO[pet.sex].label} className={pet.sex === "female" ? "text-secondary" : "text-primary"}>
                <Icon name={SEX_INFO[pet.sex].icon} className="text-[18px] font-bold" />
              </span>
            )}
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant truncate">{speciesLine(pet)}</p>
        </Link>

        <div className="grid grid-cols-3 gap-2 p-3 bg-surface-container-low rounded-xl">
          <div className="flex flex-col min-w-0">
            <span className="font-label-sm text-label-sm text-on-surface-variant">Âge</span>
            <span className="font-label-lg text-label-lg text-on-surface truncate" title={age}>
              {age || "—"}
            </span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-label-sm text-label-sm text-on-surface-variant">Poids</span>
            <span className="font-label-lg text-label-lg text-on-surface truncate">
              {pet.latestWeight ? formatKg(pet.latestWeight.kg) : "—"}
            </span>
            {pet.latestWeight && (
              <span className="font-label-sm text-label-sm text-on-surface-variant truncate">
                {daysAgoLabel(pet.latestWeight.day, today)}
              </span>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-label-sm text-label-sm text-on-surface-variant">Stérilisé</span>
            <span className="font-label-lg text-label-lg text-on-surface">{pet.sterilized ? "Oui" : "Non"}</span>
          </div>
        </div>
      </div>

      <div className="pt-5 mt-4 flex items-center gap-2">
        <ModuleLink module="health" pet={pet} icon="medical_services" className={`${shortcut} bg-primary/10 text-primary hover:bg-primary/15`}>
          Santé
        </ModuleLink>
        <ModuleLink
          module="appointments"
          pet={pet}
          icon="calendar_today"
          className={`${shortcut} bg-surface-container text-on-surface hover:bg-surface-container-high`}
        >
          Rendez-vous
        </ModuleLink>
        <Link
          href={`${href}#poids`}
          aria-label={`Journal de poids de ${pet.name}`}
          title="Journal de poids"
          className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all"
        >
          <Icon name="monitor_weight" className="text-[18px]" />
        </Link>
      </div>
    </article>
  );
}
