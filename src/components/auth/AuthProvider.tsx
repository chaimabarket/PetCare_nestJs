"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, firebaseConfigured } from "@/lib/firebase";
import { getUserProfile, type UserProfile } from "@/lib/users";

type AuthState = {
  /** Compte Firebase Authentication, null pour un visiteur. */
  user: User | null;
  /** Document Firestore `users/{uid}` (rôle, ville…). */
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(firebaseConfigured);

  useEffect(() => {
    if (!firebaseConfigured) {
      console.error("Firebase n'est pas configuré : remplissez .env.local (voir .env.local.example).");
      return;
    }
    return onAuthStateChanged(auth(), async (firebaseUser) => {
      setUser(firebaseUser);
      try {
        setProfile(firebaseUser ? await getUserProfile(firebaseUser.uid) : null);
      } catch (error) {
        console.error("Lecture du profil impossible :", error);
        setProfile(null);
      }
      setLoading(false);
    });
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) setProfile(await getUserProfile(user.uid));
  }, [user]);

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
