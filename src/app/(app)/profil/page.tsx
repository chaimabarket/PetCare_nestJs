"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Timestamp } from "firebase/firestore";
import { useAuth } from "@/components/auth/AuthProvider";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PreferenceToggles } from "@/components/notifications/PreferenceToggles";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { TextArea, TextField } from "@/components/ui/TextField";
import { timeAgo } from "@/lib/dates";
import { PREF_OPTIONS } from "@/lib/notification-prefs";
import {
  BIO_MAX_LENGTH,
  changePassword,
  errorMessage,
  logOut,
  resolvePrefs,
  ROLE_LABELS,
  updateNotificationPrefs,
  updateUserProfile,
  type EditableProfile,
  type UserProfile,
} from "@/lib/users";
import {
  hasErrors,
  validatePassword,
  validatePhone,
  validateRequired,
  type FieldErrors,
} from "@/lib/validation";

type Message = { tone: "error" | "success"; text: string };

// Pages des autres modules (à garder alignées avec leurs routes).
const accountLinks = [
  { href: "/communaute/mes-annonces", label: "Mes annonces", icon: "campaign", coral: false },
  { href: "/communaute/adoption/mes-candidatures", label: "Mes candidatures", icon: "assignment", coral: false },
  { href: "/communaute/adoption/favoris", label: "Mes favoris", icon: "favorite", coral: true },
  { href: "/notifications", label: "Centre de notifications", icon: "notifications_active", coral: false },
];

function monthYear(date?: Timestamp) {
  if (!date) return "—";
  const text = date.toDate().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function passwordChangedLabel(date?: Timestamp) {
  return date ? `Modifié ${timeAgo(date)}` : "Jamais modifié depuis l'inscription";
}

export default function ProfilPage() {
  return (
    <RequireAuth>
      <Profil />
    </RequireAuth>
  );
}

function Profil() {
  const router = useRouter();
  const { user, profile } = useAuth();
  // « /profil#mot-de-passe » (notification « Nouvelle connexion ») ouvre directement le formulaire.
  const [passwordOpen, setPasswordOpen] = useState(() => window.location.hash === "#mot-de-passe");
  const securityRef = useRef<HTMLDivElement>(null);

  // Liens « #preferences » et « #mot-de-passe » : la section n'existe qu'après le chargement du profil.
  // Lors d'une navigation interne, l'adresse (et son #) n'est à jour qu'à partir des effets.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash === "#mot-de-passe") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronisation avec l'adresse de la page
      setPasswordOpen(true);
    }
    if (hash === "#preferences" || hash === "#mot-de-passe") {
      securityRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [profile]);

  async function handleLogout() {
    if (!window.confirm("Voulez-vous vraiment vous déconnecter ?")) return;
    await logOut();
    router.replace("/connexion");
  }

  function openPassword() {
    setPasswordOpen(true);
    securityRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!profile) {
    return (
      <div className="max-w-xl mx-auto p-space-xl">
        <Alert>
          Votre profil est introuvable. Déconnectez-vous puis reconnectez-vous, ou contactez un administrateur.
        </Alert>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-7xl mx-auto px-margin md:px-margin-md lg:px-margin-lg py-space-xl">
      <div className="absolute -top-12 -left-16 w-96 h-96 bg-primary-container/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-20 w-80 h-80 bg-secondary-container/10 rounded-full blur-3xl pointer-events-none" />

      {/* Fil d'Ariane & titre */}
      <div className="relative flex flex-col gap-space-xs mb-space-xl">
        <div className="flex items-center gap-space-xs text-on-surface-variant font-label-sm text-label-sm">
          <Link href="/" className="hover:text-primary transition-colors">
            Accueil
          </Link>
          <Icon name="chevron_right" className="text-[14px]" />
          <span className="text-on-surface font-label-md text-label-md">Mon profil</span>
        </div>
        <div className="flex items-center gap-space-sm">
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Espace Membre</h1>
          <span className="px-space-sm py-0.5 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            Actif
          </span>
        </div>
      </div>

      <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
        {/* Colonne gauche : carte d'identité + menu */}
        <aside className="lg:col-span-4 flex flex-col gap-space-lg">
          <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-primary-container/10 to-transparent" />
            <div className="relative mt-space-sm mb-space-md">
              <Avatar
                name={profile.displayName}
                className="w-28 h-28 text-headline-lg shadow-md ring-4 ring-surface-container-lowest"
              />
            </div>
            <h2 className="font-headline-md text-headline-md text-on-surface">{profile.displayName}</h2>
            <span className="mt-space-xs mb-space-sm px-space-md py-0.5 rounded-full bg-primary-fixed/40 text-on-primary-fixed font-label-md text-label-md flex items-center gap-1 shadow-sm">
              <Icon name="pets" filled className="text-[16px] text-primary" />
              {ROLE_LABELS[profile.role]}
            </span>
            <p className="font-body-md text-body-md text-on-surface-variant flex items-center gap-1 mb-1">
              <Icon name="location_on" className="text-[18px] text-primary" />
              {profile.city}
            </p>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-lg">{user?.email}</p>

            <div className="w-full grid grid-cols-2 gap-space-sm bg-surface-container-low rounded-xl p-space-sm">
              <div className="flex flex-col items-center justify-center py-space-xs">
                <span className="font-headline-sm text-headline-sm text-primary">{ROLE_LABELS[profile.role]}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Type de compte</span>
              </div>
              <div className="flex flex-col items-center justify-center py-space-xs bg-surface-container-lowest/70 rounded-lg">
                <span className="font-headline-sm text-headline-sm text-secondary">{monthYear(profile.createdAt)}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Membre depuis</span>
              </div>
            </div>
          </div>

          <nav aria-label="Menu du compte" className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm flex flex-col gap-1.5">
            <div className="px-space-sm py-space-xs text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
              Gestion du compte
            </div>
            {accountLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between p-space-sm rounded-xl hover:bg-surface-container-low transition-colors group"
              >
                <div className="flex items-center gap-space-sm">
                  <div
                    className={`w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center transition-colors ${
                      link.coral
                        ? "text-secondary group-hover:bg-secondary-container group-hover:text-on-secondary-container"
                        : "text-primary group-hover:bg-primary-container group-hover:text-on-primary"
                    }`}
                  >
                    <Icon name={link.icon} filled={link.coral} className="text-[20px]" />
                  </div>
                  <span className="font-label-lg text-label-lg text-on-surface">{link.label}</span>
                </div>
                <Icon name="chevron_right" className="text-outline-variant text-[18px]" />
              </Link>
            ))}

            <div className="h-px bg-surface-container my-space-xs" />

            <button
              type="button"
              onClick={openPassword}
              className="w-full flex items-center justify-between p-space-sm rounded-xl hover:bg-surface-container-low transition-colors text-left group"
            >
              <div className="flex items-center gap-space-sm">
                <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant group-hover:text-primary transition-colors">
                  <Icon name="lock_reset" className="text-[20px]" />
                </div>
                <span className="font-label-lg text-label-lg text-on-surface">Changer le mot de passe</span>
              </div>
              <Icon name="chevron_right" className="text-outline-variant text-[18px]" />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center justify-between p-space-sm rounded-xl hover:bg-error-container/30 transition-colors text-left group"
            >
              <div className="flex items-center gap-space-sm">
                <div className="w-9 h-9 rounded-lg bg-error-container/40 text-error flex items-center justify-center group-hover:bg-error group-hover:text-on-error transition-colors">
                  <Icon name="logout" className="text-[20px]" />
                </div>
                <span className="font-label-lg text-label-lg text-error">Se déconnecter</span>
              </div>
              <Icon name="arrow_forward" className="text-error text-[18px]" />
            </button>
          </nav>
        </aside>

        {/* Colonne droite : formulaires */}
        <section className="lg:col-span-8 flex flex-col gap-space-lg">
          <PersonalInfoForm profile={profile} />
          <div ref={securityRef} id="preferences" className="scroll-mt-24">
            <PreferencesCard profile={profile} passwordOpen={passwordOpen} onPasswordOpenChange={setPasswordOpen} />
          </div>
        </section>
      </div>
    </div>
  );
}

function PersonalInfoForm({ profile }: { profile: UserProfile }) {
  const { refreshProfile } = useAuth();
  const initial: EditableProfile = {
    displayName: profile.displayName,
    city: profile.city,
    phone: profile.phone ?? "",
    bio: profile.bio ?? "",
  };
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors<keyof EditableProfile>>({});
  const [message, setMessage] = useState<Message>();
  const [loading, setLoading] = useState(false);
  const isPerson = profile.role === "proprietaire" || profile.role === "admin";

  function update(field: keyof EditableProfile, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function cancel() {
    setForm(initial);
    setErrors({});
    setEditing(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: FieldErrors<keyof EditableProfile> = {
      displayName: validateRequired(form.displayName, "Le nom"),
      city: validateRequired(form.city, "La ville"),
      phone: validatePhone(form.phone),
      bio: form.bio.length > BIO_MAX_LENGTH ? `${BIO_MAX_LENGTH} caractères maximum.` : undefined,
    };
    setErrors(nextErrors);
    setMessage(undefined);
    if (hasErrors(nextErrors)) return;

    setLoading(true);
    try {
      await updateUserProfile(profile.uid, {
        displayName: form.displayName.trim(),
        city: form.city.trim(),
        phone: form.phone.trim(),
        bio: form.bio.trim(),
      });
      await refreshProfile();
      setEditing(false);
      setMessage({ tone: "success", text: "Vos informations ont été enregistrées avec succès." });
    } catch (error) {
      setMessage({ tone: "error", text: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="bg-surface-container-lowest rounded-2xl p-space-lg md:p-space-xl shadow-sm flex flex-col gap-space-lg"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pb-space-sm">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">Informations personnelles</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
            Mettez à jour les coordonnées utilisées par la communauté.
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setMessage(undefined);
            }}
            className="inline-flex items-center justify-center gap-space-xs h-10 px-space-lg rounded-full bg-surface-container-low text-primary hover:bg-primary-container hover:text-on-primary font-label-md text-label-md transition-all self-start sm:self-auto"
          >
            <Icon name="edit" className="text-[18px]" />
            <span>Modifier</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
        <TextField
          label={isPerson ? "Nom complet" : "Nom de la structure"}
          hint="Requis"
          autoComplete={isPerson ? "name" : "organization"}
          value={form.displayName}
          onChange={(e) => update("displayName", e.target.value)}
          disabled={!editing}
          error={errors.displayName}
        />
        <TextField
          label="Adresse email"
          icon="mail"
          hint="Non modifiable"
          value={profile.email}
          disabled
        />
        <TextField
          label="Numéro de téléphone"
          icon="call"
          type="tel"
          autoComplete="tel"
          hint="Facultatif"
          placeholder="+216 12 345 678"
          value={form.phone}
          onChange={(e) => update("phone", e.target.value)}
          disabled={!editing}
          error={errors.phone}
        />
        <TextField
          label="Ville"
          icon="location_on"
          hint="Pour l'entraide locale"
          autoComplete="address-level2"
          value={form.city}
          onChange={(e) => update("city", e.target.value)}
          disabled={!editing}
          error={errors.city}
        />
        <TextArea
          className="md:col-span-2"
          label="Biographie / Présentation"
          hint={`${form.bio.length} / ${BIO_MAX_LENGTH} caractères`}
          rows={3}
          maxLength={BIO_MAX_LENGTH}
          placeholder="Présentez-vous en quelques mots…"
          value={form.bio}
          onChange={(e) => update("bio", e.target.value)}
          disabled={!editing}
          error={errors.bio}
        />
      </div>

      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      {editing && (
        <div className="flex flex-wrap items-center justify-end gap-space-sm pt-space-xs">
          <Button type="button" variant="ghost" onClick={cancel}>
            Annuler
          </Button>
          <Button type="submit" loading={loading} className="bg-primary-container hover:bg-primary">
            Enregistrer les modifications
          </Button>
        </div>
      )}
    </form>
  );
}

function PreferencesCard({
  profile,
  passwordOpen,
  onPasswordOpenChange,
}: {
  profile: UserProfile;
  passwordOpen: boolean;
  onPasswordOpenChange: (open: boolean) => void;
}) {
  const { refreshProfile } = useAuth();
  const saved = resolvePrefs(profile.notificationPrefs);
  const [prefs, setPrefs] = useState(saved);
  const [message, setMessage] = useState<Message>();
  const [loading, setLoading] = useState(false);
  const dirty = PREF_OPTIONS.some((option) => prefs[option.key] !== saved[option.key]);

  async function save() {
    setLoading(true);
    setMessage(undefined);
    try {
      await updateNotificationPrefs(profile.uid, prefs);
      await refreshProfile();
      setMessage({ tone: "success", text: "Vos préférences ont été enregistrées." });
    } catch (error) {
      setMessage({ tone: "error", text: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-surface-container-lowest rounded-2xl p-space-lg md:p-space-xl shadow-sm flex flex-col gap-space-lg">
      <div>
        <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">Préférences et sécurité</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
          Choisissez les alertes que vous recevez et gérez la sécurité de votre compte.
        </p>
      </div>

      <div className="flex flex-col gap-space-sm">
        <h3 className="font-label-lg text-label-lg text-on-surface">Canaux de communication</h3>
        <PreferenceToggles
          prefs={prefs}
          city={profile.city}
          onToggle={(key, value) => setPrefs((current) => ({ ...current, [key]: value }))}
        />
      </div>

      <div className="flex flex-col gap-space-md p-space-md bg-surface-container-low rounded-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-sm">
            <div className="w-10 h-10 rounded-full bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm">
              <Icon name="shield" className="text-[20px]" />
            </div>
            <div>
              <span className="font-label-md text-label-md text-on-surface">Mot de passe de connexion</span>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{passwordChangedLabel(profile.passwordChangedAt)}</p>
            </div>
          </div>
          {!passwordOpen && (
            <button
              type="button"
              onClick={() => onPasswordOpenChange(true)}
              className="h-9 px-space-md rounded-full bg-surface-container-lowest text-on-surface hover:text-primary hover:bg-surface-container font-label-sm text-label-sm transition-colors self-start sm:self-auto shadow-sm"
            >
              Mettre à jour
            </button>
          )}
        </div>
        {passwordOpen && <PasswordForm onDone={() => onPasswordOpenChange(false)} />}
      </div>

      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      <div className="flex items-center justify-end gap-space-sm pt-space-md border-t border-surface-container-low">
        <Button type="button" variant="ghost" onClick={() => setPrefs(saved)} disabled={!dirty || loading}>
          Annuler
        </Button>
        <Button type="button" onClick={save} loading={loading} disabled={!dirty} className="bg-primary-container hover:bg-primary">
          Enregistrer les préférences
        </Button>
      </div>
    </div>
  );
}

function PasswordForm({ onDone }: { onDone: () => void }) {
  const { refreshProfile } = useAuth();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [errors, setErrors] = useState<FieldErrors<"current" | "next" | "confirm">>({});
  const [message, setMessage] = useState<Message>();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = {
      current: validateRequired(form.current, "Le mot de passe actuel"),
      next: validatePassword(form.next),
      confirm: form.confirm !== form.next ? "Les mots de passe ne correspondent pas." : undefined,
    };
    setErrors(nextErrors);
    setMessage(undefined);
    if (hasErrors(nextErrors)) return;

    setLoading(true);
    try {
      await changePassword(form.current, form.next);
      await refreshProfile();
      setForm({ current: "", next: "", confirm: "" });
      setMessage({ tone: "success", text: "Votre mot de passe a été modifié." });
    } catch (error) {
      setMessage({ tone: "error", text: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-space-md pt-space-sm">
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <TextField
        label="Mot de passe actuel"
        icon="lock"
        type="password"
        autoComplete="current-password"
        value={form.current}
        onChange={(e) => setForm({ ...form, current: e.target.value })}
        error={errors.current}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
        <TextField
          label="Nouveau mot de passe"
          icon="lock"
          type="password"
          autoComplete="new-password"
          value={form.next}
          onChange={(e) => setForm({ ...form, next: e.target.value })}
          error={errors.next}
        />
        <TextField
          label="Confirmer"
          icon="lock"
          type="password"
          autoComplete="new-password"
          value={form.confirm}
          onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          error={errors.confirm}
        />
      </div>
      <div className="flex justify-end gap-space-sm">
        <Button type="button" variant="ghost" onClick={onDone}>
          Fermer
        </Button>
        <Button type="submit" loading={loading}>
          Mettre à jour le mot de passe
        </Button>
      </div>
    </form>
  );
}
