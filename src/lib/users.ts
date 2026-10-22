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
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, type Timestamp } from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { auth, db } from "./firebase";
import { sendNotification } from "./notifications";

export type UserRole = "proprietaire" | "prestataire" | "refuge" | "admin";

/** Rôles proposés à l'inscription (admin est attribué depuis la console Firebase). */
export const SIGNUP_ROLES = ["proprietaire", "prestataire", "refuge"] as const;
export type SignupRole = (typeof SIGNUP_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  proprietaire: "Propriétaire",
  prestataire: "Prestataire",
  refuge: "Refuge",
  admin: "Administrateur",
};

/** Préférences d'alerte (voir lib/notification-prefs.ts pour les libellés). */
export type NotificationPrefs = {
  appointments: boolean;
  careReminders: boolean;
  adoption: boolean;
  lostFoundAlerts: boolean;
  /** Pas encore géré : l'application n'envoie pas d'e-mails. */
  email: boolean;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  appointments: true,
  careReminders: true,
  adoption: true,
  lostFoundAlerts: true,
  email: false,
};

/** Complète les préférences enregistrées avant l'ajout de nouvelles catégories. */
export function resolvePrefs(prefs?: Partial<NotificationPrefs>): NotificationPrefs {
  return { ...DEFAULT_NOTIFICATION_PREFS, ...prefs };
}

export const BIO_MAX_LENGTH = 300;

/** Document Firestore `users/{uid}`, partagé par tous les modules. */
export type UserProfile = {
  uid: string;
  email: string;
  displayName: string;
  city: string;
  role: UserRole;
  phone?: string;
  bio?: string;
  notificationPrefs?: Partial<NotificationPrefs>;
  createdAt?: Timestamp;
  passwordChangedAt?: Timestamp;
};

export type EditableProfile = Pick<UserProfile, "displayName" | "city"> & { phone: string; bio: string };

const usersCollection = "users";

export async function signUp(input: {
  email: string;
  password: string;
  displayName: string;
  city: string;
  role: SignupRole;
}): Promise<void> {
  const { user } = await createUserWithEmailAndPassword(auth(), input.email, input.password);
  await updateProfile(user, { displayName: input.displayName });
  await setDoc(doc(db(), usersCollection, user.uid), {
    uid: user.uid,
    email: input.email,
    displayName: input.displayName,
    city: input.city,
    role: input.role,
    phone: "",
    bio: "",
    notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
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

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await getDoc(doc(db(), usersCollection, uid));
  return snapshot.exists() ? (snapshot.data() as UserProfile) : null;
}

export async function updateUserProfile(uid: string, changes: EditableProfile): Promise<void> {
  const user = auth().currentUser;
  if (user) await updateProfile(user, { displayName: changes.displayName });
  await updateDoc(doc(db(), usersCollection, uid), { ...changes, updatedAt: serverTimestamp() });
}

export async function updateNotificationPrefs(uid: string, prefs: NotificationPrefs): Promise<void> {
  await updateDoc(doc(db(), usersCollection, uid), { notificationPrefs: prefs, updatedAt: serverTimestamp() });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = auth().currentUser;
  if (!user?.email) throw new Error("Vous devez être connecté.");
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
  await updatePassword(user, newPassword);
  await updateDoc(doc(db(), usersCollection, user.uid), {
    passwordChangedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
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
  "permission-denied": "Vous n'avez pas l'autorisation d'effectuer cette action.",
};

/** Traduit une erreur Firebase en message clair pour l'utilisateur. */
export function errorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    return firebaseMessages[error.code] ?? "Une erreur est survenue. Réessayez.";
  }
  return error instanceof Error ? error.message : "Une erreur est survenue. Réessayez.";
}
