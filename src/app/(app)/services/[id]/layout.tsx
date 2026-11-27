// L'identifiant du prestataire n'est connu qu'à la requête, et la Navbar commune lit usePathname()
// hors <Suspense> : ces pages sont rendues à la demande plutôt que pré-rendues (comme Adoption et Mes animaux).
export const instant = false;

export default function ProviderLayout({ children }: LayoutProps<"/services/[id]">) {
  return children;
}
