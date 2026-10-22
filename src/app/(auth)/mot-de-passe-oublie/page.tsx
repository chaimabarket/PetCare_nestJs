"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { TextField } from "@/components/ui/TextField";
import { errorMessage, resetPassword } from "@/lib/users";
import { validateEmail } from "@/lib/validation";
import illustration from "../../../../public/images/chien-chat.png";

const RESEND_DELAY = 60;

/** m***e@domaine.fr */
function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain || name.length < 2) return email;
  return `${name[0]}***${name[name.length - 1]}@${domain}`;
}

export default function MotDePasseOubliePage() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [formError, setFormError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  async function send() {
    setLoading(true);
    setFormError("");
    try {
      await resetPassword(email.trim());
      setSent(true);
      setCountdown(RESEND_DELAY);
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const error = validateEmail(email);
    setEmailError(error);
    if (!error) await send();
  }

  return (
    <div className="relative w-full max-w-xl">
      <div className="absolute -top-12 -left-12 w-48 h-48 bg-primary-fixed/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-secondary-fixed/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full bg-surface-container-lowest rounded-2xl p-6 sm:p-8 md:p-10 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between gap-2 pb-6">
          <Link
            href="/connexion"
            className="group inline-flex items-center gap-1.5 text-on-surface-variant hover:text-primary transition-colors font-label-md text-label-md"
          >
            <Icon name="arrow_back" className="text-[18px] transition-transform group-hover:-translate-x-1" />
            <span>Retour à la connexion</span>
          </Link>
          <div className="inline-flex items-center gap-1.5 bg-surface-container-low px-3 py-1 rounded-full text-primary font-label-sm text-label-sm">
            <Icon name="verified_user" className="text-[14px]" />
            <span>Sécurité du compte</span>
          </div>
        </div>

        <div className="relative w-full h-32 sm:h-36 mb-6 rounded-xl overflow-hidden bg-surface-container-low flex items-center justify-center">
          <Image src={illustration} alt="" className="w-full h-full object-cover object-center" priority sizes="576px" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/90 via-surface-container-lowest/30 to-transparent" />
          <div className="absolute -bottom-2 bg-surface-container-lowest p-1.5 rounded-full shadow-md">
            <div className="w-11 h-11 rounded-full bg-primary-fixed flex items-center justify-center text-primary">
              <Icon name="lock_reset" className="text-[24px]" />
            </div>
          </div>
        </div>

        <div className="text-center pt-2 mb-8">
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Mot de passe oublié ?</h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-md mx-auto">
            Pas d&apos;inquiétude ! Indiquez l&apos;adresse email associée à votre compte PetCare
            Community. Nous vous enverrons un lien sécurisé pour créer un nouveau mot de passe.
          </p>
        </div>

        {sent ? (
          <div className="space-y-5">
            <div className="bg-surface-container-low rounded-xl p-5 shadow-sm">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-full bg-primary-fixed-dim/40 flex items-center justify-center shrink-0 text-primary">
                  <Icon name="mark_email_read" className="text-[22px]" />
                </div>
                <div className="flex-1 min-w-0" role="status">
                  <h2 className="font-headline-sm text-headline-sm text-primary">Un e-mail vous a été envoyé</h2>
                  <p className="font-body-md text-body-md text-on-surface mt-1">
                    Si un compte existe pour{" "}
                    <span className="font-label-lg text-label-lg text-primary">{maskEmail(email.trim())}</span>, vous
                    recevrez un lien de réinitialisation dans quelques minutes.
                  </p>
                  <div className="mt-3 bg-surface-container-lowest/80 rounded-lg p-3 space-y-1.5 font-body-sm text-body-sm text-on-surface-variant">
                    <p className="flex items-center gap-1.5">
                      <Icon name="schedule" className="text-[16px] text-primary" />
                      Le lien n&apos;est valable que pendant une durée limitée.
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Icon name="folder_special" className="text-[16px] text-secondary" />
                      Pensez à vérifier vos courriers indésirables (spams).
                    </p>
                  </div>
                </div>
              </div>
            </div>
            {formError && <Alert>{formError}</Alert>}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={send}
                disabled={countdown > 0 || loading}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 h-9 rounded-full bg-surface-container text-primary font-label-md text-label-md transition-colors hover:bg-surface-container-high disabled:text-outline disabled:cursor-not-allowed"
              >
                <Icon name="refresh" className={`text-[16px] ${loading ? "animate-spin" : ""}`} />
                <span>{countdown > 0 ? `Renvoyer l'e-mail (dans ${countdown}s)` : "Renvoyer l'e-mail"}</span>
              </button>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1 text-primary hover:text-primary-container font-label-md text-label-md py-1 px-3 transition-colors"
              >
                <Icon name="edit" className="text-[16px]" />
                <span>Modifier l&apos;adresse</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {formError && <Alert>{formError}</Alert>}
            <TextField
              label="Adresse email"
              icon="mail"
              type="email"
              autoComplete="email"
              placeholder="ex : marie.durand@domaine.fr"
              help="Un lien à usage unique vous sera envoyé par e-mail."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={emailError}
            />
            <Button type="submit" loading={loading} icon="arrow_forward" className="w-full shadow-md">
              Envoyer le lien de réinitialisation
            </Button>
          </form>
        )}

        <div className="text-center mt-6">
          <p className="font-body-md text-body-md text-on-surface-variant">
            Vous vous souvenez de votre mot de passe ?
            <Link href="/connexion" className="text-secondary font-label-lg text-label-lg hover:underline ml-1">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
