import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/components/auth/AuthProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PetCare Community",
  description: "Gérez vos animaux, trouvez des services et adoptez près de chez vous.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${inter.variable} h-full antialiased`}>
      <head>
        {/* Icônes utilisées par les maquettes Stitch (voir components/ui/Icon.tsx).
            display=block évite d'afficher le nom de l'icône en texte pendant le chargement. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font, @next/next/google-font-display */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
        />
      </head>
      <body className="min-h-full flex flex-col bg-background font-body-md text-body-md text-on-surface">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
