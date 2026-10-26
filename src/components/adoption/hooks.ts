"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { listFavoriteIds, setFavorite } from "@/lib/adoption";
import { errorMessage } from "@/lib/users";

type AsyncState<T> = { data?: T; error?: string; loading: boolean };

/**
 * Charge des données Firestore. `load` doit être stable (useCallback) ; `null` = pas encore prêt.
 * `reload()` relance le chargement après une modification.
 */
export function useAsync<T>(load: (() => Promise<T>) | null): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ loading: true });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!load) return;
    let active = true;
    load().then(
      (data) => {
        if (active) setState({ data, loading: false });
      },
      (error) => {
        console.error(error);
        if (active) setState({ error: errorMessage(error), loading: false });
      },
    );
    return () => {
      active = false;
    };
  }, [load, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}

/** Favoris de l'utilisateur connecté ; un visiteur est envoyé vers la connexion. */
export function useFavorites() {
  const { user } = useAuth();
  const router = useRouter();
  const uid = user?.uid;
  const load = useCallback(() => listFavoriteIds(uid ?? ""), [uid]);
  const { data } = useAsync(uid ? load : null);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const isFavorite = useCallback(
    (listingId: string) => overrides[listingId] ?? Boolean(data?.includes(listingId)),
    [overrides, data],
  );

  const toggle = useCallback(
    async (listingId: string) => {
      if (!uid) {
        router.push("/connexion");
        return;
      }
      const next = !isFavorite(listingId);
      setOverrides((current) => ({ ...current, [listingId]: next }));
      try {
        await setFavorite(uid, listingId, next);
      } catch (error) {
        console.error("Favori non enregistré :", error);
        setOverrides((current) => ({ ...current, [listingId]: !next }));
      }
    },
    [uid, isFavorite, router],
  );

  return { isFavorite, toggle };
}
