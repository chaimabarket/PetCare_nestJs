import { auth } from "./firebase";

/** Erreur renvoyée par une route `/api/...` (message déjà rédigé pour l'utilisateur). */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Message par champ de formulaire, quand le serveur a refusé certaines valeurs. */
    public fieldErrors: Partial<Record<string, string>> = {},
  ) {
    super(message);
  }
}

type ApiOptions = {
  method?: string;
  body?: unknown;
  /** Route accessible aux visiteurs : le jeton n'est envoyé que si l'utilisateur est connecté. */
  public?: boolean;
};

/** Appelle l'API de l'application au nom de l'utilisateur Firebase connecté. */
export async function api<T = void>(path: string, init: ApiOptions = {}): Promise<T> {
  // Au chargement d'une page, Firebase restaure la session de façon asynchrone :
  // on l'attend pour ne pas traiter un utilisateur connecté comme un visiteur.
  await auth().authStateReady();
  const user = auth().currentUser;
  if (!user && !init.public) throw new ApiError(401, "Vous devez être connecté.");
  const token = user ? await user.getIdToken() : null;

  const response = await fetch(path, {
    method: init.method ?? "GET",
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(init.body !== undefined && { "Content-Type": "application/json" }),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as
      | { error?: string; fieldErrors?: Partial<Record<string, string>> }
      | null;
    throw new ApiError(response.status, data?.error ?? "Une erreur est survenue. Réessayez.", data?.fieldErrors ?? {});
  }
  const text = await response.text(); // réponse vide (204, 201 sans contenu) → undefined
  return (text ? JSON.parse(text) : undefined) as T;
}
