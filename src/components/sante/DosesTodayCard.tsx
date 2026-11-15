"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { todayIso } from "@/lib/health-records";
import { getHealthSummary } from "@/lib/health-records-api";

/**
 * Carte « Prises du jour : X/Y » (page Rappels & Soins). Les prises restent gérées dans l'onglet Santé :
 * elles ne sont pas recopiées en rappels, la carte renvoie simplement vers /carnet-de-sante.
 */
export function DosesTodayCard() {
  const [counts, setCounts] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    let active = true;
    getHealthSummary(todayIso())
      .then((s) => active && setCounts({ done: s.doses.filter((d) => d.taken).length, total: s.doses.length }))
      .catch(() => active && setCounts(null));
    return () => {
      active = false;
    };
  }, []);

  if (!counts || counts.total === 0) return null;
  const left = counts.total - counts.done;

  return (
    <Link
      href="/carnet-de-sante"
      className="flex items-center gap-3 rounded-2xl bg-primary-fixed/30 p-4 transition-shadow hover:shadow-md"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
        <Icon name="medication" className="text-[22px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-label-lg text-label-lg text-on-surface">
          Prises du jour : {counts.done}/{counts.total}
        </span>
        <span className="block font-body-sm text-body-sm text-on-surface-variant">
          {left ? `${left} prise${left > 1 ? "s" : ""} de traitement à noter dans l'onglet Santé.` : "Toutes les prises du jour sont notées."}
        </span>
      </span>
      <Icon name="chevron_right" className="text-outline" />
    </Link>
  );
}
