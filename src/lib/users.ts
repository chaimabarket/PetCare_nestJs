import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { ApiError, api } from "./api";
import { auth } from "./firebase";
import {
  DEFAULT_NOTIFICATION_PREFS,
  type EditableProfile,
  type NotificationPrefs,
  type SignupRole,
  type UserProfile,
  type UserRole,
} from "./models";
import { sendNotification } from "./notifications";

// Firebase ne sert plus qu'à l'authentification (comptes, mots de passe, sessions).
// Les profils sont stockés dans MongoDB et lus / modifiés via les routes /api/users/*.

// Types et constantes partagés avec les routes API (lib/models.ts), réexportés pour les modules.
export {
  BIO_MAX_LENGTH,
  DEFAULT_NOTIFICATION_PREFS,
  SIGNUP_ROLES,
  type EditableProfile,
  type NotificationPrefs,
  type SignupRole,
  type UserProfile,
  type UserRole,
} from "./models";

export const ROLE_LABELS: Record<UserRole, string> = {
  proprietaire: "Propriétaire",
  prestataire: "Prestataire",
  refuge: "Refuge",
  admin: "Administrateur",
};

/** Complète les préférences enregistrées avant l'ajout de nouvelles catégories. */
export function resolvePrefs(prefs?: Partial<NotificationPrefs>): NotificationPrefs {
  return { ...DEFAULT_NOTIFICATION_PREFS, ...prefs };
}

/** Événement navigateur : le profil a changé, <AuthProvider> le recharge. */
export const PROFILE_CHANGED_EVENT = "petcare:profile-changed";

export async function signUp(input: {
  email: string;
  password: string;
  displayName: string;
  city: string;
  role: SignupRole;
}): Promise<void> {
  const { user } = await createUserWithEmailAndPassword(auth(), input.email, input.password);
  await updateProfile(user, { displayName: input.displayName });
  // Profil enregistré dans MongoDB (l'e-mail est repris du compte Firebase côté serveur).
  await api("/api/users/me", {
    method: "POST",
    body: { displayName: input.displayName, city: input.city, role: input.role },
  });
  window.dispatchEvent(new Event(PROFILE_CHANGED_EVENT));
  await sendNotification({
    userId: user.uid,
    type: "compte",
    title: `Bienvenue sur PetCare Community, ${input.displayName} !`,
    body: "Votre compte est prêt. Complétez votre profil pour profiter de l'entraide locale.",
    link: "/profil",
    actionLabel: "Compléter mon profil",
  }).catch((error) => console.error("Notification de bienvenue non envoyée :", error));
}

/** `remember` = rester connecté après fermeture du navigateur. */
export async function signIn(email: string, password: string, remember: boolean): Promise<void> {
  await setPersistence(auth(), remember ? browserLocalPersistence : browserSessionPersistence);
  await signInWithEmailAndPassword(auth(), email, password);
}

export async function logOut(): Promise<void> {
  await signOut(auth());
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth(), email);
}

/** Profil de l'utilisateur connecté (null s'il n'a pas encore de profil). */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const profile = await api<UserProfile | null>("/api/users/me");
  return profile?.uid === uid ? profile : null;
}

function assertCurrentUser(uid: string) {
  if (auth().currentUser?.uid !== uid) throw new ApiError(403, "Vous ne pouvez modifier que votre propre profil.");
}

export async function updateUserProfile(uid: string, changes: EditableProfile): Promise<void> {
  assertCurrentUser(uid);
  await api("/api/users/me", { method: "PATCH", body: changes });
  const user = auth().currentUser;
  if (user) await updateProfile(user, { displayName: changes.displayName.trim() });
}

export async function updateNotificationPrefs(uid: string, prefs: NotificationPrefs): Promise<void> {
  assertCurrentUser(uid);
  await api("/api/users/me", { method: "PATCH", body: { notificationPrefs: prefs } });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = auth().currentUser;
  if (!user?.email) throw new Error("Vous devez être connecté.");
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
  await updatePassword(user, newPassword);
  await api("/api/users/me", { method: "PATCH", body: { passwordChanged: true } });
}

const firebaseMessages: Record<string, string> = {
  "auth/email-already-in-use": "Un compte existe déjà avec cette adresse e-mail.",
  "auth/invalid-email": "L'adresse e-mail n'est pas valide.",
  "auth/invalid-credential": "E-mail ou mot de passe incorrect.",
  "auth/wrong-password": "Mot de passe incorrect.",
  "auth/user-not-found": "E-mail ou mot de passe incorrect.",
  "auth/weak-password": "Le mot de passe doit contenir au moins 6 caractères.",
  "auth/too-many-requests": "Trop de tentatives. Réessayez dans quelques minutes.",
  "auth/network-request-failed": "Problème de connexion réseau. Vérifiez votre connexion internet.",
  "auth/requires-recent-login": "Pour des raisons de sécurité, reconnectez-vous puis réessayez.",
  "auth/invalid-api-key": "Configuration Firebase manquante (voir .env.local).",
};

/** Traduit une erreur Firebase ou de l'API en message clair pour l'utilisateur. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof FirebaseError) {
    return firebaseMessages[error.code] ?? "Une erreur est survenue. Réessayez.";
  }
  if (error instanceof TypeError) return "Problème de connexion réseau. Vérifiez votre connexion internet.";
  return error instanceof Error ? error.message : "Une erreur est survenue. Réessayez.";
}
