"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataNotice } from "@/components/auth/DataNotice";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { TextField } from "@/components/ui/TextField";
import { errorMessage, signIn } from "@/lib/users";
import { hasErrors, validateEmail, validateRequired, type FieldErrors } from "@/lib/validation";
import illustration from "../../../../public/images/chien-chat.png";

type Field = "email" | "password";

const reassurance = [
  { icon: "verified", title: "Refuges vérifiés", text: "Charte éthique", color: "text-primary", bg: "bg-primary/10" },
  { icon: "favorite", title: "Adoptions fiables", text: "Suivi personnalisé", color: "text-secondary", bg: "bg-secondary/10" },
  { icon: "medical_services", title: "Entraide véto", text: "Conseils solidaires", color: "text-primary-container", bg: "bg-primary-container/10" },
];

export default function ConnexionPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: FieldErrors<Field> = {
      email: validateEmail(email),
      password: validateRequired(password, "Le mot de passe"),
    };
    setErrors(nextErrors);
    setFormError("");
    if (hasErrors(nextErrors)) return;

    setLoading(true);
    try {
      await signIn(email.trim(), password, remember);
      router.replace("/");
    } catch (error) {
      setFormError(errorMessage(error));
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-7xl mx-auto py-space-md lg:py-space-xl">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-md items-stretch lg:min-h-[720px]">
        {/* Panneau narratif (masqué sur mobile) */}
        <section className="hidden lg:flex lg:col-span-7 flex-col justify-between p-space-2xl rounded-2xl bg-surface-container-low shadow-sm relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-primary-fixed/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-secondary-fixed/40 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col gap-space-sm">
            <div className="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-surface-container-lowest/80 backdrop-blur-md shadow-sm w-fit">
              <Icon name="pets" filled className="text-primary text-body-md" />
              <span className="font-label-md text-label-md text-primary tracking-wide">COMMUNAUTÉ BIENVEILLANTE</span>
            </div>
            <h1 className="font-display-lg text-display-lg text-on-surface tracking-tight max-w-xl">
              Ensemble pour le{" "}
              <span className="text-primary underline decoration-secondary-container decoration-wavy decoration-2 underline-offset-8">
                bien-être animal
              </span>
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-lg mt-space-xs">
              Rejoignez une communauté solidaire d&apos;adoptants, de familles d&apos;accueil et de
              professionnels engagés au quotidien.
            </p>
          </div>

          <div className="relative z-10 my-space-lg flex justify-center items-center">
            <div className="relative w-full max-w-md aspect-[4/3] rounded-2xl overflow-hidden shadow-md bg-surface-container-lowest">
              <Image
                src={illustration}
                alt="Illustration d'un chien et d'un chat endormis ensemble"
                className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                priority
                sizes="448px"
              />
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-space-sm pt-space-md">
            {reassurance.map((item) => (
              <div key={item.title} className="flex items-center gap-space-sm p-space-sm rounded-xl bg-surface-container-lowest/90 shadow-sm">
                <div className={`w-10 h-10 rounded-full ${item.bg} flex items-center justify-center shrink-0`}>
                  <Icon name={item.icon} filled className={item.color} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-label-lg text-label-lg text-on-surface truncate">{item.title}</span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant truncate">{item.text}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Carte de connexion */}
        <section className="lg:col-span-5 flex flex-col justify-center">
          <div className="w-full bg-surface-container-lowest rounded-2xl shadow-md p-space-lg lg:p-space-xl flex flex-col justify-between">
            <div>
              <div className="mb-space-lg">
                <Logo />
              </div>
              <div className="flex flex-col gap-space-xs mb-space-xl">
                <h2 className="font-headline-lg text-headline-lg text-on-surface">Bon retour parmi nous 👋</h2>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Connectez-vous pour suivre vos animaux, vos rendez-vous et vos démarches d&apos;adoption.
                </p>
              </div>

              <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-space-md">
                {formError && <Alert>{formError}</Alert>}
                <TextField
                  label="Adresse email"
                  icon="mail"
                  type="email"
                  autoComplete="email"
                  placeholder="exemple@email.fr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={errors.email}
                />
                <TextField
                  label="Mot de passe"
                  icon="lock"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  hint={
                    <Link
                      href="/mot-de-passe-oublie"
                      className="font-label-md text-label-md text-secondary hover:text-on-secondary-container hover:underline"
                    >
                      Mot de passe oublié ?
                    </Link>
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={errors.password}
                />
                <label className="flex items-center gap-space-sm cursor-pointer select-none mt-space-xs w-fit">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="w-4 h-4 rounded accent-primary cursor-pointer"
                  />
                  <span className="font-body-md text-body-md text-on-surface-variant">Se souvenir de moi</span>
                </label>
                <Button type="submit" loading={loading} icon="arrow_forward" className="mt-space-sm w-full">
                  Se connecter
                </Button>
              </form>

              <div className="relative my-space-lg flex items-center justify-center">
                <div className="w-full h-0.5 bg-surface-container" />
                <span className="absolute px-space-md bg-surface-container-lowest font-body-sm text-body-sm text-outline uppercase tracking-wider">
                  ou
                </span>
              </div>

              <div className="flex flex-col gap-space-sm text-center">
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Pas encore de compte ?{" "}
                  <Link href="/inscription" className="font-label-lg text-label-lg text-primary hover:text-primary-container hover:underline">
                    S&apos;inscrire gratuitement
                  </Link>
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center justify-center gap-1.5 py-space-xs px-space-md rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-container-low transition-all font-label-md text-label-md w-fit mx-auto mt-space-xs"
                >
                  <Icon name="explore" className="text-[18px]" />
                  <span>Continuer en visiteur</span>
                </Link>
              </div>
            </div>

            <div className="pt-space-lg mt-space-lg">
              <DataNotice />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
