"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { ArchiveDialog } from "@/components/pets/ArchiveDialog";
import { exportPetSheet } from "@/components/pets/export";
import { PetContacts } from "@/components/pets/PetContacts";
import { PetGallery } from "@/components/pets/PetGallery";
import { Breadcrumb, COMING_SOON, ErrorState, LINKED_MODULES, LoadingState, StatusBadge, useLoad } from "@/components/pets/ui";
import { Icon } from "@/components/ui/Icon";
import {
  ageLabel,
  formatChip,
  formatDay,
  getPet,
  listWeights,
  localDay,
  maskChip,
  NOTES_MAX_LENGTH,
  patchPet,
  PET_ROUTES,
  restorePet,
  SEX_INFO,
  shareText,
  speciesLine,
  type Pet,
} from "@/lib/pets";
import { errorMessage } from "@/lib/users";

export function PetDetail({ id }: { id: string }) {
  return (
    <RequireAuth>
      <PetDetailContent id={id} />
    </RequireAuth>
  );
}

function PetDetailContent({ id }: { id: string }) {
  const load = useCallback(() => getPet(id), [id]);
  const { data: pet, error, loading, reload, replace } = useLoad(load);
  const [archiving, setArchiving] = useState(false);
  const [notice, setNotice] = useState("");
  const today = localDay();

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  if (loading && !pet) return <LoadingState />;
  if (error || !pet) {
    return (
      <div className="max-w-7xl mx-auto w-full px-margin md:px-margin-md lg:px-margin-lg py-space-xl flex flex-col gap-space-lg">
        <Breadcrumb items={[{ label: "Mes animaux", href: PET_ROUTES.list }, { label: "Fiche" }]} />
        <ErrorState message={error ?? "Animal introuvable."} onRetry={reload} />
      </div>
    );
  }

  const editable = pet.status !== "archived";

  async function share(current: Pet) {
    const text = shareText(current, today);
    try {
      if (navigator.share) await navigator.share({ title: current.name, text });
      else {
        await navigator.clipboard.writeText(text);
        setNotice("Présentation copiée : collez-la où vous voulez.");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setNotice("Partage impossible sur ce navigateur.");
    }
  }

  async function exportSheet(current: Pet) {
    try {
      const weights = await listWeights(current.id);
      if (!exportPetSheet(current, weights, today)) setNotice("Autorisez les fenêtres pop-up pour exporter la fiche.");
    } catch (e) {
      setNotice(errorMessage(e));
    }
  }

  async function restore(current: Pet) {
    try {
      replace(await restorePet(current.id));
      setNotice(`${current.name} est de nouveau dans vos animaux actifs.`);
    } catch (e) {
      setNotice(errorMessage(e));
    }
  }

  return (
    <div className="max-w-7xl mx-auto w-full px-margin md:px-margin-md lg:px-margin-lg py-space-md lg:py-space-xl flex flex-col gap-space-lg">
      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <Breadcrumb items={[{ label: "Mes animaux", href: PET_ROUTES.list }, { label: pet.name }]} />
        <span className="font-body-sm text-body-sm text-on-surface-variant">
          Dernière mise à jour : {new Date(pet.updatedAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
        </span>
      </div>

      {pet.status === "archived" && (
        <Banner icon="inventory_2" tone="grey">
          <span className="flex-1">
            Fiche archivée{pet.archivedAt ? ` le ${new Date(pet.archivedAt).toLocaleDateString("fr-FR", { dateStyle: "long" })}` : ""}
            {pet.archivedReason ? ` — ${pet.archivedReason}` : ""}. Elle reste consultable mais ne peut plus être modifiée.
          </span>
          <button
            type="button"
            onClick={() => restore(pet)}
            className="h-10 px-space-md rounded-full bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container shrink-0"
          >
            Restaurer la fiche
          </button>
        </Banner>
      )}
      {pet.status === "draft" && (
        <Banner icon="drafts" tone="amber">
          <span className="flex-1">Cette fiche est un brouillon : complétez-la pour la rendre active.</span>
          <Link
            href={PET_ROUTES.edit(pet.id)}
            className="h-10 px-space-md rounded-full bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container shrink-0 inline-flex items-center"
          >
            Compléter la fiche
          </Link>
        </Banner>
      )}
      {notice && (
        <p role="status" className="bg-inverse-surface text-inverse-on-surface rounded-xl px-space-md py-space-sm font-body-sm text-body-sm self-start">
          {notice}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-md items-start">
        {/* Colonne gauche : photos, identité, contacts */}
        <section className="lg:col-span-5 flex flex-col gap-space-lg">
          <PetGallery pet={pet} editable={editable} onChange={replace} />
          <IdentityCard pet={pet} onCopied={() => setNotice("Numéro de puce copié.")} />
          <PetContacts pet={pet} editable={editable} onChange={replace} />
        </section>

        {/* Colonne droite : en-tête, notes, poids, autres modules */}
        <section className="lg:col-span-7 flex flex-col gap-space-lg">
          <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md pb-space-sm border-b border-surface-container">
              <div className="flex items-center gap-space-md min-w-0">
                <div className="relative shrink-0">
                  <div className="w-14 h-14 rounded-2xl bg-secondary-fixed flex items-center justify-center text-secondary font-bold text-headline-lg shadow-inner">
                    {pet.name[0]?.toUpperCase()}
                  </div>
                  {pet.sex && (
                    <span
                      title={SEX_INFO[pet.sex].label}
                      className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[13px] font-bold ring-2 ring-white ${
                        pet.sex === "male" ? "bg-blue-100 text-blue-700" : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {pet.sex === "male" ? "♂" : "♀"}
                    </span>
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-space-sm flex-wrap">
                    <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface tracking-tight leading-none break-words">
                      {pet.name}
                    </h1>
                    <span className="px-3 py-1 rounded-full bg-surface-container-high font-label-md text-label-md text-on-surface">
                      {speciesLine(pet)}
                    </span>
                  </div>
                  <p className="text-body-md text-on-surface-variant mt-1">
                    {[pet.sex && SEX_INFO[pet.sex].label, ageLabel(pet.birthDate, today)].filter(Boolean).join(" · ") || "Âge non renseigné"}
                  </p>
                </div>
              </div>
              <PetMenu
                pet={pet}
                editable={editable}
                onShare={() => share(pet)}
                onExport={() => exportSheet(pet)}
                onArchive={() => setArchiving(true)}
                onRestore={() => restore(pet)}
              />
            </div>

            <dl className="grid grid-cols-2 md:grid-cols-3 gap-space-md">
              <Fact label="Espèce">{speciesLine(pet)}</Fact>
              <Fact label="Sexe & statut">
                {[pet.sex && SEX_INFO[pet.sex].label, pet.sterilized ? "stérilisé" : "non stérilisé"].filter(Boolean).join(", ")}
              </Fact>
              <Fact label="Date de naissance">
                {pet.birthDate ? (
                  <>
                    {formatDay(pet.birthDate)}
                    {pet.birthDateEstimated && <span className="block text-body-sm text-on-surface-variant">(estimée)</span>}
                  </>
                ) : (
                  "—"
                )}
              </Fact>
              <Fact label="Âge">{ageLabel(pet.birthDate, today) || "—"}</Fact>
              <Fact label="Poids">
                {pet.latestWeight ? `${pet.latestWeight.kg.toLocaleString("fr-FR")} kg` : "—"}
              </Fact>
              <Fact label="Puce">{pet.chipNumber ? maskChip(pet.chipNumber) : "—"}</Fact>
            </dl>

            <Notes pet={pet} editable={editable} onChange={replace} />
          </div>

          <div id="poids" className="scroll-mt-24" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
            <ModuleCard
              icon="menu_book"
              title="Carnet de santé"
              text="Vaccins, consultations, traitements et allergies."
              href={LINKED_MODULES.health?.(pet.id)}
              action="Voir le carnet"
            />
            <ModuleCard
              icon="calendar_month"
              title="Rendez-vous"
              text="Prochaines consultations et réservations de services."
              href={LINKED_MODULES.appointments?.(pet.id)}
              action="Prendre rendez-vous"
            />
            <ModuleCard
              icon="alarm"
              title="Rappels"
              text="Vermifuge, antiparasitaire, soins réguliers."
              href={LINKED_MODULES.reminders?.(pet.id)}
              action="Voir les rappels"
            />
            <ModuleCard
              icon="tips_and_updates"
              title="Conseils"
              text={`Posez vos questions à l'assistant PetCare au sujet de ${pet.name}.`}
              href={LINKED_MODULES.assistant?.(pet.id) ?? undefined}
              action="Demander conseil"
            />
          </div>
        </section>
      </div>

      {archiving && (
        <ArchiveDialog
          pet={pet}
          onClose={() => setArchiving(false)}
          onArchived={(updated) => {
            replace(updated);
            setArchiving(false);
            setNotice(`${updated.name} a été archivé. Sa fiche reste consultable.`);
          }}
        />
      )}
    </div>
  );
}

function Banner({ icon, tone, children }: { icon: string; tone: "grey" | "amber"; children: ReactNode }) {
  const tones = { grey: "bg-surface-container text-on-surface", amber: "bg-amber-50 text-amber-900" };
  return (
    <div className={`rounded-2xl p-space-md flex flex-col sm:flex-row sm:items-center gap-space-md ${tones[tone]}`}>
      <Icon name={icon} className="text-[24px] shrink-0" />
      {children}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <dt className="font-label-sm text-label-sm text-on-surface-variant">{label}</dt>
      <dd className="font-label-lg text-label-lg text-on-surface break-words">{children}</dd>
    </div>
  );
}

/** Actions de la fiche : modifier, partager, exporter, archiver / restaurer. */
function PetMenu({
  pet,
  editable,
  onShare,
  onExport,
  onArchive,
  onRestore,
}: {
  pet: Pet;
  editable: boolean;
  onShare: () => void;
  onExport: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !wrapper.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const item = "w-full px-4 py-2 text-left font-body-sm text-body-sm hover:bg-surface-container-low flex items-center gap-2.5 transition-colors";
  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div className="flex items-center gap-space-xs self-start sm:self-center">
      {editable && (
        <Link
          href={PET_ROUTES.edit(pet.id)}
          className="inline-flex items-center gap-1.5 px-4 h-10 rounded-full bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md transition-colors"
        >
          <Icon name="edit" className="text-[18px]" />
          Modifier
        </Link>
      )}
      <div ref={wrapper} className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Plus d'actions"
          onClick={() => setOpen((o) => !o)}
          className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
        >
          <Icon name="more_vert" className="text-[22px]" />
        </button>
        {open && (
          <div role="menu" className="absolute right-0 mt-2 w-60 rounded-xl bg-surface-container-lowest shadow-xl border border-black/[0.08] py-1.5 z-20">
            <button type="button" role="menuitem" onClick={run(onShare)} className={`${item} text-on-surface`}>
              <Icon name="share" className="text-[18px] text-primary" />
              Partager (nom, espèce, âge)
            </button>
            <button type="button" role="menuitem" onClick={run(onExport)} className={`${item} text-on-surface`}>
              <Icon name="download" className="text-[18px] text-outline" />
              Exporter la fiche (PDF)
            </button>
            <div className="h-px bg-surface-container my-1" />
            {editable ? (
              <button type="button" role="menuitem" onClick={run(onArchive)} className={`${item} text-error hover:bg-error-container/40`}>
                <Icon name="archive" className="text-[18px]" />
                Archiver la fiche
              </button>
            ) : (
              <button type="button" role="menuitem" onClick={run(onRestore)} className={`${item} text-primary`}>
                <Icon name="unarchive" className="text-[18px]" />
                Restaurer la fiche
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Carte d'identité : puce tronquée (affichable et copiable), statuts, vétérinaire référent. */
function IdentityCard({ pet, onCopied }: { pet: Pet; onCopied: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const vet = pet.vet;
  const hasVet = Object.values(vet).some(Boolean);
  const statusLabel = { active: "Actif", draft: "Brouillon", archived: "Archivé" }[pet.status];

  return (
    <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-md">
      <div className="flex items-center justify-between pb-space-sm border-b border-surface-container">
        <h2 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
          <Icon name="badge" className="text-primary text-[22px]" />
          Carte d&apos;identité &amp; statut
        </h2>
        <StatusBadge tone={pet.status === "active" ? "green" : pet.status === "draft" ? "amber" : "grey"}>{statusLabel}</StatusBadge>
      </div>

      <div className="bg-surface-container-low rounded-xl p-space-md flex flex-col gap-2">
        <div className="flex items-center justify-between text-body-sm text-on-surface-variant font-medium">
          <span className="flex items-center gap-1.5">
            <Icon name="nfc" className="text-[18px] text-primary" />
            Puce électronique
          </span>
          {pet.chipNumber && (
            <span className="flex items-center gap-space-sm">
              <button type="button" onClick={() => setRevealed((r) => !r)} className="text-primary hover:underline font-label-sm flex items-center gap-1">
                <Icon name={revealed ? "visibility_off" : "visibility"} className="text-[14px]" />
                {revealed ? "Masquer" : "Afficher"}
              </button>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(pet.chipNumber).then(onCopied)}
                className="text-primary hover:underline font-label-sm flex items-center gap-1"
              >
                <Icon name="content_copy" className="text-[14px]" />
                Copier
              </button>
            </span>
          )}
        </div>
        <div className="font-mono text-body-lg text-on-surface font-bold tracking-wider">
          {pet.chipNumber ? (revealed ? formatChip(pet.chipNumber) : maskChip(pet.chipNumber)) : "Non renseignée"}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-label-md text-label-md ${
            pet.sterilized ? "bg-emerald-50 text-emerald-700" : "bg-surface-container text-on-surface-variant"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${pet.sterilized ? "bg-emerald-500" : "bg-outline"}`} />
          {pet.sterilized ? "Stérilisé" : "Non stérilisé"}
        </span>
        {pet.favorite && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 text-rose-700 font-label-md text-label-md">
            <Icon name="favorite" filled className="text-[16px]" />
            Favori
          </span>
        )}
      </div>

      <div className="pt-space-xs flex flex-col gap-2">
        <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Vétérinaire référent</span>
        {hasVet ? (
          <div className="flex items-start gap-space-md bg-surface-container-low/70 p-3.5 rounded-xl">
            <span className="w-10 h-10 rounded-full bg-primary-container text-white flex items-center justify-center shrink-0">
              <Icon name="stethoscope" className="text-[22px]" />
            </span>
            <div className="flex flex-col min-w-0 flex-1">
              {vet.name && <span className="font-label-lg text-label-lg text-on-surface font-semibold truncate">{vet.name}</span>}
              {vet.clinic && <span className="text-body-sm text-on-surface-variant truncate">{vet.clinic}</span>}
              {vet.address && (
                <span className="text-body-sm text-outline flex items-center gap-1 mt-0.5">
                  <Icon name="location_on" className="text-[14px]" />
                  {vet.address}
                </span>
              )}
            </div>
            {vet.phone && (
              <a
                href={`tel:${vet.phone.replace(/[^\d+]/g, "")}`}
                title="Appeler le vétérinaire"
                aria-label="Appeler le vétérinaire"
                className="w-9 h-9 rounded-full bg-white text-primary flex items-center justify-center shadow-sm hover:bg-primary hover:text-white transition-all shrink-0"
              >
                <Icon name="call" className="text-[18px]" />
              </a>
            )}
          </div>
        ) : (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Aucun vétérinaire renseigné.{" "}
            {pet.status !== "archived" && (
              <Link href={PET_ROUTES.edit(pet.id)} className="text-primary hover:underline">
                Ajouter
              </Link>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

/** Notes modifiables directement sur la fiche. */
function Notes({ pet, editable, onChange }: { pet: Pet; editable: boolean; onChange: (pet: Pet) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(pet.notes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    try {
      onChange(await patchPet(pet.id, { notes: text }));
      setEditing(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-surface-container-low rounded-xl p-space-md flex items-start gap-space-md">
      <span className="w-10 h-10 rounded-full bg-secondary-fixed text-secondary flex items-center justify-center shrink-0">
        <Icon name="lightbulb" className="text-[20px]" />
      </span>
      <div className="flex flex-col gap-space-xs flex-1 min-w-0">
        <div className="flex items-center justify-between gap-space-sm">
          <span className="font-label-md text-label-md text-secondary font-semibold">Notes &amp; particularités de {pet.name}</span>
          {editable && !editing && (
            <button
              type="button"
              onClick={() => {
                setText(pet.notes);
                setEditing(true);
              }}
              className="text-primary hover:underline font-label-sm text-label-sm flex items-center gap-1"
            >
              <Icon name="edit" className="text-[14px]" />
              Modifier
            </button>
          )}
        </div>
        {editing ? (
          <>
            <textarea
              rows={4}
              maxLength={NOTES_MAX_LENGTH}
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label="Notes"
              className="w-full rounded-lg bg-surface-container-lowest p-3 font-body-md text-body-md resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <div className="flex items-center justify-between gap-space-sm">
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                {text.length} / {NOTES_MAX_LENGTH}
              </span>
              <span className="flex gap-space-sm">
                <button type="button" onClick={() => setEditing(false)} className="h-9 px-space-md rounded-full bg-surface-container font-label-md text-label-md">
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={busy}
                  className="h-9 px-space-md rounded-full bg-primary text-on-primary font-label-md text-label-md disabled:opacity-70"
                >
                  {busy ? "Enregistrement…" : "Enregistrer"}
                </button>
              </span>
            </div>
            {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
          </>
        ) : (
          <p className="font-body-md text-body-md text-on-surface whitespace-pre-line break-words">
            {pet.notes || <span className="text-on-surface-variant">Aucune note pour l&apos;instant.</span>}
          </p>
        )}
      </div>
    </div>
  );
}

/** Carte vers un autre module ; « Bientôt disponible » tant qu'il n'est pas fusionné. */
function ModuleCard({ icon, title, text, href, action }: { icon: string; title: string; text: string; href?: string | null; action: string }) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-md">
      <div className="flex items-center gap-space-sm">
        <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon name={icon} className="text-[22px]" />
        </span>
        <h2 className="font-headline-sm text-headline-sm text-on-surface">{title}</h2>
      </div>
      <p className="font-body-sm text-body-sm text-on-surface-variant flex-1">{text}</p>
      {href ? (
        <Link
          href={href}
          className="self-start inline-flex items-center gap-1 h-10 px-space-md rounded-full border border-primary text-primary font-label-md text-label-md hover:bg-primary/10"
        >
          {action}
          <Icon name="arrow_forward" className="text-[16px]" />
        </Link>
      ) : (
        <span className="self-start inline-flex items-center gap-1 h-10 px-space-md rounded-full bg-surface-container text-on-surface-variant font-label-md text-label-md">
          <Icon name="schedule" className="text-[16px]" />
          {COMING_SOON}
        </span>
      )}
    </div>
  );
}
