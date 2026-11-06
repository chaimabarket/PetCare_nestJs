import "server-only";
import mongoose from "mongoose";

/**
 * Connexion MongoDB (module Carnet de santé). Les identifiants viennent de .env.local :
 *   MONGODB_URI=mongodb://127.0.0.1:27017   (ou l'URI MongoDB Atlas)
 *   MONGODB_DB=petcare
 * La connexion est gardée dans globalThis pour être réutilisée entre les requêtes
 * et les rechargements à chaud de `next dev`.
 */
const cache = globalThis as typeof globalThis & { mongooseConnection?: Promise<typeof mongoose> };

export class DatabaseConfigError extends Error {}

export function connectMongo(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return Promise.reject(new DatabaseConfigError("MONGODB_URI n'est pas défini : remplissez .env.local (voir .env.local.example)."));
  }
  if (!cache.mongooseConnection) {
    cache.mongooseConnection = mongoose
      .connect(uri, { dbName: process.env.MONGODB_DB || "petcare", serverSelectionTimeoutMS: 8000 })
      .catch((error) => {
        // Nouvelle tentative à la prochaine requête (MongoDB démarré entre-temps, par exemple).
        cache.mongooseConnection = undefined;
        throw error;
      });
  }
  return cache.mongooseConnection;
}
