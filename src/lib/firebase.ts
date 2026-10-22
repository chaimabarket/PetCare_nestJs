import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** Faux tant que .env.local n'est pas rempli. */
export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

// Initialisation paresseuse : getAuth() échoue sans clé API, on ne l'appelle
// donc que dans le navigateur (effets, gestionnaires d'événements).
function firebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export function auth(): Auth {
  return getAuth(firebaseApp());
}

export function db(): Firestore {
  return getFirestore(firebaseApp());
}
