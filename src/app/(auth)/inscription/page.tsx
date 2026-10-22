"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataNotice } from "@/components/auth/DataNotice";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { TextField } from "@/components/ui/TextField";
import { errorMessage, ROLE_LABELS, signUp, type SignupRole } from "@/lib/users";
import {
  hasErrors,
  passwordStrength,
  validateEmail,
  validatePassword,
  validateRequired,
  type FieldErrors,
} from "@/lib/validation";
import illustration from "../../../../public/images/chien-chat.png";

type Field = "displayName" | "email" | "city" | "password" | "confirm" | "terms";

const roleChoices: { role: SignupRole; icon: string; description: string }[] = [
  { role: "proprietaire", icon: "home_app_logo", description: "Pour adopter ou veiller sur mon animal" },
  { role: "prestataire", icon: "medical_services", description: "Vétérinaire, toiletteur, promeneur…" },
  { role: "refuge", icon: "shield", description: "Association déclarée ou bénévole" },
];

const reassurance = [
  { icon: "verified_user", title: "Profils vérifiés", text: "Prestataires validés par l'équipe", style: "bg-primary-fixed/40 text-primary" },
  { icon: "favorite", title: "Gratuit & solidaire", text: "Aucun paiement en ligne", style: "bg-secondary-fixed/50 text-secondary" },
  { icon: "lock", title: "Carnet privé", text: "Vos données santé restent à vous", style: "bg-primary/10 text-primary" },
];

const strengthLabels = ["", "Faible", "Moyen", "Bon", "Sécurisé"];

export default function InscriptionPage() {
  const router = useRouter();
  const [role, setRole] = useState<SignupRole>("proprietaire");
  const [form, setForm] = useState({ displayName: "", email: "", city: "", password: "", confirm: "" });
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const strength = passwordStrength(form.password);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: FieldErrors<Field> = {
      displayName: validateRequired(form.displayName, "Le nom"),
      email: validateEmail(form.email),
      city: validateRequired(form.city, "La ville"),
      password: validatePassword(form.password),
      confirm: form.confirm !== form.password ? "Les mots de passe ne correspondent pas." : undefined,
      terms: terms ? undefined : "Vous devez accepter les conditions d'utilisation.",
    };
    setErrors(nextErrors);
    setFormError("");
    if (hasErrors(nextErrors)) return;

    setLoading(true);
    try {
      await signUp({
        role,
        displayName: form.displayName.trim(),
        email: form.email.trim(),
        city: form.city.trim(),
        password: form.password,
      });
      router.replace("/");
    } catch (error) {
      setFormError(errorMessage(error));
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-7xl mx-auto py-space-md lg:py-space-xl">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter lg:gap-gutter-md items-start">
        {/* Colonne gauche : présentation (masquée sur mobile) */}
        <div className="hidden lg:flex lg:col-span-6 flex-col justify-between space-y-space-lg lg:pr-space-md">
          <div className="flex flex-col space-y-space-md">
            <div className="inline-flex items-center gap-space-xs self-start px-space-md py-space-xs rounded-full bg-primary/10 text-primary font-label-md text-label-md">
              <Icon name="pets" className="text-base" />
              <span>COMMUNAUTÉ BIENVEILLANTE</span>
            </div>
            <h1 className="font-display-lg text-display-lg text-on-surface tracking-tight leading-tight">
              Construisons ensemble un avenir plus doux pour nos animaux.
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl">
              Rejoignez les propriétaires, professionnels et refuges engagés pour le bien-être et
              l&apos;adoption responsable.
            </p>
          </div>

          <div className="relative w-full rounded-2xl bg-surface-container-lowest p-space-sm shadow-sm overflow-hidden group">
            <div className="relative w-full h-80 rounded-xl overflow-hidden bg-surface-container">
              <Image
                src={illustration}
                alt="Illustration d'un chien et d'un chat endormis ensemble"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                priority
                sizes="600px"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-space-sm pt-space-xs">
            {reassurance.map((item) => (
              <div key={item.title} className="flex flex-col gap-space-xs p-space-md rounded-xl bg-surface-container-lowest shadow-sm">
                <div className={`w-9 h-9 rounded-full ${item.style} flex items-center justify-center`}>
                  <Icon name={item.icon} filled className="text-xl" />
                </div>
                <span className="font-label-lg text-label-lg text-on-surface mt-space-xs">{item.title}</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Colonne droite : formulaire */}
        <div className="lg:col-span-6 w-full">
          <div className="bg-surface-container-lowest rounded-2xl shadow-xl p-space-md sm:p-space-xl flex flex-col space-y-space-lg">
            <div className="flex flex-col space-y-space-xs">
              <Link href="/" className="flex items-center gap-space-xs text-primary w-fit">
                <Icon name="pets" filled className="text-2xl" />
                <span className="font-headline-sm text-headline-sm tracking-tight text-on-surface">
                  PetCare <span className="text-primary font-bold">Community</span>
                </span>
              </Link>
              <h2 className="font-headline-lg text-headline-lg text-on-surface pt-space-xs">Créer un compte ✨</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Choisissez votre profil pour une expérience adaptée.
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="flex flex-col space-y-space-md">
              {formError && <Alert>{formError}</Alert>}

              <fieldset className="flex flex-col space-y-space-xs">
                <legend className="font-label-md text-label-md text-on-surface uppercase tracking-wider mb-space-xs">
                  Vous êtes :
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm">
                  {roleChoices.map((choice) => {
                    const selected = role === choice.role;
                    return (
                      <label
                        key={choice.role}
                        className={`cursor-pointer text-left p-space-md rounded-xl transition-all flex flex-col justify-between has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40 ${
                          selected ? "bg-surface-container-low ring-2 ring-primary" : "bg-surface hover:bg-surface-container-low"
                        }`}
                      >
                        <input
                          type="radio"
                          name="role"
                          value={choice.role}
                          checked={selected}
                          onChange={() => setRole(choice.role)}
                          className="sr-only"
                        />
                        <div className="flex items-start justify-between w-full">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              selected ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"
                            }`}
                          >
                            <Icon name={choice.icon} className="text-lg" />
                          </div>
                          {selected && <Icon name="check_circle" filled className="text-primary text-lg" />}
                        </div>
                        <div className="mt-space-md">
                          <p className="font-label-lg text-label-lg text-on-surface">{ROLE_LABELS[choice.role]}</p>
                          <p className="font-body-sm text-body-sm text-on-surface-variant leading-tight mt-0.5">
                            {choice.description}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <TextField
                label={role === "proprietaire" ? "Nom complet" : "Nom de la structure"}
                icon={role === "proprietaire" ? "person" : "storefront"}
                autoComplete={role === "proprietaire" ? "name" : "organization"}
                placeholder={role === "proprietaire" ? "ex. Lina Martin" : "ex. Refuge Les Amis"}
                value={form.displayName}
                onChange={(e) => update("displayName", e.target.value)}
                error={errors.displayName}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
                <TextField
                  label="Adresse email"
                  icon="mail"
                  type="email"
                  autoComplete="email"
                  placeholder="lina@exemple.fr"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  error={errors.email}
                />
                <TextField
                  label="Ville"
                  icon="location_on"
                  autoComplete="address-level2"
                  placeholder="ex. Tunis"
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                  error={errors.city}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <TextField
                  label="Mot de passe"
                  icon="lock"
                  type="password"
                  autoComplete="new-password"
                  placeholder="8 caractères minimum"
                  hint={
                    strength > 0 && (
                      <span className={`flex items-center gap-1 ${strength >= 3 ? "text-primary" : "text-amber-700"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${strength >= 3 ? "bg-primary" : "bg-amber-500"}`} />
                        {strengthLabels[strength]}
                      </span>
                    )
                  }
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  error={errors.password}
                />
                <div className="grid grid-cols-4 gap-1.5" aria-hidden>
                  {[1, 2, 3, 4].map((level) => (
                    <div key={level} className={`h-1 rounded-full ${strength >= level ? "bg-primary" : "bg-primary/20"}`} />
                  ))}
                </div>
              </div>

              <TextField
                label="Confirmer le mot de passe"
                icon={errors.confirm ? "lock_reset" : "lock"}
                type="password"
                autoComplete="new-password"
                hint={errors.confirm && <span className="text-error">Incohérence détectée</span>}
                value={form.confirm}
                onChange={(e) => update("confirm", e.target.value)}
                error={errors.confirm}
              />

              <div className="pt-space-xs">
                <label className="flex items-start gap-space-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={terms}
                    onChange={(e) => setTerms(e.target.checked)}
                    className="mt-1 w-5 h-5 rounded accent-primary cursor-pointer shrink-0"
                  />
                  <span className="font-body-md text-body-md text-on-surface-variant leading-snug">
                    J&apos;accepte les <span className="text-primary font-label-md">Conditions Générales d&apos;Utilisation</span> et
                    la <span className="text-primary font-label-md">Charte éthique</span> pour la protection animale.
                  </span>
                </label>
                {errors.terms && (
                  <p className="flex items-center gap-1 font-body-sm text-body-sm text-error mt-1">
                    <Icon name="warning" className="text-[16px]" />
                    {errors.terms}
                  </p>
                )}
              </div>

              <Button type="submit" loading={loading} icon="arrow_forward" className="w-full h-12 rounded-xl shadow-md mt-space-sm">
                Créer mon compte
              </Button>

              <p className="text-center pt-space-xs font-body-md text-body-md text-on-surface-variant">
                Vous avez déjà un compte ?{" "}
                <Link href="/connexion" className="font-label-lg text-label-lg text-primary hover:underline ml-1">
                  Se connecter
                </Link>
              </p>
            </form>

            <DataNotice />
          </div>
        </div>
      </div>
    </div>
  );
}
