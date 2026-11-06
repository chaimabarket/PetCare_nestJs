"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, firebaseConfigured } from "@/lib/firebase";
import { getUserProfile, PROFILE_CHANGED_EVENT, type UserProfile } from "@/lib/users";

type AuthState = {
  /** Compte Firebase Authentication, null pour un visiteur. */
  user: User | null;
  /** Profil MongoDB `users` (rôle, ville…), lu via /api/users/me. */
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(firebaseConfigured);
  // Plusieurs lectures du profil peuvent se croiser (ex. à l'inscription : la connexion
  // déclenche une lecture avant que le profil soit créé) : seule la plus récente compte.
  const requestId = useRef(0);

  const loadProfile = useCallback(async (account: User | null) => {
    const id = ++requestId.current;
    let next: UserProfile | null = null;
    try {
      next = account ? await getUserProfile(account.uid) : null;
    } catch (error) {
      console.error("Lecture du profil impossible :", error);
    }
    if (id === requestId.current) setProfile(next);
  }, []);

  useEffect(() => {
    if (!firebaseConfigured) {
      console.error("Firebase n'est pas configuré : remplissez .env.local (voir .env.local.example).");
      return;
    }
    return onAuthStateChanged(auth(), async (account) => {
      setUser(account);
      await loadProfile(account);
      setLoading(false);
    });
  }, [loadProfile]);

  // Profil créé ou modifié ailleurs dans l'application (ex. fin de l'inscription).
  useEffect(() => {
    const reload = () => void loadProfile(auth().currentUser);
    window.addEventListener(PROFILE_CHANGED_EVENT, reload);
    return () => window.removeEventListener(PROFILE_CHANGED_EVENT, reload);
  }, [loadProfile]);

  const refreshProfile = useCallback(() => loadProfile(auth().currentUser), [loadProfile]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Utilisateur connecté et son profil, utilisable dans tous les modules. */
export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth doit être utilisé dans <AuthProvider>.");
  return context;
}
