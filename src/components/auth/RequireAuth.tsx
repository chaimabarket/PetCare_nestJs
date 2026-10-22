"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/lib/users";
import { useAuth } from "./AuthProvider";

/**
 * Réserve une page aux utilisateurs connectés, éventuellement à certains rôles.
 * Exemple : <RequireAuth roles={["refuge"]}>…</RequireAuth>
 */
export function RequireAuth({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: UserRole[];
}) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/connexion");
  }, [loading, user, router]);

  if (loading || !user) {
    return <p className="p-8 text-center text-on-surface-variant">Chargement…</p>;
  }

  if (roles && (!profile || !roles.includes(profile.role))) {
    return (
      <p className="p-8 text-center text-on-surface-variant">
        Cette page n&apos;est pas accessible avec votre type de compte.
      </p>
    );
  }

  return children;
}
