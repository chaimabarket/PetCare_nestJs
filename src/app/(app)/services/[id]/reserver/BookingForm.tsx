"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PetAvatar } from "@/components/pets/ui";
import { Breadcrumb, ErrorState, LoadingState, ProviderPhoto, useLoad } from "@/components/services/ui";
import { Icon } from "@/components/ui/Icon";
import { ApiError } from "@/lib/api";
import { ageLabel, listPets, localDay, shiftDay, speciesLine } from "@/lib/pets";
import {
  APP_TIME_ZONE,
  availableSlots,
  BOOKING_NOTES_MAX,
  createBooking,
  firstError,
  formatDateTime,
  formatDuration,
  formatPrice,
  getProvider,
  getSlots,
  listCategories,
  SERVICES_ROUTES,
  validateBooking,
  weekdayOf,
  zonedParts,
  type ServiceBooking,
} from "@/lib/services";
import { errorMessage } from "@/lib/users";

/** Nombre de jours proposés à la réservation. */
const DAYS_AHEAD = 21;
type Period = "all" | "morning" | "afternoon";

const timeLabel = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: APP_TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export function BookingForm({ id }: { id: string }) {
  return (
    <RequireAuth>
      <BookingContent id={id} />
    </RequireAuth>
  );
}

/** Réserver une prestation (maquette r_server_une_prestation_petcare_community). */
function BookingContent({ id }: { id: string }) {
  const params = useSearchParams();
  const load = useCallback(async () => {
    const [provider, categories, pets] = await Promise.all([getProvider(id), listCategories(), listPets().catch(() => [])]);
    return {
      provider,
      icon: categories.find((c) => c.name === provider.category)?.icon ?? ("autre" as const),
      pets: pets.filter((p) => p.status !== "archived"),
    };
  }, [id]);
  const { data, error, loading, reload } = useLoad(load);

  const today = zonedParts(new Date()).day;
  const [serviceId, setServiceId] = useState(params.get("prestation") ?? "");
  /** `null` : pas encore choisi (le premier animal est proposé) ; "" : « Autre animal ». */
  const [chosenPetId, setPetId] = useState<string | null>(null);
  const [otherAnimal, setOtherAnimal] = useState("");
  const [day, setDay] = useState(today);
  const [period, setPeriod] = useState<Period>("all");
  const [slot, setSlot] = useState("");
  const [notes, setNotes] = useState("");
  const [freeSlots, setFreeSlots] = useState<string[] | null>(null);
  const [slotsVersion, setSlotsVersion] = useState(0);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<ServiceBooking | null>(null);

  const services = useMemo(() => data?.provider.services.filter((s) => s.status === "published") ?? [], [data]);
  const service = services.find((s) => s.id === serviceId) ?? services[0];
  const petId = chosenPetId ?? data?.pets[0]?.id ?? "";
  const pet = data?.pets.find((p) => p.id === petId);
  const week = useMemo(() => data?.provider.availability ?? [], [data]);

  // Créneaux libres du jour choisi.
  useEffect(() => {
    if (!service) return;
    let active = true;
    getSlots(id, service.id, day).then(
      (slots) => active && setFreeSlots(slots),
      () => active && setFreeSlots([]),
    );
    return () => {
      active = false;
      setFreeSlots(null);
    };
  }, [id, service, day, slotsVersion]);

  const days = useMemo(() => Array.from({ length: DAYS_AHEAD }, (_, i) => shiftDay(today, i)), [today]);

  /** Tous les créneaux théoriques du jour : ceux absents de `freeSlots` sont déjà réservés. */
  const allSlots = useMemo(
    () =>
      service
        ? availableSlots({ day, week, durationMinutes: service.durationMinutes, busy: [] }).map((d) => d.toISOString())
        : [],
    [day, week, service],
  );
  const shownSlots = allSlots.filter((iso) => {
    const minutes = zonedParts(new Date(iso)).minutes;
    return period === "all" || (period === "morning" ? minutes < 12 * 60 : minutes >= 12 * 60);
  });

  if (loading && !data) return <LoadingState />;
  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto w-full px-margin py-space-xl">
        <ErrorState message={error ?? "Prestataire introuvable."} onRetry={reload} />
      </div>
    );
  }
  const { provider, icon, pets } = data;
  const animalName = pet ? pet.name : otherAnimal.trim();

  async function submit() {
    setFormError("");
    const input = {
      serviceId: service?.id ?? "",
      dateTime: slot,
      animalName,
      ...(pet && { petId: pet.id }),
      notes,
    };
    const problem = firstError(validateBooking(input).errors);
    if (problem) {
      setFormError(problem);
      return;
    }
    setBusy(true);
    try {
      setDone(await createBooking(input));
    } catch (e) {
      setFormError(errorMessage(e));
      if (e instanceof ApiError && e.status === 409) {
        setSlot("");
        setSlotsVersion((v) => v + 1);
      }
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <Breadcrumb
      items={[
        { label: "Services", href: SERVICES_ROUTES.directory },
        { label: provider.name, href: SERVICES_ROUTES.provider(provider.id) },
        { label: "Réserver" },
      ]}
    />
  );

  if (done) {
    return (
      <div className="max-w-3xl mx-auto w-full px-margin md:px-margin-md py-space-xl flex flex-col gap-space-lg">
        {header}
        <section className="bg-surface-container-lowest rounded-2xl p-space-xl shadow-sm flex flex-col gap-space-md">
          <div className="flex items-start gap-space-md">
            <span className="w-14 h-14 rounded-2xl bg-primary-fixed/50 text-primary flex items-center justify-center shrink-0">
              <Icon name="task_alt" className="text-[30px]" />
            </span>
            <div className="flex flex-col gap-1">
              <span className="self-start px-2.5 py-0.5 rounded-full bg-primary-fixed/60 text-on-primary-fixed-variant font-label-sm text-label-sm">
                Demande envoyée
              </span>
              <h1 className="font-headline-md text-headline-md text-on-surface">Visible dans votre agenda</h1>
              <p className="font-body-md text-body-md text-on-surface-variant">
                <strong className="text-on-surface">{done.providerName}</strong> a bien reçu votre demande pour{" "}
                <strong className="text-on-surface">{done.animalName}</strong> le{" "}
                <span className="text-primary font-semibold">{formatDateTime(done.dateTime)}</span>. Vous recevrez une notification dès
                sa réponse.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-space-sm">
            <Link href="/rendez-vous" className="h-11 px-5 rounded-xl bg-primary-fixed/50 text-on-primary-fixed-variant font-label-md text-label-md inline-flex items-center gap-2">
              <Icon name="calendar_month" className="text-[20px]" />
              Voir dans l&apos;agenda
            </Link>
            <Link href={SERVICES_ROUTES.myBookings} className="h-11 px-5 rounded-xl bg-primary text-on-primary font-label-md text-label-md inline-flex items-center gap-2">
              Mes réservations
            </Link>
            <Link href={SERVICES_ROUTES.directory} className="h-11 px-5 rounded-xl text-on-surface-variant font-label-md text-label-md inline-flex items-center">
              Retour à l&apos;annuaire
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto w-full px-margin md:px-margin-md py-space-xl flex flex-col gap-space-lg">
      {header}
      <h1 className="font-headline-lg text-headline-lg text-on-surface">Réserver une prestation</h1>

      {/* Prestataire et prestation */}
      <section className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-md">
        <div className="flex items-center gap-space-md">
          <ProviderPhoto provider={provider} icon={icon} className="w-14 h-14" />
          <div className="flex-1 min-w-0">
            <h2 className="font-headline-sm text-headline-sm text-on-surface truncate flex items-center gap-1">
              {provider.name}
              <Icon name="verified" className="text-[18px] text-primary" />
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1">
              <Icon name="location_on" className="text-[16px]" />
              {provider.city}
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-surface-container font-label-sm text-label-sm text-on-surface-variant">{provider.category}</span>
        </div>
        {services.length === 0 ? (
          <p className="text-on-surface-variant">Ce prestataire n&apos;a pas de prestation en ligne.</p>
        ) : (
          <>
            {services.length > 1 && (
              <label className="flex flex-col gap-1">
                <span className="font-label-md text-label-md text-on-surface">Prestation</span>
                <select
                  value={service?.id}
                  onChange={(e) => {
                    setServiceId(e.target.value);
                    setSlot("");
                  }}
                  className="h-11 rounded-lg bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {formatPrice(s.price)} · {formatDuration(s.durationMinutes)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {service && (
              <div className="rounded-xl bg-surface-container-low p-space-md flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-label-lg text-label-lg text-on-surface">{service.name}</span>
                  <span className="shrink-0">
                    <span className="font-headline-sm text-headline-sm text-primary font-bold">{formatPrice(service.price)}</span>{" "}
                    <span className="font-body-sm text-body-sm text-on-surface-variant">indicatif</span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-lowest font-label-sm text-label-sm">
                    <Icon name="schedule" className="text-[14px]" />
                    {formatDuration(service.durationMinutes)}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary-fixed/60 text-on-secondary-fixed-variant font-label-sm text-label-sm">
                    <Icon name="payments" className="text-[14px]" />
                    Règlement sur place
                  </span>
                </div>
              </div>
            )}
            <p className="font-body-sm text-body-sm text-on-surface-variant flex items-start gap-1.5">
              <Icon name="info" className="text-[16px] mt-0.5" />
              Tarif indicatif, susceptible d&apos;être ajusté selon le gabarit ou l&apos;état de l&apos;animal. Aucun paiement en ligne.
            </p>
          </>
        )}
      </section>

      {service && (
        <>
          {/* Animal */}
          <section className="flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Quel compagnon vient au rendez-vous ?</h2>
              {animalName && <span className="font-label-sm text-label-sm text-primary">1 sélectionné</span>}
            </div>
            <div className="flex gap-space-sm overflow-x-auto pb-1">
              {pets.map((p) => {
                const selected = petId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setPetId(p.id)}
                    className={`relative shrink-0 w-56 bg-surface-container-lowest rounded-2xl p-3 shadow-sm flex items-center gap-3 text-left transition-all ${
                      selected ? "ring-2 ring-primary" : "hover:shadow-md"
                    }`}
                  >
                    <PetAvatar pet={p} className="w-14 h-14" />
                    <span className="flex flex-col min-w-0">
                      <span className="font-label-lg text-label-lg text-on-surface truncate">{p.name}</span>
                      <span className="font-body-sm text-body-sm text-on-surface-variant truncate">{speciesLine(p)}</span>
                      {p.birthDate && <span className="font-label-sm text-label-sm text-primary">{ageLabel(p.birthDate, localDay())}</span>}
                    </span>
                    {selected && <Icon name="check_circle" filled className="absolute top-2 right-2 text-primary text-[20px]" />}
                  </button>
                );
              })}
              <button
                type="button"
                aria-pressed={petId === ""}
                onClick={() => setPetId("")}
                className={`shrink-0 w-56 bg-surface-container-lowest rounded-2xl p-3 shadow-sm flex items-center gap-3 text-left ${
                  petId === "" ? "ring-2 ring-primary" : "hover:shadow-md"
                }`}
              >
                <span className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
                  <Icon name="add" className="text-[26px]" />
                </span>
                <span className="font-label-lg text-label-lg text-on-surface">Autre animal</span>
              </button>
            </div>
            {petId === "" && (
              <input
                type="text"
                maxLength={60}
                value={otherAnimal}
                onChange={(e) => setOtherAnimal(e.target.value)}
                aria-label="Nom de l'animal"
                placeholder={pets.length ? "Nom de l'animal" : "Nom de l'animal (ajoutez-le aussi dans « Mes animaux »)"}
                className="h-11 rounded-lg bg-surface-container-lowest shadow-sm px-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            )}
          </section>

          {/* Date */}
          <section className="flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
                <Icon name="calendar_month" className="text-primary" />
                Choisir une date
              </h2>
              <span className="px-3 py-1 rounded-full bg-surface-container font-label-md text-label-md text-on-surface-variant capitalize">
                {new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`))}
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {days.map((d) => {
                const open = week.find((w) => w.weekday === weekdayOf(d))?.enabled ?? false;
                const selected = d === day;
                const date = new Date(`${d}T12:00:00Z`);
                const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr-FR", { ...o, timeZone: "UTC" }).format(date);
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={!open}
                    aria-pressed={selected}
                    onClick={() => {
                      setDay(d);
                      setSlot("");
                    }}
                    className={`shrink-0 w-16 h-24 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all ${
                      selected
                        ? "bg-primary text-on-primary shadow-md"
                        : open
                          ? "bg-surface-container-lowest text-on-surface shadow-sm hover:shadow-md"
                          : "bg-surface-container-low text-outline cursor-not-allowed"
                    }`}
                  >
                    <span className="font-label-sm text-label-sm uppercase">{fmt({ weekday: "short" }).replace(".", "")}</span>
                    <span className="font-headline-md text-headline-md font-bold">{fmt({ day: "numeric" })}</span>
                    <span className="font-label-sm text-label-sm">{open ? fmt({ month: "short" }).replace(".", "") : "Fermé"}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Créneaux */}
          <section className="flex flex-col gap-space-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface">Créneaux horaires disponibles</h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">Durée estimée : {formatDuration(service.durationMinutes)}</p>
              </div>
              <div className="inline-flex p-1 bg-surface-container-low rounded-xl" role="group" aria-label="Moment de la journée">
                {(["all", "morning", "afternoon"] as Period[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={period === p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1.5 rounded-lg font-label-md text-label-md ${period === p ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant"}`}
                  >
                    {{ all: "Tous", morning: "Matin", afternoon: "Après-midi" }[p]}
                  </button>
                ))}
              </div>
            </div>
            {freeSlots === null ? (
              <LoadingState text="Recherche des créneaux…" />
            ) : shownSlots.length === 0 ? (
              <p className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm text-on-surface-variant">
                Aucun créneau ce jour-là{period !== "all" ? " à ce moment de la journée" : ""}. Choisissez une autre date.
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {shownSlots.map((iso) => {
                  const free = freeSlots.includes(iso);
                  const selected = slot === iso;
                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={!free}
                      aria-pressed={selected}
                      onClick={() => setSlot(iso)}
                      className={`h-12 rounded-xl font-label-lg text-label-lg flex items-center justify-center gap-1 transition-all ${
                        selected
                          ? "bg-primary text-on-primary shadow-md"
                          : free
                            ? "bg-surface-container-lowest text-on-surface shadow-sm hover:ring-2 hover:ring-primary/30"
                            : "bg-surface-container-low text-outline line-through cursor-not-allowed"
                      }`}
                    >
                      {timeLabel(iso)}
                      {selected && <Icon name="check_circle" className="text-[18px]" />}
                      {!free && <Icon name="lock" className="text-[14px]" />}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex flex-wrap gap-4 font-label-sm text-label-sm text-on-surface-variant">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary" /> Sélectionné</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-surface-container-lowest ring-1 ring-outline-variant" /> Disponible</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-surface-container-high" /> Réservé ou passé</span>
            </div>
          </section>

          {/* Précisions */}
          <section className="flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
                <Icon name="edit_note" className="text-primary" />
                Précisions pour le prestataire
              </h2>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                {notes.length} / {BOOKING_NOTES_MAX}
              </span>
            </div>
            <textarea
              rows={3}
              maxLength={BOOKING_NOTES_MAX}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              aria-label="Précisions pour le prestataire"
              placeholder="Ex : pattes sensibles, craint le séchoir, première visite…"
              className="w-full rounded-xl bg-surface-container-lowest shadow-sm p-3 font-body-md text-body-md resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <div className="flex items-center justify-between font-label-sm text-label-sm">
              <span className="text-secondary flex items-center gap-1">
                <Icon name="favorite" className="text-[14px]" />
                Partagé uniquement avec le prestataire
              </span>
              <span className="text-outline">Facultatif</span>
            </div>
          </section>

          {formError && (
            <p role="alert" className="rounded-xl bg-error-container/50 text-on-error-container p-space-md flex items-center gap-2">
              <Icon name="error" />
              {formError}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={busy || !slot || !animalName}
              className="h-14 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg shadow-md hover:bg-primary-container inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Icon name={busy ? "progress_activity" : "event_available"} className={`text-[22px] ${busy ? "animate-spin" : ""}`} />
              {slot ? `Demander la réservation — ${timeLabel(slot)}` : "Demander la réservation"}
            </button>
            <p className="font-body-sm text-body-sm text-on-surface-variant text-center flex items-center justify-center gap-1">
              <Icon name="verified_user" className="text-[16px]" />
              Réservation sans prépaiement • annulable tant que le prestataire n&apos;a pas répondu
            </p>
          </div>
        </>
      )}
    </div>
  );
}
