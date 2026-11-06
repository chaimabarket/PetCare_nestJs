"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Breadcrumb,
  Chip,
  DemoBanner,
  Dialog,
  ErrorBanner,
  FieldError,
  FieldLabel,
  Loading,
  PetAvatar,
  RdvCard,
  SoftButton,
  flash,
  pageClass,
} from "@/components/rendez-vous/ui";
import { Icon } from "@/components/ui/Icon";
import { Toggle } from "@/components/ui/Toggle";
import {
  addDays,
  addMinutes,
  dayOnly,
  formatDayMonth,
  formatDuration,
  formatLongDate,
  formatMonthYear,
  formatReminderOffset,
  formatTime,
  isSameDay,
  isoWeekNumber,
} from "@/lib/rendez-vous/format";
import { durationMinutes, findPetConflict, isBooking } from "@/lib/rendez-vous/rules";
import {
  createPersonalAppointment,
  currentUserId,
  errorMessage,
  rescheduleAppointment,
  useRdv,
  type RdvState,
} from "@/lib/rendez-vous/store";
import {
  PERSONAL_TYPES,
  PLACE_LABELS,
  TYPE_ICONS,
  TYPE_LABELS,
  type Appointment,
  type AppointmentPlace,
  type AppointmentType,
  type PetOption,
} from "@/lib/rendez-vous/types";

/** Créneaux proposés, en minutes depuis minuit (09:00, 10:30…). */
const SLOTS = [9 * 60, 10 * 60 + 30, 14 * 60, 15 * 60 + 30, 16 * 60 + 30, 17 * 60 + 30, 18 * 60 + 30];
const DURATIONS = [15, 30, 45, 60, 90, 120];
const REMINDER_CHOICES = [0, 60, 1440, 2880];
/** Adresse par défaut : la ville du profil (fictive tant que le module Users n'est pas branché). */
const PROFILE_ADDRESS = "Tunis, Les Berges du Lac";

/**
 * Ajouter un rendez-vous personnel, ou reporter un rendez-vous.
 * ?date=2026-11-12&animal=Milo (préremplissage), ?reporter=<id> (report), ?copie=<id> (« Reprogrammer »).
 */
export default function AppointmentFormPage() {
  return (
    <Suspense fallback={<Loading />}>
      <FormLoader />
    </Suspense>
  );
}

function FormLoader() {
  const params = useSearchParams();
  const data = useRdv();
  if (!data) return <Loading />;
  const find = (id: string | null) => (id ? data.appointments.find((a) => a.id === id) : undefined);
  const reschedule = find(params.get("reporter"));
  return (
    <AppointmentForm
      // Une nouvelle URL (autre rendez-vous à reporter…) repart d'un formulaire vierge.
      key={params.toString()}
      data={data}
      reschedule={reschedule}
      copyFrom={find(params.get("copie"))}
      initialDate={parseDate(params.get("date"))}
      initialPet={params.get("animal")}
    />
  );
}

function parseDate(value: string | null) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : undefined;
}

const formatSlot = (slot: number) => `${String(Math.floor(slot / 60)).padStart(2, "0")}:${String(slot % 60).padStart(2, "0")}`;

function AppointmentForm({
  data,
  reschedule,
  copyFrom,
  initialDate,
  initialPet,
}: {
  data: RdvState;
  reschedule?: Appointment;
  copyFrom?: Appointment;
  initialDate?: Date;
  initialPet: string | null;
}) {
  const router = useRouter();
  const locked = Boolean(reschedule);
  const source = reschedule ?? copyFrom;
  const agenda = data.appointments;

  const [pet, setPet] = useState<PetOption | null>(() =>
    source
      ? { id: source.petId, name: source.petName, breed: source.petBreed }
      : initialPet
        ? (data.pets.find((p) => p.name === initialPet) ?? { name: initialPet })
        : null,
  );
  const [typedPets, setTypedPets] = useState<PetOption[]>(() => (pet ? [pet] : []));
  const [type, setType] = useState<AppointmentType>(() =>
    source ? (PERSONAL_TYPES.includes(source.type) ? source.type : "autre") : "soin",
  );
  const [title, setTitle] = useState(source?.title ?? "");
  const [day, setDay] = useState(() => {
    const today = dayOnly(new Date());
    const wanted = dayOnly(reschedule && reschedule.startsAt > new Date() ? reschedule.startsAt : (initialDate ?? today));
    return wanted < today ? today : wanted;
  });
  const [slot, setSlot] = useState<number | null>(null);
  const [conflictSlot, setConflictSlot] = useState<number | null>(null);
  const [duration, setDuration] = useState(source ? durationMinutes(source) : 45);
  const [place, setPlace] = useState<AppointmentPlace>(source?.place ?? "domicile");
  const [address, setAddress] = useState(source?.location || PROFILE_ADDRESS);
  const [notes, setNotes] = useState(source?.notes ?? "");
  const [reminderMinutes, setReminderMinutes] = useState(source?.reminderMinutes ?? 1440);
  const [push, setPush] = useState(source?.pushReminder ?? true);
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"pet" | "address" | "calendar" | "duration" | null>(null);

  const now = new Date();
  const slotStart = (s: number) => addMinutes(day, s);

  /** Rendez-vous actif du même animal qui chevauche ce créneau (« Créneau en conflit »). */
  const conflictFor = (s: number) =>
    pet
      ? findPetConflict(agenda, {
          ownerId: currentUserId,
          petName: pet.name,
          start: slotStart(s),
          end: addMinutes(slotStart(s), duration),
          ignoreId: reschedule?.id,
        })
      : undefined;

  const freeSlots = SLOTS.filter((s) => slotStart(s) > now && !conflictFor(s));
  const recommended = freeSlots[0];
  const conflict = conflictSlot !== null ? conflictFor(conflictSlot) : undefined;

  // Animaux du module Animaux, puis ceux déjà vus dans l'agenda, puis ceux saisis à la main.
  const pets: PetOption[] = [...data.pets];
  const known = (name: string) => pets.some((p) => p.name.toLowerCase() === name.toLowerCase());
  for (const a of agenda) if (a.ownerId === currentUserId && !known(a.petName)) pets.push({ id: a.petId, name: a.petName, breed: a.petBreed });
  for (const p of typedPets) if (!known(p.name)) pets.push(p);

  const titleError = submitted && !title.trim() ? "L'intitulé est obligatoire." : undefined;
  const reasonError = submitted && locked && reason.trim().length < 3 ? "Expliquez brièvement le motif (3 caractères minimum)." : undefined;

  function selectDay(d: Date) {
    setDay(dayOnly(d));
    setSlot(null);
    setConflictSlot(null);
  }

  function choosePet(p: PetOption) {
    setPet(p);
    setConflictSlot(null);
    setSlot(null);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setServerError(null);
    if (!pet || slot === null || !title.trim() || (locked && reason.trim().length < 3)) return;

    try {
      const start = slotStart(slot);
      if (reschedule) {
        rescheduleAppointment(reschedule, start, reason);
        flash(isBooking(reschedule) ? "Rendez-vous reporté. Le prestataire doit le confirmer à nouveau." : "Rendez-vous reporté.");
        router.push(`/rendez-vous/${reschedule.id}`);
      } else {
        const id = createPersonalAppointment({
          pet,
          title,
          type,
          startsAt: start,
          durationMinutes: duration,
          place,
          location: address,
          notes,
          reminderMinutes,
          pushReminder: push,
        });
        flash("Rendez-vous enregistré dans votre agenda.");
        router.push(`/rendez-vous/${id}`);
      }
    } catch (error) {
      // Les valeurs saisies restent : seule l'erreur s'affiche, près du bouton.
      setServerError(errorMessage(error));
    }
  }

  const today = dayOnly(now);
  const quickDays = [0, 1, 2, 3].map((i) => addDays(today, i));
  const heading = locked ? "Reporter le rendez-vous" : "Nouveau rendez-vous";

  return (
    <div className={pageClass}>
      <Breadcrumb items={[{ label: "Agenda", href: "/rendez-vous" }, { label: heading }]} />
      <DemoBanner />

      <form onSubmit={save} noValidate className="mx-auto flex max-w-3xl flex-col">
        <h1 className="mb-space-md font-headline-lg text-headline-lg">{heading}</h1>

        {/* Bandeau d'introduction */}
        <div className="flex items-start gap-3.5 rounded-2xl bg-surface-container p-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-white/70 text-primary">
            <Icon name="event_available" />
          </span>
          <div>
            <p className="font-label-lg text-[16px] text-primary">
              {locked ? "Choisir un nouvel horaire" : "Prendre soin de vos proches"}
            </p>
            <p className="mt-1 text-[14px] leading-relaxed">
              {locked
                ? "L'ancien horaire reste dans l'historique du rendez-vous et le rappel est recalculé."
                : "Programmez un soin personnel, une séance d'éducation ou une visite de contrôle à domicile pour votre compagnon en toute sérénité."}
            </p>
          </div>
        </div>

        {/* Animal concerné */}
        <section className="mt-6">
          <FieldLabel
            required
            trailing={
              <span className="text-[12px] text-on-surface-variant">
                {pets.length <= 1 ? `${pets.length} compagnon enregistré` : `${pets.length} compagnons enregistrés`}
              </span>
            }
          >
            Animal concerné
          </FieldLabel>
          <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-2 pt-1">
            {pets.map((p) => {
              const selected = pet?.name.toLowerCase() === p.name.toLowerCase();
              return (
                <button
                  key={p.name}
                  type="button"
                  disabled={locked}
                  onClick={() => choosePet(p)}
                  aria-pressed={selected}
                  className={`relative flex w-[108px] shrink-0 flex-col items-center rounded-2xl bg-white px-1.5 py-2.5 transition-colors disabled:cursor-not-allowed ${
                    selected ? "ring-2 ring-primary" : "ring-1 ring-outline-variant/50 hover:bg-surface-container-low"
                  }`}
                >
                  <PetAvatar name={p.name} size={56} badge={false} />
                  <span className="mt-2 w-full truncate font-label-lg text-label-lg">{p.name}</span>
                  <span className="w-full truncate text-[12px] text-on-surface-variant">{p.breed ?? " "}</span>
                  {selected && (
                    <span className="absolute right-1.5 top-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-primary text-white">
                      <Icon name="check" className="text-[14px]" />
                    </span>
                  )}
                </button>
              );
            })}
            {!locked && (
              <button
                type="button"
                onClick={() => setDialog("pet")}
                className="flex w-[108px] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl bg-surface-container text-[13px] font-medium hover:bg-surface-container-high"
              >
                <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-surface-container-highest text-on-surface-variant">
                  <Icon name="add" />
                </span>
                Autre
                <br />
                compagnon
              </button>
            )}
          </div>
          {submitted && !pet && <FieldError>Choisissez l&apos;animal concerné.</FieldError>}
        </section>

        {/* Type de rendez-vous */}
        <section className="mt-5">
          <FieldLabel required>Type de rendez-vous</FieldLabel>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {PERSONAL_TYPES.map((t) => (
              <Chip
                key={t}
                label={TYPE_LABELS[t]}
                selected={type === t}
                disabled={locked}
                onClick={() => setType(t)}
                leading={type === t ? <Icon name={TYPE_ICONS[t]} className="ml-1 text-[18px]" /> : undefined}
              />
            ))}
          </div>
        </section>

        {/* Intitulé */}
        <section className="mt-5">
          <FieldLabel required htmlFor="rdv-title">
            Intitulé du rendez-vous
          </FieldLabel>
          <div className="relative flex items-center">
            <Icon name="brush" className="pointer-events-none absolute left-3 text-[20px] text-outline" />
            <input
              id="rdv-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={locked}
              maxLength={120}
              placeholder="Ex. Brossage approfondi & coupe des griffes"
              aria-invalid={Boolean(titleError)}
              className={`h-12 w-full rounded-[14px] bg-white pl-10 pr-3.5 shadow-sm placeholder:text-outline focus:outline-none focus:ring-2 disabled:opacity-70 ${
                titleError ? "ring-2 ring-error" : "focus:ring-primary-container"
              }`}
            />
          </div>
          {titleError && <FieldError>{titleError}</FieldError>}
        </section>

        {/* Date souhaitée */}
        <section className="mt-5">
          <FieldLabel
            required
            trailing={
              <button
                type="button"
                onClick={() => setDialog("calendar")}
                className="flex items-center gap-1 font-label-md text-label-md text-primary-container hover:underline"
              >
                <Icon name="calendar_month" className="text-[16px]" />
                Calendrier complet
              </button>
            }
          >
            Date souhaitée
          </FieldLabel>
          <div className="grid grid-cols-4 gap-1.5">
            {quickDays.map((d, i) => (
              <button
                key={i}
                type="button"
                onClick={() => selectDay(d)}
                aria-pressed={isSameDay(day, d)}
                className={`h-[38px] truncate rounded-[10px] px-1 font-label-md text-label-md ${
                  isSameDay(day, d) ? "bg-primary text-white" : "bg-white hover:bg-surface-container-low"
                }`}
              >
                {i === 0 ? "Aujourd'hui" : i === 1 ? "Demain" : formatDayMonth(d)}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setDialog("calendar")}
            className="mt-2.5 flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left hover:bg-surface-container-low"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-container text-primary">
              <Icon name="calendar_today" className="text-[20px]" />
            </span>
            <span className="flex-1">
              <span className="block font-label-lg text-[16px]">{formatLongDate(day)}</span>
              <span className="block text-[12px] text-on-surface-variant">
                Semaine {isoWeekNumber(day)} • {availabilityLabel(freeSlots.length)}
              </span>
            </span>
            <Icon name="expand_more" className="text-on-surface-variant" />
          </button>
        </section>

        {/* Créneau horaire */}
        <section className="mt-5">
          <FieldLabel
            required
            trailing={
              <button
                type="button"
                onClick={() => setDialog("duration")}
                className="flex items-center gap-1 text-[12px] text-on-surface-variant hover:text-primary"
              >
                <Icon name="schedule" className="text-[15px]" />
                Durée : {formatDuration(duration)}
                <Icon name="edit" className="text-[14px]" />
              </button>
            }
          >
            Sélection du créneau horaire
          </FieldLabel>
          <div className="grid grid-cols-3 gap-2">
            {SLOTS.map((s) => {
              const past = slotStart(s) <= now;
              const busy = Boolean(conflictFor(s));
              const selected = slot === s;
              const subtitle = past ? "PASSÉ" : busy ? "OCCUPÉ" : s === recommended ? "Recommandé" : null;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={past}
                  onClick={() => {
                    if (busy) {
                      setConflictSlot(s);
                    } else {
                      setSlot(s);
                      setConflictSlot(null);
                    }
                  }}
                  aria-pressed={selected}
                  className={`flex h-[52px] flex-col items-center justify-center rounded-[14px] transition-colors disabled:cursor-not-allowed ${
                    selected
                      ? "bg-primary text-white"
                      : past || busy
                        ? "bg-surface-container-high text-outline"
                        : "bg-white text-on-surface shadow-sm hover:bg-surface-container-low"
                  }`}
                >
                  <span className="font-label-lg text-[15px]">{formatSlot(s)}</span>
                  {subtitle && <span className="text-[10px] font-semibold tracking-wide">{subtitle}</span>}
                </button>
              );
            })}
          </div>
          {conflict && conflictSlot !== null && pet && (
            <div className="mt-2">
              <ErrorBanner
                title={`${formatSlot(conflictSlot)} — Créneau en conflit`}
                badge="Indisponible"
                message={`Conflit d'agenda : ${pet.name} a déjà « ${conflict.title} » prévu à ${formatTime(conflict.startsAt)}${
                  conflict.providerName ? ` chez ${conflict.providerName}` : ""
                }.`}
              />
            </div>
          )}
          {submitted && slot === null && <FieldError>Choisissez un créneau horaire.</FieldError>}
        </section>

        {locked ? (
          <section className="mt-5">
            <FieldLabel required htmlFor="rdv-reason">
              Motif du report
            </FieldLabel>
            <textarea
              id="rdv-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder="Ex. Empêchement professionnel"
              aria-invalid={Boolean(reasonError)}
              className={`w-full resize-none rounded-[14px] bg-white p-3.5 shadow-sm placeholder:text-outline focus:outline-none focus:ring-2 ${
                reasonError ? "ring-2 ring-error" : "focus:ring-primary-container"
              }`}
            />
            {reasonError && <FieldError>{reasonError}</FieldError>}
          </section>
        ) : (
          <>
            {/* Lieu */}
            <section className="mt-5">
              <FieldLabel>Lieu du rendez-vous</FieldLabel>
              <div className="grid grid-cols-3 rounded-xl bg-surface-container-high p-1">
                {(Object.keys(PLACE_LABELS) as AppointmentPlace[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlace(p)}
                    aria-pressed={place === p}
                    className={`truncate rounded-[9px] px-1 py-2 text-[12px] ${
                      place === p ? "bg-white font-semibold shadow-sm" : "font-medium"
                    }`}
                  >
                    {PLACE_LABELS[p]}
                  </button>
                ))}
              </div>
              <RdvCard className="mt-2.5 flex items-center gap-3 p-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary-fixed text-secondary">
                  <Icon name="home_work" className="text-[22px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-on-surface-variant">{place === "domicile" ? "Adresse enregistrée" : "Adresse"}</p>
                  <p className="truncate font-label-lg text-[16px]">{address || "Aucune adresse"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDialog("address")}
                  className="rounded-lg px-3 py-1.5 font-label-lg text-label-lg text-primary-container hover:bg-surface-container"
                >
                  Modifier
                </button>
              </RdvCard>
            </section>

            {/* Notes */}
            <section className="mt-5">
              <FieldLabel htmlFor="rdv-notes" trailing={<span className="text-[12px] text-on-surface-variant">Optionnel</span>}>
                Notes personnelles &amp; matériel
              </FieldLabel>
              <textarea
                id="rdv-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Ex. Prévoir serviette absorbante et friandises."
                className="w-full resize-none rounded-[14px] bg-white p-3.5 shadow-sm placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary-container"
              />
            </section>

            {/* Rappels */}
            <section className="mt-4">
              <FieldLabel>Rappels et notifications</FieldLabel>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {REMINDER_CHOICES.map((m) => (
                  <Chip
                    key={m}
                    label={formatReminderOffset(m)}
                    selected={reminderMinutes === m}
                    onClick={() => setReminderMinutes(m)}
                    leading={reminderMinutes === m ? <Icon name="check" className="ml-1 text-[16px]" /> : undefined}
                  />
                ))}
              </div>
              <RdvCard className="mt-2.5 flex items-center gap-3 p-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-container text-primary">
                  <Icon name="notifications_active" className="text-[22px]" />
                </span>
                <div className="flex-1">
                  <p className="font-label-lg text-[15px]">Notification Push &amp; SMS</p>
                  <p className="text-[12px] text-on-surface-variant">Alerte directe sur mobile et par message</p>
                </div>
                <Toggle
                  checked={push && reminderMinutes > 0}
                  onChange={setPush}
                  disabled={reminderMinutes === 0}
                  label="Notification Push et SMS"
                />
              </RdvCard>
            </section>

            {pet && <LastCareNote pet={pet} agenda={agenda} now={now} />}
          </>
        )}

        {/* Barre d'actions, collée en bas de l'écran */}
        <div className="sticky bottom-16 z-10 -mx-margin mt-6 flex flex-col gap-2 bg-background/95 px-margin py-3 backdrop-blur md:bottom-0 md:mx-0 md:px-0">
          {serverError && <ErrorBanner title="Enregistrement impossible" message={serverError} />}
          <div className="flex gap-3">
            <SoftButton label="Annuler" icon="close" onClick={() => router.back()} className="h-[52px] flex-1" />
            <button
              type="submit"
              className="inline-flex h-[52px] flex-[2] items-center justify-center gap-2 rounded-[14px] bg-primary px-4 font-label-lg text-label-lg text-on-primary hover:bg-primary-container"
            >
              <Icon name="check_circle" className="text-[20px]" />
              <span className="truncate">{locked ? "Enregistrer le report" : "Enregistrer le rendez-vous"}</span>
            </button>
          </div>
        </div>
      </form>

      <OtherPetDialog
        open={dialog === "pet"}
        onClose={() => setDialog(null)}
        onAdd={(name) => {
          const p = { name };
          setTypedPets((list) => (list.some((x) => x.name.toLowerCase() === name.toLowerCase()) ? list : [...list, p]));
          choosePet(p);
          setDialog(null);
        }}
      />
      <AddressDialog
        open={dialog === "address"}
        initial={address}
        onClose={() => setDialog(null)}
        onSave={(value) => {
          setAddress(value);
          setDialog(null);
        }}
      />
      <Dialog open={dialog === "calendar"} title="Choisir une date" onClose={() => setDialog(null)}>
        <MonthPicker
          initial={day}
          onPick={(d) => {
            selectDay(d);
            setDialog(null);
          }}
        />
      </Dialog>
      <Dialog open={dialog === "duration"} title="Durée du rendez-vous" onClose={() => setDialog(null)}>
        <ul className="flex flex-col">
          {DURATIONS.map((m) => (
            <li key={m}>
              <button
                type="button"
                onClick={() => {
                  setDuration(m);
                  setSlot(null);
                  setConflictSlot(null);
                  setDialog(null);
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left hover:bg-surface-container-low"
              >
                {formatDuration(m)}
                {m === duration && <Icon name="check" className="text-primary" />}
              </button>
            </li>
          ))}
        </ul>
      </Dialog>
    </div>
  );
}

function availabilityLabel(free: number) {
  if (free === SLOTS.length) return "Disponible toute la journée";
  if (free === 0) return "Aucun créneau disponible";
  return free === 1 ? "1 créneau disponible" : `${free} créneaux disponibles`;
}

/** « Dernier soin personnel pour Milo effectué il y a 3 semaines. » */
function LastCareNote({ pet, agenda, now }: { pet: PetOption; agenda: Appointment[]; now: Date }) {
  const past = agenda
    .filter(
      (a) =>
        a.ownerId === currentUserId &&
        !isBooking(a) &&
        a.status !== "cancelled" &&
        a.petName.toLowerCase() === pet.name.toLowerCase() &&
        a.endsAt < now,
    )
    .sort((x, y) => y.startsAt.getTime() - x.startsAt.getTime());

  let text: string;
  if (past.length === 0) {
    text = `Premier soin personnel enregistré pour ${pet.name} dans PetCare.`;
  } else {
    const days = Math.floor((now.getTime() - past[0].startsAt.getTime()) / 86_400_000);
    const weeks = Math.floor(days / 7);
    const ago =
      days < 1 ? "aujourd'hui" : days < 7 ? `il y a ${days} jour${days > 1 ? "s" : ""}` : `il y a ${weeks} semaine${weeks > 1 ? "s" : ""}`;
    text = `Dernier soin personnel pour ${pet.name} effectué ${ago}. Tout est en ordre !`;
  }

  return (
    <div className="mt-4 flex items-center gap-3 rounded-[14px] bg-surface-container-low p-3.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
        <Icon name="pets" className="text-[18px]" />
      </span>
      <p className="text-[13px]">{text}</p>
    </div>
  );
}

function OtherPetDialog({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <Dialog open={open} title="Autre compagnon" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onAdd(name.trim());
          setName("");
        }}
        className="flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1.5">
          <span className="font-label-lg text-label-lg">Nom de l&apos;animal</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            className="h-11 rounded-lg bg-surface-container-low px-3.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </label>
        <div className="flex justify-end gap-2">
          <SoftButton label="Annuler" icon="close" onClick={onClose} />
          <SoftButton label="Ajouter" icon="add" tone="solid" type="submit" disabled={!name.trim()} />
        </div>
      </form>
    </Dialog>
  );
}

function AddressDialog({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: string;
  onClose: () => void;
  onSave: (value: string) => void;
}) {
  return (
    <Dialog open={open} title="Adresse du rendez-vous" onClose={onClose}>
      {/* Le formulaire est recréé à chaque ouverture : il repart de l'adresse actuelle. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(String(new FormData(e.currentTarget).get("address") ?? "").trim());
        }}
        className="flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1.5">
          <span className="font-label-lg text-label-lg">Adresse</span>
          <input
            name="address"
            autoFocus
            defaultValue={initial}
            maxLength={160}
            className="h-11 rounded-lg bg-surface-container-low px-3.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </label>
        <div className="flex justify-end gap-2">
          <SoftButton label="Annuler" icon="close" onClick={onClose} />
          <SoftButton label="Enregistrer" icon="check" tone="solid" type="submit" />
        </div>
      </form>
    </Dialog>
  );
}

/** « Calendrier complet » : choix d'un jour à partir d'aujourd'hui. */
function MonthPicker({ initial, onPick }: { initial: Date; onPick: (day: Date) => void }) {
  const [month, setMonth] = useState(() => new Date(initial.getFullYear(), initial.getMonth(), 1));
  const today = dayOnly(new Date());
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const leading = month.getDay();
  const canGoBack = month > new Date(today.getFullYear(), today.getMonth(), 1);

  return (
    <div>
      <div className="flex items-center">
        <button
          type="button"
          disabled={!canGoBack}
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          aria-label="Mois précédent"
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-container disabled:opacity-30"
        >
          <Icon name="chevron_left" />
        </button>
        <p className="flex-1 text-center font-headline-sm text-[17px]">{formatMonthYear(month)}</p>
        <button
          type="button"
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          aria-label="Mois suivant"
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-container"
        >
          <Icon name="chevron_right" />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-7 text-center font-label-md text-label-md text-outline">
        {["D", "L", "M", "M", "J", "V", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-7">
        {Array.from({ length: leading }, (_, i) => (
          <span key={`vide-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const d = new Date(month.getFullYear(), month.getMonth(), i + 1);
          const disabled = d < today;
          const selected = isSameDay(d, initial);
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onPick(d)}
              aria-label={formatLongDate(d)}
              className={`m-0.5 h-10 rounded-[10px] font-label-lg text-label-lg ${
                selected ? "bg-primary text-white" : disabled ? "text-outline-variant" : "hover:bg-surface-container-low"
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
