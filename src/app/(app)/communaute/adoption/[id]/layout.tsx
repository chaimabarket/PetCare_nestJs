// L'identifiant de l'annonce n'est connu qu'à la requête, et la Navbar commune lit usePathname()
// hors <Suspense> : ces pages sont donc rendues à la demande plutôt que pré-rendues.
export const instant = false;

export default function AdoptionListingLayout({ children }: LayoutProps<"/communaute/adoption/[id]">) {
  return children;
}
