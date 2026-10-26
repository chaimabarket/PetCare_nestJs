"use client";

import { useCallback, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AnswerCard, householdRows, housingRows, lifestyleRows, MotivationQuote } from "@/components/adoption/ApplicationParts";
import { useAsync } from "@/components/adoption/hooks";
import { ButtonLink, ChoiceCards, Chip, Counter, EmptyState, PageLoading, Photo } from "@/components/adoption/ui";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { TextArea, TextField } from "@/components/ui/TextField";
import { Toggle } from "@/components/ui/Toggle";
import {
  ADOPTION_ROUTES,
  CHILD_AGE_RANGES,
  getListing,
  getMyApplication,
  MAX_ALONE_HOURS,
  MOTIVATION_MAX_LENGTH,
  MOTIVATION_MIN_LENGTH,
  submitApplication,
  type AdoptionListing,
  type ApplicationAnswers,
  type HouseholdAnswers,
  type HousingAnswers,
  type LifestyleAnswers,
} from "@/lib/adoption";
import { errorMessage, type UserProfile } from "@/lib/users";

const STEPS = ["Logement", "Foyer", "Mode de vie", "Récapitulatif"];

export function ApplicationForm({ id }: { id: string }) {
  return (
    <RequireAuth>
      <Loader id={id} />
    </RequireAuth>
  );
}

function Loader({ id }: { id: string }) {
  const { user, profile } = useAuth();
  const uid = user?.uid ?? "";
  const load = useCallback(
    async () => ({ listing: await getListing(id), existing: await getMyApplication(id, uid) }),
    [id, uid],
  );
  const { data, error, loading } = useAsync(load);

  if (loading) return <PageLoading />;
  if (error || !profile) {
    return (
      <div className="max-w-xl mx-auto p-space-xl">
        <Alert>{error ?? "Votre profil est introuvable. Reconnectez-vous puis réessayez."}</Alert>
      </div>
    );
  }

  const listing = data?.listing;
  let blocked: { title: string; text: string } | null = null;
  if (!listing) blocked = { title: "Annonce introuvable", text: "Cette annonce a peut-être été retirée." };
  else if (listing.ownerId === uid) blocked = { title: "C'est votre annonce", text: "Vous ne pouvez pas candidater à votre propre annonce." };
  else if (data?.existing)
    blocked = { title: "Candidature déjà envoyée", text: `Vous avez déjà candidaté pour ${listing.name}. Suivez son avancement dans vos candidatures.` };
  else if (listing.status !== "disponible")
    blocked = { title: `${listing.name} n'est plus disponible`, text: "Les candidatures sont fermées pour cette annonce." };

  if (blocked || !listing) {
    return (
      <div className="max-w-xl mx-auto p-space-xl">
        <EmptyState
          icon="pets"
          title={blocked?.title ?? ""}
          text={blocked?.text ?? ""}
          action={
            <ButtonLink href={data?.existing ? ADOPTION_ROUTES.myApplications : ADOPTION_ROUTES.feed}>
              {data?.existing ? "Mes candidatures" : "Voir les animaux à adopter"}
            </ButtonLink>
          }
        />
      </div>
    );
  }

  return <Wizard listing={listing} profile={profile} />;
}

type Errors = Partial<Record<"city" | "adults" | "motivation", string>>;

function Wizard({ listing, profile }: { listing: AdoptionListing; profile: UserProfile }) {
  const [step, setStep] = useState(0);
  const [housing, setHousing] = useState<HousingAnswers>({
    type: "appartement",
    outdoor: false,
    tenure: "locataire",
    landlordOk: false,
    city: profile.city,
  });
  const [household, setHousehold] = useState<HouseholdAnswers>({
    adults: 1,
    children: 0,
    childAges: [],
    cats: 0,
    dogs: 0,
    others: 0,
    allergies: false,
  });
  const [lifestyle, setLifestyle] = useState<LifestyleAnswers>({
    aloneHours: 4,
    activity: "modere",
    experience: "un-peu",
    motivation: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  function validate(current: number): boolean {
    const next: Errors = {};
    if (current === 0 && !housing.city.trim()) next.city = "La ville est obligatoire.";
    if (current === 1 && household.adults < 1) next.adults = "Indiquez au moins un adulte.";
    if (current === 2) {
      const length = lifestyle.motivation.trim().length;
      if (length < MOTIVATION_MIN_LENGTH) next.motivation = `Écrivez au moins ${MOTIVATION_MIN_LENGTH} caractères.`;
      else if (length > MOTIVATION_MAX_LENGTH) next.motivation = `${MOTIVATION_MAX_LENGTH} caractères maximum.`;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function goNext() {
    if (!validate(step)) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  }

  async function send() {
    if (![0, 1, 2].every((s) => validate(s))) return;
    const answers: ApplicationAnswers = {
      housing: { ...housing, city: housing.city.trim(), landlordOk: housing.tenure === "locataire" && housing.landlordOk },
      household: { ...household, childAges: household.children ? household.childAges : [] },
      lifestyle: { ...lifestyle, motivation: lifestyle.motivation.trim() },
    };
    setSending(true);
    setSubmitError("");
    try {
      await submitApplication(listing, profile, answers);
      setSent(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setSubmitError(errorMessage(error));
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="max-w-[640px] mx-auto px-margin py-space-xl">
        <div className="bg-surface-container-lowest rounded-2xl p-space-xl shadow-sm flex flex-col items-center text-center gap-space-md">
          <div className="relative">
            <Photo src={listing.thumbnail} alt={listing.name} className="w-28 h-28 rounded-full ring-4 ring-secondary-fixed" />
            <span className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-[#E07A5F] text-white flex items-center justify-center shadow-md">
              <Icon name="favorite" filled className="text-[22px]" />
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg">Candidature envoyée !</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-md">
            {listing.ownerName} va l&apos;étudier, vous serez notifié(e) de sa réponse.
          </p>
          <ButtonLink href={ADOPTION_ROUTES.myApplications} icon="timeline">
            Suivre ma candidature
          </ButtonLink>
        </div>
      </div>
    );
  }

  const answers: ApplicationAnswers = { housing, household, lifestyle };

  return (
    <div className="max-w-[640px] mx-auto px-margin py-space-lg flex flex-col gap-space-lg">
      {/* En-tête & progression */}
      <div className="flex items-center gap-space-sm">
        <Photo src={listing.thumbnail} alt={listing.name} className="w-12 h-12 rounded-full" />
        <div>
          <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Candidature d&apos;adoption</p>
          <p className="font-headline-sm text-headline-sm">{listing.name}</p>
        </div>
      </div>
      <ol className="grid grid-cols-4 gap-space-xs" aria-label={`Étape ${step + 1} sur ${STEPS.length}`}>
        {STEPS.map((label, index) => (
          <li key={label} className="flex flex-col gap-1">
            <span className={`h-1.5 rounded-full ${index <= step ? "bg-primary-container" : "bg-surface-container"}`} />
            <span
              className={`font-label-sm text-label-sm truncate ${index === step ? "text-primary font-bold" : index < step ? "text-on-surface" : "text-outline"}`}
              aria-current={index === step ? "step" : undefined}
            >
              {index + 1}. {label}
            </span>
          </li>
        ))}
      </ol>

      <div className="bg-surface-container-lowest rounded-2xl p-space-lg md:p-space-xl shadow-sm flex flex-col gap-space-lg">
        {step === 0 && (
          <>
            <h1 className="font-headline-md text-headline-md">Votre logement</h1>
            <ChoiceCards
              label="Type de logement"
              value={housing.type}
              onChange={(type) => setHousing({ ...housing, type })}
              options={[
                { value: "appartement", label: "Appartement", icon: "apartment" },
                { value: "maison", label: "Maison", icon: "house" },
              ]}
            />
            <ChoiceCards
              label="Jardin ou extérieur"
              value={housing.outdoor ? "oui" : "non"}
              onChange={(v) => setHousing({ ...housing, outdoor: v === "oui" })}
              options={[
                { value: "oui", label: "Oui", icon: "yard" },
                { value: "non", label: "Non", icon: "block" },
              ]}
            />
            <ChoiceCards
              label="Vous êtes"
              value={housing.tenure}
              onChange={(tenure) => setHousing({ ...housing, tenure })}
              options={[
                { value: "proprietaire", label: "Propriétaire", icon: "key" },
                { value: "locataire", label: "Locataire", icon: "real_estate_agent" },
              ]}
            />
            {housing.tenure === "locataire" && (
              <div className="flex items-center justify-between gap-space-md p-space-md rounded-xl bg-surface-container-low/60">
                <span className="font-label-lg text-label-lg">Mon propriétaire accepte les animaux</span>
                <Toggle
                  checked={housing.landlordOk}
                  onChange={(landlordOk) => setHousing({ ...housing, landlordOk })}
                  label="Mon propriétaire accepte les animaux"
                />
              </div>
            )}
            <TextField
              label="Ville"
              icon="location_on"
              autoComplete="address-level2"
              value={housing.city}
              onChange={(e) => setHousing({ ...housing, city: e.target.value })}
              error={errors.city}
            />
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="font-headline-md text-headline-md">Votre foyer</h1>
            <div className="flex flex-col gap-space-sm">
              <Counter label="Adultes" icon="person" min={1} value={household.adults} onChange={(adults) => setHousehold({ ...household, adults })} />
              {errors.adults && <p className="font-body-sm text-body-sm text-error">{errors.adults}</p>}
              <Counter
                label="Enfants"
                icon="child_care"
                value={household.children}
                onChange={(children) => setHousehold({ ...household, children })}
              />
            </div>
            {household.children > 0 && (
              <div className="flex flex-col gap-space-xs">
                <span className="font-label-lg text-label-lg">Âge des enfants</span>
                <div className="flex gap-space-xs">
                  {CHILD_AGE_RANGES.map((range) => (
                    <Chip
                      key={range}
                      selected={household.childAges.includes(range)}
                      onClick={() =>
                        setHousehold({
                          ...household,
                          childAges: household.childAges.includes(range)
                            ? household.childAges.filter((r) => r !== range)
                            : [...household.childAges, range],
                        })
                      }
                    >
                      {range} ans
                    </Chip>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-col gap-space-sm">
              <span className="font-label-lg text-label-lg">Animaux actuels</span>
              <Counter label="Chats" icon="pets" value={household.cats} onChange={(cats) => setHousehold({ ...household, cats })} />
              <Counter label="Chiens" icon="sound_detection_dog_barking" value={household.dogs} onChange={(dogs) => setHousehold({ ...household, dogs })} />
              <Counter label="Autres" icon="cruelty_free" value={household.others} onChange={(others) => setHousehold({ ...household, others })} />
            </div>
            <div className="flex items-center justify-between gap-space-md p-space-md rounded-xl bg-surface-container-low/60">
              <span className="font-label-lg text-label-lg">Allergies dans le foyer</span>
              <Toggle
                checked={household.allergies}
                onChange={(allergies) => setHousehold({ ...household, allergies })}
                label="Allergies dans le foyer"
              />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="font-headline-md text-headline-md">Votre mode de vie</h1>
            <label className="flex flex-col gap-space-sm">
              <span className="flex items-center justify-between font-label-lg text-label-lg">
                Heures seul par jour
                <span className="text-primary">
                  {lifestyle.aloneHours}
                  {lifestyle.aloneHours >= MAX_ALONE_HOURS ? "+" : ""} h
                </span>
              </span>
              <input
                type="range"
                min={0}
                max={MAX_ALONE_HOURS}
                value={lifestyle.aloneHours}
                onChange={(e) => setLifestyle({ ...lifestyle, aloneHours: Number(e.target.value) })}
                className="w-full accent-[#0f766e]"
              />
              <span className="flex justify-between font-body-sm text-body-sm text-on-surface-variant">
                <span>0 h</span>
                <span>{MAX_ALONE_HOURS}+ h</span>
              </span>
            </label>
            <ChoiceCards
              label="Niveau d'activité"
              columns={3}
              value={lifestyle.activity}
              onChange={(activity) => setLifestyle({ ...lifestyle, activity })}
              options={[
                { value: "calme", label: "Calme", icon: "weekend" },
                { value: "modere", label: "Modéré", icon: "directions_walk" },
                { value: "tres-actif", label: "Très actif", icon: "directions_run" },
              ]}
            />
            <ChoiceCards
              label={`Expérience avec cette espèce`}
              columns={3}
              value={lifestyle.experience}
              onChange={(experience) => setLifestyle({ ...lifestyle, experience })}
              options={[
                { value: "premiere", label: "Première fois", icon: "emoji_nature" },
                { value: "un-peu", label: "Un peu", icon: "thumb_up" },
                { value: "beaucoup", label: "Beaucoup", icon: "workspace_premium" },
              ]}
            />
            <TextArea
              label={`Pourquoi souhaitez-vous adopter ${listing.name} ?`}
              hint={`${lifestyle.motivation.length} / ${MOTIVATION_MAX_LENGTH}`}
              rows={6}
              maxLength={MOTIVATION_MAX_LENGTH}
              value={lifestyle.motivation}
              onChange={(e) => setLifestyle({ ...lifestyle, motivation: e.target.value })}
              placeholder="Parlez de votre foyer, de votre quotidien et de ce que vous pourrez lui offrir…"
              error={errors.motivation}
            />
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="font-headline-md text-headline-md">Récapitulatif</h1>
            <div className="flex flex-col gap-space-md">
              {[
                { icon: "home", title: "Logement", rows: housingRows(answers), step: 0 },
                { icon: "groups", title: "Foyer", rows: householdRows(answers), step: 1 },
                { icon: "directions_walk", title: "Mode de vie", rows: lifestyleRows(answers), step: 2 },
              ].map((card) => (
                <AnswerCard
                  key={card.title}
                  icon={card.icon}
                  title={card.title}
                  rows={card.rows}
                  action={<EditLink onClick={() => setStep(card.step)} />}
                />
              ))}
              <section className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-sm">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-space-xs font-headline-sm text-headline-sm">
                    <Icon name="favorite" className="text-primary text-[22px]" />
                    Motivation
                  </h3>
                  <EditLink onClick={() => setStep(2)} />
                </div>
                <MotivationQuote text={lifestyle.motivation.trim()} />
              </section>
            </div>
            <p className="flex items-start gap-space-xs p-space-sm rounded-xl bg-amber-50 text-amber-800 font-body-sm text-body-sm">
              <Icon name="info" className="text-[18px]" />
              Le carnet de santé n&apos;est pas transmis automatiquement.
            </p>
            {submitError && <Alert>{submitError}</Alert>}
          </>
        )}

        <div className="flex items-center justify-between gap-space-sm pt-space-md border-t border-surface-container-low">
          {step > 0 ? (
            <Button type="button" variant="ghost" onClick={goBack}>
              Retour
            </Button>
          ) : (
            <ButtonLink href={ADOPTION_ROUTES.listing(listing.id)} variant="secondary">
              Annuler
            </ButtonLink>
          )}
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={goNext} icon="arrow_forward">
              Suivant
            </Button>
          ) : (
            <Button type="button" variant="coral" onClick={send} loading={sending}>
              Envoyer ma candidature
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function EditLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="font-label-md text-label-md text-primary hover:underline">
      Modifier
    </button>
  );
}
