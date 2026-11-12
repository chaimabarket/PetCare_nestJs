// L'identifiant du rendez-vous n'est connu qu'à la requête, et la Navbar commune lit usePathname()
// hors <Suspense> : ces pages sont donc rendues à la demande plutôt que pré-rendues
// (même convention que le module Adoption).
export const instant = false;

export default function AppointmentLayout({ children }: LayoutProps<"/rendez-vous/[id]">) {
  return children;
}
