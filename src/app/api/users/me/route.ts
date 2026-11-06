// Profil de l'utilisateur connecté (remplace la section `users` de firestore.rules).
import { BIO_MAX_LENGTH, DEFAULT_NOTIFICATION_PREFS, SIGNUP_ROLES, type NotificationPrefs } from "@/lib/models";
import { badRequest, handle, HttpError, notFound, readJson, requireUser } from "@/lib/server/http";
import { toProfile, users, type UserDoc } from "@/lib/server/mongo";
import { validatePhone } from "@/lib/validation";

const NAME_MAX = 80;
const CITY_MAX = 80;

function text(value: unknown, label: string, { required = false, max = 200 } = {}): string {
  if (typeof value !== "string") throw badRequest(`${label} : valeur invalide.`);
  const trimmed = value.trim();
  if (required && !trimmed) throw badRequest(`${label} est obligatoire.`);
  if (trimmed.length > max) throw badRequest(`${label} : ${max} caractères maximum.`);
  return trimmed;
}

const PREF_KEYS = Object.keys(DEFAULT_NOTIFICATION_PREFS) as (keyof NotificationPrefs)[];

function prefs(value: unknown): NotificationPrefs {
  if (!value || typeof value !== "object") throw badRequest("Préférences invalides.");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !PREF_KEYS.includes(key as keyof NotificationPrefs))) {
    throw badRequest("Préférences invalides.");
  }
  return Object.fromEntries(
    PREF_KEYS.map((key) => {
      const v = input[key] ?? DEFAULT_NOTIFICATION_PREFS[key];
      if (typeof v !== "boolean") throw badRequest("Préférences invalides.");
      return [key, v];
    }),
  ) as NotificationPrefs;
}

/** Lire son profil : `null` s'il n'est pas encore créé (juste après la création du compte Firebase). */
export async function GET(request: Request) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const profile = await (await users()).findOne({ _id: uid });
    return Response.json(profile ? toProfile(profile) : null);
  });
}

/** Créer son profil à l'inscription ; l'e-mail vient du compte Firebase, jamais du formulaire. */
export async function POST(request: Request) {
  return handle(async () => {
    const { uid, email } = await requireUser(request);
    if (!email) throw badRequest("Le compte n'a pas d'adresse e-mail.");
    const body = await readJson(request);
    const role = body.role;
    if (!SIGNUP_ROLES.includes(role as (typeof SIGNUP_ROLES)[number])) throw badRequest("Rôle invalide.");

    const now = new Date();
    const profile: UserDoc = {
      _id: uid,
      email,
      displayName: text(body.displayName, "Le nom", { required: true, max: NAME_MAX }),
      city: text(body.city, "La ville", { required: true, max: CITY_MAX }),
      role: role as UserDoc["role"],
      phone: "",
      bio: "",
      notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await (await users()).insertOne(profile);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) throw new HttpError(409, "Ce profil existe déjà.");
      throw error;
    }
    return Response.json(toProfile(profile), { status: 201 });
  });
}

/** Modifier son profil : le rôle, l'e-mail et l'uid ne changent jamais. */
export async function PATCH(request: Request) {
  return handle(async () => {
    const { uid } = await requireUser(request);
    const body = await readJson(request);
    const changes: Partial<UserDoc> = {};

    for (const [key, value] of Object.entries(body)) {
      switch (key) {
        case "displayName":
          changes.displayName = text(value, "Le nom", { required: true, max: NAME_MAX });
          break;
        case "city":
          changes.city = text(value, "La ville", { required: true, max: CITY_MAX });
          break;
        case "phone": {
          const phone = text(value, "Le téléphone", { max: 20 });
          const invalid = validatePhone(phone);
          if (invalid) throw badRequest(invalid);
          changes.phone = phone;
          break;
        }
        case "bio":
          changes.bio = text(value, "La biographie", { max: BIO_MAX_LENGTH });
          break;
        case "notificationPrefs":
          changes.notificationPrefs = prefs(value);
          break;
        case "passwordChanged":
          if (value !== true) throw badRequest("Requête invalide.");
          changes.passwordChangedAt = new Date();
          break;
        default:
          throw badRequest(`Le champ « ${key} » ne peut pas être modifié.`);
      }
    }

    const updated = await (await users()).findOneAndUpdate(
      { _id: uid },
      { $set: { ...changes, updatedAt: new Date() } },
      { returnDocument: "after" },
    );
    if (!updated) throw notFound();
    return Response.json(toProfile(updated));
  });
}
