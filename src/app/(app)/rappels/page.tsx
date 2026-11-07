"use client";

import { useState } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import Link from "next/link";
import {
  Breadcrumb,
  Chip,
  Dialog,
  FieldError,
  FieldLabel,
  Loading,
  Pill,
  PetAvatar,
  RdvCard,
  SoftButton,
  TypeTag,
  pageClass,
  useToast,
} from "@/components/rendez-vous/ui";
import { DosesTodayCard } from "@/components/sante/DosesTodayCard";
import { Icon } from "@/components/ui/Icon";
import { Toggle } from "@/components/ui/Toggle";
import { addDays, dayOnly, formatDayMonth, formatMonthYear, formatShortDayMonth, formatTime, isSameDay } from "@/lib/rendez-vous/format";
import { isActive } from "@/lib/rendez-vous/rules";
import {
  createReminder,
  currentUserId,
  deleteReminder,
  errorMessage,
  markAppointmentReminderDone,
  setReminderDone,
  useRdv,
  type RdvState,
} from "@/lib/rendez-vous/store";
import {
  REMINDER_CATEGORY_ICONS,
  REMINDER_CATEGORY_LABELS,
  TYPE_ICONS,
  TYPE_LABELS,
  type Appointment,
  type Reminder,
  type ReminderCategory,
} from "@/lib/rendez-vous/types";

/**
 * Rappels & Soins : Aujourd'hui, Cette semaine, Plus tard.
 * Réunit les rappels de soins créés à la main et les rendez-vous à venir qui ont un rappel.
 */
export default function RemindersPage() {
  return (
    <RequireAuth>
      <RemindersLoader />
    </RequireAuth>
  );
}

function RemindersLoader() {
  const data = useRdv();
  if (!data) return <Loading />;
  return <Reminders data={data} />;
}

type Filter = "all" | "medication" | "appointments";

/** Un rappel affiché : un rappel de soin ou un rendez-vous avec rappel. */
type Item = {
  key: string;
  reminder?: Reminder;
  appointment?: Appointment;
  petName: string;
  petBreed?: string;
  title: string;
  description?: string;
  dueAt: Date;
  done: boolean;
  doneAt?: Date;
};

const fromReminder = (r: Reminder): Item => ({
  key: r.id,
  reminder: r,
  petName: r.petName,
  petBreed: r.petBreed,
  title: r.title,
  description: r.description,
  dueAt: r.dueAt,
  done: r.done,
  doneAt: r.doneAt,
});

const fromAppointment = (a: Appointment): Item => ({
  key: a.id,
  appointment: a,
  petName: a.petName,
  petBreed: a.petBreed,
  title: a.title,
  description: a.providerName ?? (a.location || undefined),
  dueAt: a.startsAt,
  done: a.reminderDoneAt !== undefined,
  doneAt: a.reminderDoneAt,
});

function itemLook(item: Item): { icon: string; tag: string; color: string } {
  const category = item.reminder?.category;
  if (!category) {
    const type = item.appointment!.type;
    return { icon: TYPE_ICONS[type], tag: TYPE_LABELS[type], color: "bg-primary-fixed/60 text-on-primary-fixed-variant" };
  }
  const color =
    category === "medicament" || category === "traitement"
      ? "bg-secondary-fixed text-secondary"
      : category === "controle"
        ? "bg-primary-fixed/60 text-on-primary-fixed-variant"
        : "bg-surface-container text-primary";
  return { icon: REMINDER_CATEGORY_ICONS[category], tag: REMINDER_CATEGORY_LABELS[category], color };
}

function Reminders({ data }: { data: RdvState }) {
  const [pet, setPet] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [showDone, setShowDone] = useState(false);
  const [dialog, setDialog] = useState<"new" | "filters" | null>(null);
  const toast = useToast();

  const now = new Date();
  const today = dayOnly(now);
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(today, 8);

  const all = [
    ...data.reminders.map(fromReminder),
    ...data.appointments
      .filter((a) => a.ownerId === currentUserId && isActive(a.status) && a.reminderMinutes > 0 && a.endsAt > now)
      .map(fromAppointment),
  ].sort((x, y) => x.dueAt.getTime() - y.dueAt.getTime());

  const petNames = [...new Set(all.map((i) => i.petName))];

  const keep = (i: Item) =>
    (!pet || i.petName === pet) &&
    (filter === "all" ||
      (filter === "medication" && (i.reminder?.category === "medicament" || i.reminder?.category === "traitement")) ||
      (filter === "appointments" && i.appointment !== undefined));

  const visible = all.filter(keep);
  const todo = visible.filter((i) => !i.done);
  const todayItems = todo.filter((i) => i.dueAt < tomorrow);
  const weekItems = todo.filter((i) => i.dueAt >= tomorrow && i.dueAt < weekEnd);
  const laterItems = todo.filter((i) => i.dueAt >= weekEnd);
  const doneToday = visible.filter((i) => i.done && i.doneAt && isSameDay(i.doneAt, now));
  const doneOther = visible.filter((i) => i.done && !doneToday.includes(i));
  const todayPets = [...new Set([...todayItems, ...doneToday].map((i) => i.petName))];

  async function toggleDone(item: Item) {
    try {
      if (item.reminder) await setReminderDone(item.reminder.id, !item.done);
      else await markAppointmentReminderDone(item.appointment!, !item.done);
      toast.show(item.done ? `« ${item.title} » remis à faire.` : `« ${item.title} » validé.`);
    } catch (error) {
      toast.show(errorMessage(error), "error");
    }
  }

  const monthsLabel = (items: Item[]) =>
    [...new Set(items.map((i) => formatMonthYear(i.dueAt).split(" ")[0]))].slice(0, 2).join(" & ");

  return (
    <div className={pageClass}>
      <Breadcrumb items={[{ label: "Agenda", href: "/rendez-vous" }, { label: "Rappels & Soins" }]} />

      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-headline-lg text-headline-lg">Rappels &amp; Soins</h1>
          <Pill label={`${todo.length} à faire`} className="bg-secondary-fixed text-on-secondary-container" />
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => setDialog("filters")}
              title="Filtrer"
              className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
            >
              <Icon name="tune" className="text-[20px]" />
            </button>
            <Link
              href="/rendez-vous"
              className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-outline-variant px-2.5 font-label-lg text-[13px] text-primary hover:bg-surface-container-low"
            >
              <Icon name="calendar_today" className="text-[16px]" />
              Vue mois
            </Link>
            <button
              type="button"
              onClick={() => setDialog("new")}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 font-label-lg text-label-lg text-on-primary hover:bg-primary-container"
            >
              <Icon name="add" className="text-[18px]" />
              Nouveau rappel
            </button>
          </div>
        </div>

        <ProgressCard pets={todayPets} done={doneToday.length} total={todayItems.length + doneToday.length} />

        <DosesTodayCard />

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <Chip
            label="Tous les rappels"
            selected={!pet && filter === "all"}
            onClick={() => {
              setPet(null);
              setFilter("all");
            }}
            leading={<Icon name="done_all" className={`ml-1 text-[18px] ${!pet && filter === "all" ? "text-white" : "text-primary"}`} />}
          />
          {petNames.map((name, index) => (
            <Chip
              key={name}
              label={name}
              selected={pet === name}
              onClick={() => setPet(pet === name ? null : name)}
              leading={<PetAvatar name={name} size={24} badge={false} />}
              trailing={<span className={`h-2 w-2 rounded-full ${index % 2 === 0 ? "bg-secondary" : "bg-primary-container"}`} />}
            />
          ))}
          <Chip
            label="Médicaments"
            selected={filter === "medication"}
            onClick={() => setFilter(filter === "medication" ? "all" : "medication")}
            leading={<Icon name="medication" className={`ml-1 text-[18px] ${filter === "medication" ? "text-white" : "text-primary"}`} />}
          />
          <Chip
            label="Rendez-vous"
            selected={filter === "appointments"}
            onClick={() => setFilter(filter === "appointments" ? "all" : "appointments")}
            leading={<Icon name="event" className={`ml-1 text-[18px] ${filter === "appointments" ? "text-white" : "text-primary"}`} />}
          />
        </div>

        {todo.length === 0 && doneToday.length === 0 && (
          <RdvCard className="flex flex-col items-center p-6 text-center">
            <Icon name="notifications" className="text-[40px] text-primary" />
            <p className="mt-2.5 font-headline-sm text-[16px]">Aucun rappel pour le moment</p>
            <p className="mt-1 text-[13px] text-on-surface-variant">
              Ajoutez un rappel de soin ou programmez un rendez-vous avec rappel.
            </p>
          </RdvCard>
        )}

        {todayItems.length > 0 && (
          <Group
            title="Aujourd'hui"
            badge={countLabel(todayItems.length)}
            trailing={todayItems.some((i) => i.dueAt.getHours() >= 18) ? "Ce soir" : formatDayMonth(today)}
            emphasize
          >
            {todayItems.map((item) => (
              <ReminderTile key={item.key} item={item} emphasize now={now} onToggle={() => toggleDone(item)} />
            ))}
          </Group>
        )}
        {weekItems.length > 0 && (
          <Group
            title="Cette semaine"
            badge={countLabel(weekItems.length)}
            trailing={`${tomorrow.getDate()} - ${formatDayMonth(addDays(weekEnd, -1))}`}
          >
            {weekItems.map((item) => (
              <ReminderTile key={item.key} item={item} now={now} onToggle={() => toggleDone(item)} />
            ))}
          </Group>
        )}
        {laterItems.length > 0 && (
          <Group title="Plus tard" badge="À venir" trailing={monthsLabel(laterItems)}>
            {laterItems.map((item) => (
              <ReminderTile key={item.key} item={item} now={now} onToggle={() => toggleDone(item)} />
            ))}
          </Group>
        )}

        {(doneToday.length > 0 || (showDone && doneOther.length > 0)) && (
          <DoneSection
            items={showDone ? [...doneToday, ...doneOther] : doneToday}
            todayCount={doneToday.length}
            onUndo={toggleDone}
            onDelete={async (item) => {
              try {
                await deleteReminder(item.reminder!.id);
                toast.show("Rappel supprimé.");
              } catch (error) {
                toast.show(errorMessage(error), "error");
              }
            }}
          />
        )}
      </div>

      <Dialog open={dialog === "filters"} title="Filtres" onClose={() => setDialog(null)}>
        <p className="mb-2 font-label-lg text-label-lg">Animal</p>
        <div className="flex flex-wrap gap-2">
          <Chip label="Tous" selected={!pet} onClick={() => setPet(null)} />
          {petNames.map((name) => (
            <Chip key={name} label={name} selected={pet === name} onClick={() => setPet(name)} />
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between gap-3">
          <span>Afficher les rappels terminés</span>
          <Toggle checked={showDone} onChange={setShowDone} label="Afficher les rappels terminés" />
        </div>
      </Dialog>

      <NewReminderDialog
        open={dialog === "new"}
        knownPets={[...new Set([...data.pets.map((p) => p.name), ...petNames])]}
        onClose={() => setDialog(null)}
        onCreated={() => {
          setDialog(null);
          toast.show("Rappel ajouté.");
        }}
      />
      {toast.view}
    </div>
  );
}

const countLabel = (n: number) => (n === 1 ? "1 rappel" : `${n} rappels`);

function ProgressCard({ pets, done, total }: { pets: string[]; done: number; total: number }) {
  const left = total - done;
  const title = pets.length === 0 ? "Journée de soin" : `Journée de soin pour ${pets.join(" & ")}`;
  const subtitle =
    total === 0
      ? "Aucun soin prévu aujourd'hui."
      : left === 0
        ? "Tous les soins du jour sont validés. Bravo !"
        : `${done === 0 ? "Aucun soin validé" : `${done} soin${done > 1 ? "s" : ""} déjà validé${done > 1 ? "s" : ""}`}. Plus que ${left} aujourd'hui !`;

  return (
    <RdvCard>
      <div className="flex items-center gap-3.5">
        <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px] bg-primary-fixed/70 text-on-primary-fixed-variant">
          <Icon name="favorite" />
        </span>
        <div>
          <p className="font-label-lg text-[16px]">{title}</p>
          <p className="text-[13px] text-on-surface-variant">{subtitle}</p>
        </div>
      </div>
      <div
        className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-surface-container-high"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label="Soins validés aujourd'hui"
      >
        <div className="h-full rounded-full bg-primary-container transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>
    </RdvCard>
  );
}

function Group({
  title,
  badge,
  trailing,
  emphasize,
  children,
}: {
  title: string;
  badge: string;
  trailing: string;
  emphasize?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3.5">
      <div className="mt-2 flex items-center gap-2">
        <h2 className="font-headline-md text-[20px]">{title}</h2>
        <Pill
          label={badge}
          className={emphasize ? "bg-secondary-fixed text-on-secondary-container" : "bg-surface-container-high text-on-surface-variant"}
        />
        <span className="ml-auto text-[13px] text-on-surface-variant">{trailing}</span>
      </div>
      {children}
    </section>
  );
}

function ReminderTile({ item, emphasize, now, onToggle }: { item: Item; emphasize?: boolean; now: Date; onToggle: () => void }) {
  const { icon, tag, color } = itemLook(item);
  const detail = item.reminder?.detail;

  // Pastille d'urgence pour les rappels du jour.
  let urgency: React.ReactNode = null;
  if (emphasize) {
    if (item.dueAt < now) urgency = <Pill label="En retard" className="bg-error-container text-on-error-container" />;
    else if (item.dueAt.getTime() - now.getTime() <= 3_600_000)
      urgency = <Pill label="À l'heure" className="bg-primary-fixed/45 text-on-primary-fixed-variant" />;
    else if (item.dueAt.getHours() >= 18) urgency = <Pill label="Ce soir" className="bg-secondary-fixed text-on-secondary-container" />;
  }

  return (
    <RdvCard>
      <div className="flex items-start gap-3">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${color}`}>
          <Icon name={icon} className="text-[22px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <PetAvatar name={item.petName} size={18} badge={false} />
            <span className="text-[12px] text-on-surface-variant">
              {item.petBreed ? `${item.petName} • ${item.petBreed}` : item.petName}
            </span>
            <TypeTag label={tag} className="bg-surface-container text-on-surface-variant" />
          </div>
          <p className="mt-1.5 truncate font-label-lg text-[16px]">{item.title}</p>
          {item.description && <p className="line-clamp-2 text-[13px] text-on-surface-variant">{item.description}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {emphasize ? (
            <p className="text-[15px] font-bold text-secondary">{formatTime(item.dueAt)}</p>
          ) : (
            <>
              <p className="font-label-lg text-[13px]">{formatShortDayMonth(item.dueAt)}</p>
              <p className="text-[12px] text-on-surface-variant">{formatTime(item.dueAt)}</p>
            </>
          )}
          {urgency}
        </div>
      </div>
      <div className="mt-3.5 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          {item.appointment ? (
            <Link
              href={`/rendez-vous/${item.appointment.id}`}
              className="inline-flex items-center gap-1.5 font-label-lg text-label-lg text-primary hover:underline"
            >
              <Icon name="pin_drop" className="text-[18px]" />
              Voir RDV &amp; plan
            </Link>
          ) : (
            detail && (
              <p className="flex items-center gap-1.5 text-[13px] text-outline">
                <Icon name="info" className="text-[16px] text-outline-variant" />
                <span className="truncate">{detail}</span>
              </p>
            )
          )}
        </div>
        {emphasize ? (
          <SoftButton label="Fait" icon="check_circle" tone="solid" onClick={onToggle} className="rounded-full px-4" />
        ) : (
          <SoftButton label="Fait" icon="check" tone="primary" onClick={onToggle} className="w-[92px]" />
        )}
      </div>
    </RdvCard>
  );
}

function DoneSection({
  items,
  todayCount,
  onUndo,
  onDelete,
}: {
  items: Item[];
  todayCount: number;
  onUndo: (item: Item) => void;
  onDelete: (item: Item) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl bg-surface-container-low px-3.5 py-1.5">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2.5 py-2 text-left">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
          <Icon name="check" className="text-[16px]" />
        </span>
        <span className="flex-1 font-label-lg text-label-lg">
          {todayCount === 1 ? "1 rappel terminé aujourd'hui" : `${todayCount} rappels terminés aujourd'hui`}
        </span>
        <Icon name={open ? "expand_less" : "expand_more"} className="text-on-surface-variant" />
      </button>
      {open && (
        <ul className="flex flex-col pb-2">
          {items.map((item) => (
            <li key={item.key} className="flex items-center gap-3 border-t border-outline-variant/40 py-2.5">
              <Icon name="check_circle" filled className="text-primary-container" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-label-lg text-label-lg">
                  {item.title} – {item.petName}
                </p>
                <p className="text-[13px] text-on-surface-variant">
                  {item.doneAt ? `Complété le ${formatDayMonth(item.doneAt)} à ${formatTime(item.doneAt)}` : "Terminé"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onUndo(item)}
                className="rounded-lg px-2 py-1 font-label-lg text-label-lg text-primary hover:bg-surface-container"
              >
                Annuler
              </button>
              {item.reminder && (
                <button
                  type="button"
                  onClick={() => onDelete(item)}
                  title="Supprimer le rappel"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-error-container/50 hover:text-error"
                >
                  <Icon name="delete" className="text-[18px]" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Formulaire « Nouveau rappel ». Recréé à chaque ouverture : il repart toujours de zéro. */
function NewReminderDialog({
  open,
  knownPets,
  onClose,
  onCreated,
}: {
  open: boolean;
  knownPets: string[];
  onClose: () => void;
  onCreated: () => void;
}) {
  return (
    <Dialog open={open} title="Nouveau rappel" onClose={onClose} wide>
      <NewReminderForm knownPets={knownPets} onCreated={onCreated} />
    </Dialog>
  );
}

function NewReminderForm({ knownPets, onCreated }: { knownPets: string[]; onCreated: () => void }) {
  const [petName, setPetName] = useState("");
  const [category, setCategory] = useState<ReminderCategory>("medicament");
  const [title, setTitle] = useState("");
  const [dayOffset, setDayOffset] = useState(0);
  const [time, setTime] = useState(() => {
    const inOneHour = new Date(Date.now() + 3_600_000);
    return `${String(inOneHour.getHours()).padStart(2, "0")}:${String(inOneHour.getMinutes()).padStart(2, "0")}`;
  });
  const [description, setDescription] = useState("");
  const [detail, setDetail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = dayOnly(new Date());
  const inputClass =
    "h-11 w-full rounded-lg bg-surface-container-low px-3.5 placeholder:text-outline focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setError(null);
    if (!petName.trim() || !title.trim()) return;
    const [hours, minutes] = time.split(":").map(Number);
    const day = addDays(today, dayOffset);
    try {
      await createReminder({
        petName,
        title,
        description,
        detail,
        category,
        dueAt: new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes),
      });
      onCreated();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-4">
      <div>
        <FieldLabel required htmlFor="rappel-animal">
          Animal concerné
        </FieldLabel>
        <div className="mb-2 flex flex-wrap gap-2">
          {knownPets.map((name) => (
            <Chip key={name} label={name} selected={petName === name} onClick={() => setPetName(name)} />
          ))}
        </div>
        <input
          id="rappel-animal"
          value={petName}
          onChange={(e) => setPetName(e.target.value)}
          maxLength={80}
          placeholder="Nom de l'animal"
          className={inputClass}
        />
        {submitted && !petName.trim() && <FieldError>Indiquez l&apos;animal concerné.</FieldError>}
      </div>

      <div>
        <FieldLabel required>Type de rappel</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(REMINDER_CATEGORY_LABELS) as ReminderCategory[]).map((c) => (
            <Chip key={c} label={REMINDER_CATEGORY_LABELS[c]} selected={category === c} onClick={() => setCategory(c)} />
          ))}
        </div>
      </div>

      <div>
        <FieldLabel required htmlFor="rappel-titre">
          Intitulé
        </FieldLabel>
        <input
          id="rappel-titre"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Ex. Vermifuge Milbemax"
          className={inputClass}
        />
        {submitted && !title.trim() && <FieldError>L&apos;intitulé est obligatoire.</FieldError>}
      </div>

      <div>
        <FieldLabel required>Quand</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2].map((i) => (
            <Chip
              key={i}
              label={i === 0 ? "Aujourd'hui" : i === 1 ? "Demain" : formatDayMonth(addDays(today, i))}
              selected={dayOffset === i}
              onClick={() => setDayOffset(i)}
            />
          ))}
          <label className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/60 bg-white px-3">
            <Icon name="schedule" className="text-[18px] text-on-surface-variant" />
            <span className="sr-only">Heure</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required className="h-9 bg-transparent focus:outline-none" />
          </label>
        </div>
      </div>

      <div>
        <FieldLabel htmlFor="rappel-consigne">Consigne</FieldLabel>
        <textarea
          id="rappel-consigne"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={300}
          rows={2}
          placeholder="Ex. Comprimé à donner pendant le repas du soir."
          className="w-full resize-none rounded-lg bg-surface-container-low p-3 placeholder:text-outline focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div>
        <FieldLabel htmlFor="rappel-detail">Détail</FieldLabel>
        <input
          id="rappel-detail"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          maxLength={60}
          placeholder="Ex. 1 comprimé"
          className={inputClass}
        />
      </div>

      {error && <FieldError>{error}</FieldError>}
      <SoftButton label="Enregistrer le rappel" icon="check_circle" tone="solid" type="submit" className="h-12" />
    </form>
  );
}
