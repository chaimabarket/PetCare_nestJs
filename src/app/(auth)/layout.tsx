/** Écrans connexion / inscription / mot de passe oublié (sans la navigation de l'application). */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="w-full bg-surface min-h-screen flex flex-col justify-center items-center px-margin py-space-xl">
      {children}
    </main>
  );
}
