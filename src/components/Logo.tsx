import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

/** Logo complet (écrans de connexion / inscription). */
export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-space-sm">
      <span className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center shadow-sm">
        <Icon name="pets" filled className="text-on-primary text-[24px]" />
      </span>
      <span className="flex flex-col">
        <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight">PetCare</span>
        <span className="font-label-sm text-label-sm text-primary -mt-1 font-semibold tracking-wider uppercase">
          Community
        </span>
      </span>
    </Link>
  );
}
