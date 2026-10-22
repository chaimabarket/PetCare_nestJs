import { Navbar } from "@/components/Navbar";
import { NotificationsProvider } from "@/components/notifications/NotificationsProvider";

/** Pages de l'application avec la navigation commune (Accueil, Mes animaux, Communauté, Services). */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <NotificationsProvider>
      <Navbar />
      <main className="w-full flex-1 bg-background pb-20 md:pb-0">{children}</main>
    </NotificationsProvider>
  );
}
