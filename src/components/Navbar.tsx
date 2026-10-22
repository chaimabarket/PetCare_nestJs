"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { useAuth } from "@/components/auth/AuthProvider";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Icon } from "@/components/ui/Icon";

/** Les 4 entrées de navigation communes à toute l'application. */
const navItems = [
  { href: "/", label: "Accueil", icon: "home" },
  { href: "/animaux", label: "Mes animaux", icon: "pets" },
  { href: "/communaute", label: "Communauté", icon: "diversity_3" },
  { href: "/services", label: "Services", icon: "storefront" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Navbar() {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  return (
    <>
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-16 max-w-7xl mx-auto px-margin md:px-margin-md lg:px-margin-lg flex items-center justify-between">
          <div className="flex items-center gap-space-lg">
            <Link href="/" className="flex items-center gap-space-sm">
              <Icon name="pets" className="text-primary text-[28px]" />
              <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight">PetCare</span>
            </Link>
            <nav className="hidden md:flex items-center gap-space-xs">
              {navItems.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`px-space-md py-space-xs rounded-full font-label-md text-label-md transition-colors ${
                      active
                        ? "bg-primary-container text-on-primary-container shadow-sm"
                        : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-space-md">
            {loading ? (
              <span className="w-8 h-8" />
            ) : user ? (
              <>
                <NotificationBell />
                <AccountMenu />
              </>
            ) : (
              <Link
                href="/connexion"
                className="inline-flex items-center h-9 px-space-md rounded-full bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors"
              >
                Se connecter
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Barre de navigation du bas sur mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 bg-surface-container-lowest shadow-[0_-1px_8px_rgba(0,0,0,0.06)] md:hidden">
        {navItems.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 py-2 font-label-sm text-label-sm ${
                active ? "text-primary" : "text-on-surface-variant"
              }`}
            >
              <span className={`px-4 py-0.5 rounded-full ${active ? "bg-primary-fixed/50" : ""}`}>
                <Icon name={item.icon} filled={active} className="text-[22px]" />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
