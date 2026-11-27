import type { Metadata } from "next";

// Le jeton n'est connu qu'à la requête : page rendue à la demande, jamais pré-rendue.
export const instant = false;

/** Carnet partagé : jamais indexé, et le jeton de l'adresse n'est pas transmis aux autres sites (Referer). */
export const metadata: Metadata = {
  title: "Carnet de santé partagé · PetCare",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function PartageLayout({ children }: LayoutProps<"/partage/[token]">) {
  return <main className="w-full flex-1 bg-background">{children}</main>;
}
