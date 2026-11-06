"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppointmentCard, CancelledCard, ReminderAgendaCard } from "@/components/rendez-vous/AgendaCards";
import {
  Breadcrumb,
  Chip,
  DemoBanner,
  Loading,
  Pill,
  PetAvatar,
  RdvCard,
  STATUS_STYLES,
  pageClass,
  useToast,
} from "@/components/rendez-vous/ui";
import { Icon } from "@/components/ui/Icon";
import {
  addDays,
  dayOnly,
  formatDayTitle,
  formatLongDate,
  formatMonthYear,
  formatRelativeDay,
  isSameDay,
  shortDayName,
} from "@/lib/rendez-vous/format";
import { isActive } from "@/lib/rendez-vous/rules";
import { setReminderDone, useRdv, type RdvState } from "@/lib/rendez-vous/store";
import type { Appointment, AppointmentStatus, Reminder } from "@/lib/rendez-vous/types";

/** Agenda : semaine ou mois, filtres par animal et par statut, rendez-vous et rappels du jour choisi puis du lendemain. */
export default function AgendaPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AgendaLoader />
    </Suspense>
  );
}

function AgendaLoader() {
  const data = useRdv();
  // /rendez-vous?animal=Milo : agenda déjà filtré (depuis la fiche d'un animal).
  const initialPet = useSearchParams().get("animal");
  if (!data) return <Loading />;
  return <Agenda data={data} initialPet={initialPet} />;
}

type Item = { kind: "appointment"; appointment: Appointment; time: Date } | { kind: "reminder"; reminder: Reminder; time: Date };

const STATUS_FILTERS: { status: AppointmentStatus; label: string; count?: boolean }[] = [
  { status: "confirmed", label: "Confirmés", count: true },
  { status: "planned", label: "En attente", count: true },
  { status: "cancelled", label: "Annulés" },
  { status: "completed", label: "Terminés" },
];

function Agenda({ data, initialPet }: { data: RdvState; initialPet: string | null }) {
  const { appointments, reminders } = data;
  const [selectedDay, setSelectedDay] = useState(() => dayOnly(new Date()));
  const [monthView, setMonthView] = useState(false);
  const [pet, setPet] = useState<string | null>(initialPet);
  const [status, setStatus] = useState<AppointmentStatus | null>(null);
  const toast = useToast();

  // Compteurs des puces (sur tous les rendez-vous de l'animal choisi).
  const forPet = appointments.filter((a) => !pet || a.petName === pet);
  const countStatus = (s: AppointmentStatus) => forPet.filter((a) => a.status === s).length;

  const pets = new Map<string, number>();
  for (const a of appointments) pets.set(a.petName, (pets.get(a.petName) ?? 0) + (isActive(a.status) ? 1 : 0));
  for (const r of reminders) if (!pets.has(r.petName)) pets.set(r.petName, 0);

  const keepAppointment = (a: Appointment) => (!pet || a.petName === pet) && (!status || a.status === status);
  const keepReminder = (r: Reminder) => !status && (!pet || r.petName === pet) && !r.done;

  const itemsFor = (day: Date): Item[] =>
    [
      ...appointments
        .filter((a) => isSameDay(a.startsAt, day) && keepAppointment(a))
        .map((a): Item => ({ kind: "appointment", appointment: a, time: a.startsAt })),
      ...reminders
        .filter((r) => isSameDay(r.dueAt, day) && keepReminder(r))
        .map((r): Item => ({ kind: "reminder", reminder: r, time: r.dueAt })),
    ].sort((x, y) => x.time.getTime() - y.time.getTime());

  // Points sous chaque jour : la couleur du statut des rendez-vous de ce jour.
  const dots = new Map<number, Set<string>>();
  const addDot = (day: Date, color: string) => {
    const key = dayOnly(day).getTime();
    dots.set(key, (dots.get(key) ?? new Set()).add(color));
  };
  appointments.filter(keepAppointment).forEach((a) => addDot(a.startsAt, STATUS_STYLES[a.status].dot));
  reminders.filter(keepReminder).forEach((r) => addDot(r.dueAt, "bg-outline-variant"));
  const dotsFor = (day: Date) => [...(dots.get(day.getTime()) ?? [])].slice(0, 2);

  const todayItems = itemsFor(selectedDay);
  const nextDay = addDays(selectedDay, 1);
  const nextItems = itemsFor(nextDay);
  const isToday = isSameDay(selectedDay, new Date());
  const newHref = `/rendez-vous/nouveau?date=${toDateParam(selectedDay)}${pet ? `&animal=${encodeURIComponent(pet)}` : ""}`;

  function move(direction: number) {
    setSelectedDay((d) =>
      monthView ? new Date(d.getFullYear(), d.getMonth() + direction, 1) : addDays(d, 7 * direction),
    );
  }

  function renderItem(item: Item) {
    if (item.kind === "reminder") {
      const r = item.reminder;
      return (
        <ReminderAgendaCard
          key={r.id}
          reminder={r}
          onToggle={() => {
            setReminderDone(r.id, !r.done);
            toast.show(`« ${r.title} » validé.`);
          }}
        />
      );
    }
    const a = item.appointment;
    return a.status === "cancelled" ? (
      <CancelledCard key={a.id} appointment={a} />
    ) : (
      <AppointmentCard key={a.id} appointment={a} notify={toast.show} />
    );
  }

  return (
    <div className={pageClass}>
      <Breadcrumb items={[{ label: "Agenda" }]} />
      <DemoBanner />

      <div className="mb-space-lg flex flex-wrap items-center justify-between gap-space-sm">
        <div>
          <h1 className="font-headline-lg text-headline-lg">Agenda</h1>
          <p className="text-on-surface-variant">Les rendez-vous et les soins de vos compagnons.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/rappels"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-surface-container-low px-space-lg font-label-lg text-label-lg text-primary hover:bg-surface-container"
          >
            <Icon name="notifications_active" className="text-[20px]" />
            Rappels &amp; soins
          </Link>
          <Link
            href={newHref}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-space-lg font-label-lg text-label-lg text-on-primary shadow-sm hover:bg-primary-container"
          >
            <Icon name="add" className="text-[20px]" />
            Rendez-vous
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-space-lg lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
        {/* Calendrier et filtres */}
        <section className="flex flex-col gap-3 lg:sticky lg:top-20">
          <div className="flex items-center gap-2">
            <RoundButton icon="chevron_left" label="Précédent" onClick={() => move(-1)} />
            <p className="min-w-0 truncate font-headline-sm text-headline-sm">{formatMonthYear(selectedDay)}</p>
            <RoundButton icon="chevron_right" label="Suivant" onClick={() => move(1)} />
            <div className="ml-auto flex rounded-xl bg-surface-container-high p-1">
              {[false, true].map((month) => (
                <button
                  key={String(month)}
                  type="button"
                  onClick={() => setMonthView(month)}
                  aria-pressed={monthView === month}
                  className={`rounded-lg px-3 py-1 font-label-md text-label-md ${
                    monthView === month ? "bg-white text-primary-container shadow-sm" : "text-on-surface-variant"
                  }`}
                >
                  {month ? "Mois" : "Semaine"}
                </button>
              ))}
            </div>
          </div>

          {monthView ? (
            <MonthGrid month={selectedDay} selected={selectedDay} dotsFor={dotsFor} onSelect={setSelectedDay} />
          ) : (
            <WeekStrip selected={selectedDay} dotsFor={dotsFor} onSelect={setSelectedDay} />
          )}

          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:flex-wrap">
            <Chip
              label="Tous les animaux"
              selected={!pet}
              onClick={() => setPet(null)}
              leading={<Icon name="pets" className={`ml-1 text-[18px] ${pet ? "text-primary" : "text-white"}`} />}
            />
            {[...pets.entries()].map(([name, count]) => (
              <Chip
                key={name}
                label={name}
                selected={pet === name}
                onClick={() => setPet(pet === name ? null : name)}
                leading={<PetAvatar name={name} size={26} badge={false} />}
                trailing={<span className={`text-[13px] ${pet === name ? "text-white/70" : "text-outline"}`}>{count}</span>}
              />
            ))}
          </div>

          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:flex-wrap">
            <StatusFilter label="Tous les statuts" selected={!status} onClick={() => setStatus(null)} />
            {STATUS_FILTERS.map((f) => (
              <StatusFilter
                key={f.status}
                label={f.count ? `${f.label} (${countStatus(f.status)})` : f.label}
                dot={STATUS_STYLES[f.status].dot}
                selected={status === f.status}
                onClick={() => setStatus(f.status)}
              />
            ))}
          </div>
        </section>

        {/* Journée choisie, puis le lendemain */}
        <section className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h2 className="font-headline-md text-headline-md">{formatLongDate(selectedDay)}</h2>
              <p className="text-[13px] text-on-surface-variant">{countLabel(todayItems.length)}</p>
            </div>
            {isToday && <Pill label="Aujourd'hui" className="bg-primary-fixed/45 text-on-primary-fixed-variant" />}
          </div>

          {todayItems.length === 0 ? (
            <RdvCard className="flex flex-col items-center p-6 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container text-primary">
                <Icon name="event_available" className="text-[30px]" />
              </span>
              <p className="mt-3 font-headline-sm text-[16px]">
                {pet || status ? "Aucun rendez-vous pour ces filtres" : "Aucun rendez-vous ce jour-là"}
              </p>
              <p className="mt-1 text-[13px] text-on-surface-variant">
                Choisissez un autre jour ou programmez un soin pour votre compagnon.
              </p>
              <Link
                href={newHref}
                className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-space-lg font-label-lg text-label-lg text-on-primary hover:bg-primary-container"
              >
                <Icon name="add" className="text-[20px]" />
                Rendez-vous
              </Link>
            </RdvCard>
          ) : (
            todayItems.map(renderItem)
          )}

          {nextItems.length > 0 && (
            <>
              <div className="mt-2 flex items-center gap-3">
                <h2 className="flex-1 font-headline-md text-headline-md">{formatDayTitle(nextDay)}</h2>
                <span className="text-[13px] text-on-surface-variant">{formatRelativeDay(nextDay)}</span>
              </div>
              {nextItems.map(renderItem)}
            </>
          )}
        </section>
      </div>
      {toast.view}
    </div>
  );
}

const toDateParam = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function countLabel(n: number) {
  if (n === 0) return "Aucun rendez-vous prévu pour votre foyer";
  return n === 1 ? "1 rendez-vous prévu pour votre foyer" : `${n} rendez-vous prévus pour votre foyer`;
}

function RoundButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-on-surface-variant shadow-sm hover:bg-surface-container-low"
    >
      <Icon name={icon} className="text-[20px]" />
    </button>
  );
}

function StatusFilter({ label, dot, selected, onClick }: { label: string; dot?: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 font-label-md text-label-md ${
        selected ? "bg-surface-container-high text-on-surface" : "bg-white text-on-surface-variant hover:bg-surface-container-low"
      }`}
    >
      {dot && <span className={`h-2 w-2 rounded-full ${dot}`} />}
      {label}
    </button>
  );
}

function Dots({ colors, selected, size = "h-1.5 w-1.5" }: { colors: string[]; selected: boolean; size?: string }) {
  return (
    <span className="flex h-1.5 justify-center gap-[3px]">
      {colors.map((color) => (
        <span key={color} className={`${size} rounded-full ${selected ? "bg-white" : color}`} />
      ))}
    </span>
  );
}

/** Bande de la semaine (dimanche → samedi), jour choisi en teal. */
function WeekStrip({
  selected,
  dotsFor,
  onSelect,
}: {
  selected: Date;
  dotsFor: (day: Date) => string[];
  onSelect: (day: Date) => void;
}) {
  const sunday = addDays(selected, -selected.getDay());
  const days = Array.from({ length: 7 }, (_, i) => addDays(sunday, i));
  return (
    <div className="grid grid-cols-7 items-center gap-1.5">
      {days.map((day) => {
        const isSelected = isSameDay(day, selected);
        return (
          <button
            key={day.getTime()}
            type="button"
            onClick={() => onSelect(day)}
            aria-pressed={isSelected}
            aria-label={formatLongDate(day)}
            className={`flex flex-col items-center justify-center gap-1 rounded-2xl shadow-sm transition-all ${
              isSelected ? "h-20 bg-primary-container text-white" : "h-[72px] bg-white text-on-surface hover:bg-surface-container-low"
            }`}
          >
            <span className={`text-[11px] ${isSelected ? "text-white/70" : "text-on-surface-variant"}`}>{shortDayName(day)}</span>
            <span className="text-[18px] font-bold leading-none">{day.getDate()}</span>
            <Dots colors={dotsFor(day)} selected={isSelected} />
          </button>
        );
      })}
    </div>
  );
}

/** Vue « Mois » : grille complète du mois avec les mêmes points de couleur. */
function MonthGrid({
  month,
  selected,
  dotsFor,
  onSelect,
}: {
  month: Date;
  selected: Date;
  dotsFor: (day: Date) => string[];
  onSelect: (day: Date) => void;
}) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const leading = first.getDay(); // colonnes vides avant le 1er (semaine commençant dimanche)

  return (
    <RdvCard className="p-3">
      <div className="grid grid-cols-7 text-center font-label-md text-label-md text-outline">
        {["D", "L", "M", "M", "J", "V", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7">
        {Array.from({ length: leading }, (_, i) => (
          <span key={`vide-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = new Date(month.getFullYear(), month.getMonth(), i + 1);
          const isSelected = isSameDay(day, selected);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(day)}
              aria-pressed={isSelected}
              aria-label={formatLongDate(day)}
              className={`m-0.5 flex h-11 flex-col items-center justify-center gap-0.5 rounded-xl font-label-lg text-label-lg ${
                isSelected ? "bg-primary-container text-white" : "text-on-surface hover:bg-surface-container-low"
              }`}
            >
              {i + 1}
              <Dots colors={dotsFor(day)} selected={isSelected} size="h-[5px] w-[5px]" />
            </button>
          );
        })}
      </div>
    </RdvCard>
  );
}
