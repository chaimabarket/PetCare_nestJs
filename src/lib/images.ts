/**
 * Photos stockées directement dans Firestore (pas de Firebase Storage dans le projet) :
 * elles sont redimensionnées et compressées en JPEG dans le navigateur.
 * Un document Firestore est limité à 1 Mio.
 */

export const LISTING_PHOTO_SIZE = 800;
export const THUMBNAIL_SIZE = 240;
export const STORY_PHOTO_SIZE = 900;

/** Taille maximale cumulée des photos d'un document (marge sous la limite de 1 Mio). */
export const MAX_PHOTOS_BYTES = 800_000;

export async function compressImage(file: Blob, maxSize: number, quality = 0.72): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Le fichier choisi n'est pas une image.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Impossible de traiter l'image dans ce navigateur.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}

/** Miniature d'une photo déjà compressée. */
export async function thumbnailFrom(dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  return compressImage(blob, THUMBNAIL_SIZE, 0.7);
}

export function dataUrlBytes(dataUrls: string[]): number {
  return dataUrls.reduce((sum, url) => sum + url.length, 0);
}
