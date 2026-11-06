import { auth } from "./firebase";

/** Erreur renvoyée par une route `/api/...` (message déjà rédigé pour l'utilisateur). */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Appelle l'API de l'application au nom de l'utilisateur Firebase connecté. */
export async function api<T = void>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const user = auth().currentUser;
  if (!user) throw new ApiError(401, "Vous devez être connecté.");
  const token = await user.getIdToken();

  const response = await fetch(path, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body !== undefined && { "Content-Type": "application/json" }),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(response.status, data?.error ?? "Une erreur est survenue. Réessayez.");
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}
