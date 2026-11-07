// L'identifiant de l'animal n'est connu qu'à la requête, et la Navbar commune lit usePathname()
// hors <Suspense> : ces pages sont donc rendues à la demande plutôt que pré-rendues.
export const instant = false;

export default function CarnetDeSanteLayout({ children }: LayoutProps<"/animaux/[id]/carnet-de-sante">) {
  return children;
}
