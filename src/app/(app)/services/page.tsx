import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

/** Page provisoire de l'onglet « Services » : elle sera remplacée par le module Services. */
export default function ServicesPage() {
  return (
    <div className="max-w-7xl mx-auto px-margin md:px-margin-md lg:px-margin-lg py-space-xl w-full">
      <div className="max-w-xl mx-auto flex flex-col items-center gap-space-md text-center bg-surface-container-lowest rounded-2xl p-space-xl shadow-sm">
        <span className="w-16 h-16 rounded-full bg-primary-fixed/50 text-primary flex items-center justify-center">
          <Icon name="storefront" filled className="text-[32px]" />
        </span>
        <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">Services</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">
          Bientôt disponible : vétérinaires, toilettage, garde et éducation près de chez vous.
        </p>
        <Link
          href="/rendez-vous"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-surface-container-low px-space-lg font-label-lg text-label-lg text-primary hover:bg-primary-container hover:text-on-primary transition-all"
        >
          <Icon name="calendar_today" className="text-[20px]" />
          Voir mes rendez-vous
        </Link>
      </div>
    </div>
  );
}
