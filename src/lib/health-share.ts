// Partage sécurisé du carnet de santé : lien temporaire en lecture seule (et QR code), révocable.
// Fichier partagé navigateur / serveur, sans dépendance : types, durées, portées et filtrage des données.
import type { HealthRecord } from "./health-records";
import { isActiveTreatment, latestVaccines } from "./health-summary";

/**
 * Ce que montre le lien :
 * - `complet` : tout le carnet (comme l'export PDF) ;
 * - `urgence` : fiche d'urgence — allergies, traitements en cours, derniers vaccins, vétérinaire.
 */
export const SHARE_SCOPES = ["complet", "urgence"] as const;
export type ShareScope = (typeof SHARE_SCOPES)[number];

export const SHARE_SCOPE_INFO: Record<ShareScope, { label: string; description: string; icon: string }> = {
  complet: {
    label: "Carnet complet",
    description: "Profil, vaccins, visites, examens, allergies, traitements et notes. Pour un vétérinaire.",
    icon: "menu_book",
  },
  urgence: {
    label: "Fiche d'urgence",
    description: "Allergies, traitements en cours, derniers vaccins et vétérinaire. Pour un pet-sitter ou une urgence.",
    icon: "emergency",
  },
};

/** Durées proposées (en heures). */
export const SHARE_DURATIONS = [
  { hours: 24, label: "24 heures" },
  { hours: 24 * 7, label: "7 jours" },
  { hours: 24 * 30, label: "30 jours" },
] as const;
export const SHARE_DURATION_HOURS: number[] = SHARE_DURATIONS.map((d) => d.hours);

export const SHARE_LABEL_MAX_LENGTH = 60;
/** Liens actifs au plus par animal. */
export const SHARES_MAX_ACTIVE = 10;
/** Dernières consultations gardées dans le journal d'un lien. */
export const SHARE_ACCESS_LOG_MAX = 20;

/** Jeton du lien : 32 octets aléatoires en base64url (43 caractères). Seule son empreinte est stockée. */
export const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const shareUrl = (origin: string, token: string) => `${origin}/partage/${token}`;

export type ShareStatus = "active" | "expired" | "revoked";

export function shareStatus(share: { expiresAt: string; revokedAt: string | null }, now = new Date()): ShareStatus {
  if (share.revokedAt) return "revoked";
  return new Date(share.expiresAt).getTime() <= now.getTime() ? "expired" : "active";
}

/** Lien tel que le propriétaire le voit (jamais le jeton, qui n'est affiché qu'à la création). */
export type HealthShare = {
  id: string;
  petId: string;
  label: string;
  scope: ShareScope;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  accessCount: number;
  lastAccessAt: string | null;
  /** Dates des dernières consultations, de la plus récente à la plus ancienne. */
  accessLog: string[];
};

/** Réponse de la création : le jeton n'est renvoyé qu'une seule fois. */
export type CreatedShare = { share: HealthShare; token: string };

export type ShareInput = { label: string; scope: ShareScope; durationHours: number };

export function validateShareInput(raw: unknown): { value: ShareInput; error?: string } {
  const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const label = typeof data.label === "string" ? data.label.trim() : "";
  const scope = SHARE_SCOPES.includes(data.scope as ShareScope) ? (data.scope as ShareScope) : null;
  const durationHours = Number(data.durationHours);
  const value = { label, scope: scope ?? "urgence", durationHours };
  if (!scope) return { value, error: "Choisissez ce que le lien montre." };
  if (!SHARE_DURATION_HOURS.includes(durationHours)) return { value, error: "Durée de validité invalide." };
  if (label.length > SHARE_LABEL_MAX_LENGTH) return { value, error: `Nom du lien : ${SHARE_LABEL_MAX_LENGTH} caractères maximum.` };
  return { value };
}

// ---------------------------------------------------------------------------
// Données affichées par le lien public (GET /api/partage/{jeton})
// ---------------------------------------------------------------------------

/** Acte tel que le lien le montre : ni pièces jointes, ni identifiants internes autres que l'acte. */
export type SharedRecord = Pick<
  HealthRecord,
  "id" | "type" | "title" | "date" | "veterinarian" | "clinic" | "notes" | "lotNumber" | "nextDueDate" | "dosage" | "endDate" | "doseTimes" | "doseEveryDays"
>;

/**
 * Carnet partagé. Jamais l'e-mail, le téléphone ou le nom du propriétaire, ni les contacts de la fiche :
 * seules les coordonnées du vétérinaire référent sont montrées.
 */
export type SharedHealthBook = {
  scope: ShareScope;
  expiresAt: string;
  pet: {
    name: string;
    species: string;
    breed: string;
    sex: string;
    birthDate: string;
    sterilized: boolean;
    /** Carnet complet uniquement. */
    chipNumber: string;
    photo: string;
    archived: boolean;
  };
  vet: { name: string; clinic: string; address: string; phone: string };
  records: SharedRecord[];
};

const toShared = (r: HealthRecord): SharedRecord => ({
  id: r.id,
  type: r.type,
  title: r.title,
  date: r.date,
  veterinarian: r.veterinarian,
  clinic: r.clinic,
  notes: r.notes,
  lotNumber: r.lotNumber,
  nextDueDate: r.nextDueDate,
  dosage: r.dosage,
  endDate: r.endDate,
  doseTimes: r.doseTimes,
  doseEveryDays: r.doseEveryDays,
});

/**
 * Actes visibles selon la portée. Fiche d'urgence : allergies, traitements en cours et dernière injection de
 * chaque vaccin (sans les notes des vaccins). Carnet complet : tout, du plus récent au plus ancien.
 */
export function recordsForScope(records: HealthRecord[], scope: ShareScope, today: string): SharedRecord[] {
  const byDate = [...records].sort((a, b) => b.date.localeCompare(a.date));
  if (scope === "complet") return byDate.map(toShared);
  const vaccines = new Set(latestVaccines(byDate).map((r) => r.id));
  return byDate
    .filter((r) => r.type === "allergie" || isActiveTreatment(r, today) || vaccines.has(r.id))
    .map((r) => (r.type === "vaccin" ? { ...toShared(r), notes: "" } : toShared(r)));
}
