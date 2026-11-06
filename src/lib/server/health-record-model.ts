import "server-only";
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_TYPES,
  NOTES_MAX_LENGTH,
  RECORD_TYPES,
  SHORT_TEXT_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  type HealthRecord,
} from "@/lib/health-records";

const attachmentSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  mimeType: { type: String, required: true, enum: ATTACHMENT_TYPES },
  size: { type: Number, required: true, min: 1, max: ATTACHMENT_MAX_BYTES },
  data: { type: Buffer, required: true },
});

/**
 * Collection `health_records` : un document par acte médical.
 * `ownerId` = uid Firebase du propriétaire ; `petId` = identifiant de l'animal (module Mes animaux).
 */
const healthRecordSchema = new Schema(
  {
    ownerId: { type: String, required: true },
    petId: { type: String, required: true, maxlength: 128 },
    petName: { type: String, default: "", trim: true, maxlength: 60 },
    type: { type: String, required: true, enum: RECORD_TYPES },
    title: { type: String, required: true, trim: true, maxlength: TITLE_MAX_LENGTH },
    date: { type: Date, required: true },
    veterinarian: { type: String, default: "", trim: true, maxlength: SHORT_TEXT_MAX_LENGTH },
    clinic: { type: String, default: "", trim: true, maxlength: SHORT_TEXT_MAX_LENGTH },
    notes: { type: String, default: "", trim: true, maxlength: NOTES_MAX_LENGTH },
    lotNumber: { type: String, default: "", trim: true, maxlength: SHORT_TEXT_MAX_LENGTH },
    nextDueDate: { type: Date, default: null },
    dosage: { type: String, default: "", trim: true, maxlength: SHORT_TEXT_MAX_LENGTH },
    endDate: { type: Date, default: null },
    attachments: { type: [attachmentSchema], default: [] },
  },
  { timestamps: true, collection: "health_records" },
);

// Carnet d'un animal, du plus récent au plus ancien.
healthRecordSchema.index({ ownerId: 1, petId: 1, date: -1 });

export type HealthRecordDoc = InferSchemaType<typeof healthRecordSchema> & { _id: mongoose.Types.ObjectId };

// En développement, le module peut être rechargé : on réutilise le modèle déjà compilé.
export const HealthRecordModel: Model<InferSchemaType<typeof healthRecordSchema>> =
  mongoose.models.HealthRecord ?? mongoose.model("HealthRecord", healthRecordSchema);

/** Champs lus pour l'affichage : le contenu des pièces jointes n'est chargé qu'au téléchargement. */
export const LIST_PROJECTION = { "attachments.data": 0 } as const;

const isoDay = (date: Date | null | undefined) => (date ? date.toISOString().slice(0, 10) : null);

/** Document MongoDB → objet JSON de l'API (sans ownerId ni contenu des pièces jointes). */
export function toHealthRecord(doc: HealthRecordDoc): HealthRecord {
  return {
    id: doc._id.toString(),
    petId: doc.petId,
    petName: doc.petName ?? "",
    type: doc.type as HealthRecord["type"],
    title: doc.title,
    date: isoDay(doc.date)!,
    veterinarian: doc.veterinarian ?? "",
    clinic: doc.clinic ?? "",
    notes: doc.notes ?? "",
    lotNumber: doc.lotNumber ?? "",
    nextDueDate: isoDay(doc.nextDueDate),
    dosage: doc.dosage ?? "",
    endDate: isoDay(doc.endDate),
    attachments: (doc.attachments ?? []).map((a) => ({
      id: (a as unknown as { _id: mongoose.Types.ObjectId })._id.toString(),
      name: a.name,
      mimeType: a.mimeType,
      size: a.size,
    })),
    createdAt: (doc.createdAt as Date).toISOString(),
    updatedAt: (doc.updatedAt as Date).toISOString(),
  };
}
