import { Icon } from "@/components/ui/Icon";

/** Mention en bas des formulaires d'authentification. */
export function DataNotice() {
  return (
    <div className="flex items-center justify-center gap-1.5 text-center">
      <Icon name="verified_user" className="text-outline text-[16px]" />
      <span className="font-body-sm text-body-sm text-outline">
        Vos données sont protégées et utilisées uniquement par PetCare Community.
      </span>
    </div>
  );
}
