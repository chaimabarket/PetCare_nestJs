export type FieldErrors<K extends string> = Partial<Record<K, string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | undefined {
  if (!email.trim()) return "L'adresse e-mail est obligatoire.";
  if (!emailPattern.test(email.trim())) return "L'adresse e-mail n'est pas valide.";
}

export function validatePassword(password: string): string | undefined {
  if (!password) return "Le mot de passe est obligatoire.";
  if (password.length < 8) return "Le mot de passe doit contenir au moins 8 caractères.";
}

export function validateRequired(value: string, label: string): string | undefined {
  if (!value.trim()) return `${label} est obligatoire.`;
}

/** Score de 0 à 4 pour la jauge de force du mot de passe. */
export function passwordStrength(password: string): number {
  if (!password) return 0;
  let score = password.length >= 8 ? 1 : 0;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password) || password.length >= 12) score++;
  return score;
}

const phonePattern = /^\+?[\d\s.-]{8,20}$/;

export function validatePhone(phone: string): string | undefined {
  if (phone.trim() && !phonePattern.test(phone.trim())) return "Le numéro de téléphone n'est pas valide.";
}

export function hasErrors<K extends string>(errors: FieldErrors<K>): boolean {
  return Object.values(errors).some(Boolean);
}
