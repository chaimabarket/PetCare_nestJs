"use client";

import { useCallback, useState } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { Modal } from "@/components/pets/Modal";
import { Breadcrumb, CATEGORY_TONES, ErrorState, LoadingState, ProviderPhoto, categoryIcon, useLoad } from "@/components/services/ui";
import { Icon } from "@/components/ui/Icon";
import {
  CATEGORY_ICON_INFO,
  CATEGORY_ICONS,
  createCategory,
  deleteCategory,
  listCategories,
  listPendingProviders,
  REJECTION_REASON_MAX,
  SERVICES_ROUTES,
  setProviderStatus,
  updateCategory,
  validateCategory,
  type CategoryIcon,
  type ServiceCategory,
  type ServiceProvider,
} from "@/lib/services";
import { errorMessage } from "@/lib/users";

type Data = { pending: ServiceProvider[]; categories: ServiceCategory[] };

export default function ServicesAdminPage() {
  return (
    <RequireAuth roles={["admin"]}>
      <Admin />
    </RequireAuth>
  );
}

/** Administration du module : validation des profils prestataires et catégories de l'annuaire. */
function Admin() {
  const load = useCallback(async (): Promise<Data> => {
    const [pending, categories] = await Promise.all([listPendingProviders(), listCategories()]);
    return { pending, categories };
  }, []);
  const { data, error, loading, reload, replace } = useLoad<Data>(load);

  return (
    <div className="max-w-6xl mx-auto w-full px-margin md:px-margin-md lg:px-margin-lg py-space-xl flex flex-col gap-space-lg">
      <Breadcrumb items={[{ label: "Services", href: SERVICES_ROUTES.directory }, { label: "Administration" }]} />
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Administration des services</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">Validez les nouveaux prestataires et organisez les catégories de l&apos;annuaire.</p>
      </div>
      {loading && !data && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
          <PendingProviders
            data={data}
            onDone={(id) => replace({ ...data, pending: data.pending.filter((p) => p.id !== id) })}
          />
          <Categories categories={data.categories} onChange={(categories) => replace({ ...data, categories })} />
        </div>
      )}
    </div>
  );
}

function PendingProviders({ data, onDone }: { data: Data; onDone: (id: string) => void }) {
  const [rejecting, setRejecting] = useState<ServiceProvider | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function publish(p: ServiceProvider) {
    setBusy(p.id);
    setError("");
    try {
      await setProviderStatus(p.id, "published");
      onDone(p.id);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="lg:col-span-7 flex flex-col gap-space-md">
      <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
        <Icon name="how_to_reg" className="text-primary" />
        Profils à valider
        <span className="px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm">{data.pending.length}</span>
      </h2>
      {error && <p role="alert" className="font-body-sm text-body-sm text-error">{error}</p>}
      {data.pending.length === 0 && (
        <p className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm text-on-surface-variant flex items-center gap-2">
          <Icon name="task_alt" className="text-primary" />
          Aucun profil en attente : tout est à jour.
        </p>
      )}
      {data.pending.map((p) => (
        <article key={p.id} className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-md">
          <div className="flex items-start gap-space-md">
            <ProviderPhoto provider={p} icon={categoryIcon(data.categories, p.category)} className="w-16 h-16" />
            <div className="min-w-0 flex-1">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">{p.name}</h3>
              <p className="font-label-md text-label-md text-primary">{p.category}</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Envoyé le {new Date(p.updatedAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-body-sm text-body-sm">
            <div className="flex items-center gap-2"><Icon name="location_on" className="text-[16px] text-on-surface-variant" />{[p.address, p.city].filter(Boolean).join(", ")}</div>
            <div className="flex items-center gap-2"><Icon name="call" className="text-[16px] text-on-surface-variant" />{p.phone}</div>
            <div className="flex items-center gap-2 sm:col-span-2"><Icon name="mail" className="text-[16px] text-on-surface-variant" />{p.email}</div>
          </dl>
          {p.description && <p className="font-body-md text-body-md text-on-surface whitespace-pre-line">{p.description}</p>}
          <div className="flex justify-end gap-space-sm">
            <button type="button" onClick={() => setRejecting(p)} disabled={busy === p.id} className="h-11 px-5 rounded-xl bg-surface-container text-on-surface font-label-md text-label-md inline-flex items-center gap-1.5">
              <Icon name="close" className="text-[18px]" />
              Refuser
            </button>
            <button type="button" onClick={() => publish(p)} disabled={busy === p.id} className="h-11 px-5 rounded-xl bg-primary text-on-primary font-label-md text-label-md inline-flex items-center gap-1.5 hover:bg-primary-container disabled:opacity-60">
              <Icon name={busy === p.id ? "progress_activity" : "check"} className={`text-[18px] ${busy === p.id ? "animate-spin" : ""}`} />
              Valider
            </button>
          </div>
        </article>
      ))}
      {rejecting && (
        <RejectDialog
          provider={rejecting}
          onClose={() => setRejecting(null)}
          onRejected={() => {
            onDone(rejecting.id);
            setRejecting(null);
          }}
        />
      )}
    </section>
  );
}

function RejectDialog({ provider, onClose, onRejected }: { provider: ServiceProvider; onClose: () => void; onRejected: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function reject() {
    if (reason.trim().length < 3) {
      setError("Indiquez le motif : le prestataire pourra corriger son profil.");
      return;
    }
    setBusy(true);
    try {
      await setProviderStatus(provider.id, "rejected", reason.trim());
      onRejected();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Modal title={`Refuser « ${provider.name} »`} icon="block" onClose={onClose}>
      <p className="font-body-md text-body-md text-on-surface-variant mb-space-md">
        Le prestataire reçoit une notification avec ce motif. Une fois son profil corrigé, il repart en validation.
      </p>
      <textarea
        rows={3}
        maxLength={REJECTION_REASON_MAX}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        aria-label="Motif du refus"
        placeholder="Ex : adresse incomplète, photo non professionnelle…"
        className="w-full rounded-lg bg-surface-container-low p-3 font-body-md text-body-md resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      {error && <p role="alert" className="mt-2 font-body-sm text-body-sm text-error">{error}</p>}
      <div className="mt-space-md flex justify-end gap-space-sm">
        <button type="button" onClick={onClose} className="h-11 px-space-lg rounded-xl bg-surface-container font-label-md text-label-md">
          Annuler
        </button>
        <button type="button" onClick={reject} disabled={busy} className="h-11 px-space-lg rounded-xl bg-error text-on-error font-label-md text-label-md disabled:opacity-60">
          {busy ? "Envoi…" : "Refuser le profil"}
        </button>
      </div>
    </Modal>
  );
}

function Categories({ categories, onChange }: { categories: ServiceCategory[]; onChange: (c: ServiceCategory[]) => void }) {
  const [draft, setDraft] = useState<{ name: string; icon: CategoryIcon }>({ name: "", icon: "autre" });
  const [editing, setEditing] = useState<{ id: string; name: string; icon: CategoryIcon } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(action: () => Promise<ServiceCategory[]>) {
    setBusy(true);
    setError("");
    try {
      onChange(await action());
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    const { errors } = validateCategory(draft);
    if (errors.name || errors.icon) {
      setError(errors.name ?? errors.icon ?? "");
      return;
    }
    if (await run(() => createCategory(draft))) setDraft({ name: "", icon: "autre" });
  }

  /**
   * Déplace une catégorie d'un rang, puis renumérote toute la liste (0, 1, 2…). Chaque appel renvoie la liste
   * à jour : après l'enregistrement des catégories par défaut, leurs identifiants changent, on les retrouve par nom.
   */
  async function move(index: number, delta: number) {
    if (!categories[index + delta]) return;
    const wanted = [...categories];
    [wanted[index], wanted[index + delta]] = [wanted[index + delta], wanted[index]];
    await run(async () => {
      let current = categories;
      for (const [order, { name }] of wanted.entries()) {
        const c = current.find((x) => x.name === name)!;
        if (c.order !== order || c.id.startsWith("default-")) current = await updateCategory(c.id, { name: c.name, icon: c.icon, order });
      }
      return current;
    });
  }

  return (
    <section className="lg:col-span-5 bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-md">
      <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
        <Icon name="category" className="text-primary" />
        Catégories
      </h2>
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Ordre d&apos;affichage dans l&apos;annuaire. Une catégorie utilisée par des prestataires ne peut pas être supprimée : renommez-la.
      </p>
      <ul className="flex flex-col gap-2">
        {categories.map((c, i) => (
          <li key={c.id} className="rounded-xl bg-surface-container-low/70 p-2 flex items-center gap-2">
            <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${CATEGORY_TONES[c.icon]}`}>
              <Icon name={CATEGORY_ICON_INFO[c.icon].symbol} className="text-[20px]" />
            </span>
            {editing?.id === c.id ? (
              <>
                <input
                  value={editing.name}
                  maxLength={40}
                  aria-label="Nom de la catégorie"
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="flex-1 min-w-0 h-9 rounded-lg bg-surface-container-lowest px-2 font-body-md text-body-md"
                />
                <IconSelect value={editing.icon} onChange={(icon) => setEditing({ ...editing, icon })} />
                <button
                  type="button"
                  disabled={busy}
                  aria-label="Enregistrer"
                  onClick={async () => (await run(() => updateCategory(c.id, { name: editing.name, icon: editing.icon }))) && setEditing(null)}
                  className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center"
                >
                  <Icon name="check" className="text-[18px]" />
                </button>
                <button type="button" aria-label="Annuler" onClick={() => setEditing(null)} className="w-9 h-9 rounded-full text-on-surface-variant flex items-center justify-center">
                  <Icon name="close" className="text-[18px]" />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 min-w-0 font-label-lg text-label-lg text-on-surface truncate">{c.name}</span>
                <IconButton label="Monter" icon="arrow_upward" disabled={busy || i === 0} onClick={() => move(i, -1)} />
                <IconButton label="Descendre" icon="arrow_downward" disabled={busy || i === categories.length - 1} onClick={() => move(i, 1)} />
                <IconButton label="Modifier" icon="edit" disabled={busy} onClick={() => setEditing({ id: c.id, name: c.name, icon: c.icon })} />
                <IconButton
                  label="Supprimer"
                  icon="delete"
                  danger
                  disabled={busy}
                  onClick={() => window.confirm(`Supprimer la catégorie « ${c.name} » ?`) && run(() => deleteCategory(c.id))}
                />
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2 pt-space-sm border-t border-surface-container">
        <input
          value={draft.name}
          maxLength={40}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          aria-label="Nouvelle catégorie"
          placeholder="Nouvelle catégorie (ex : Éducateurs)"
          className="flex-1 min-w-0 h-11 rounded-lg bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <IconSelect value={draft.icon} onChange={(icon) => setDraft({ ...draft, icon })} />
        <button type="button" onClick={add} disabled={busy} className="h-11 px-4 rounded-xl bg-primary text-on-primary font-label-md text-label-md inline-flex items-center gap-1 disabled:opacity-60">
          <Icon name="add" className="text-[18px]" />
          Ajouter
        </button>
      </div>
      {error && <p role="alert" className="font-body-sm text-body-sm text-error">{error}</p>}
    </section>
  );
}

function IconSelect({ value, onChange }: { value: CategoryIcon; onChange: (icon: CategoryIcon) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as CategoryIcon)}
      aria-label="Icône"
      className="h-9 rounded-lg bg-surface-container-lowest px-2 font-body-sm text-body-sm"
    >
      {CATEGORY_ICONS.map((i) => (
        <option key={i} value={i}>
          {CATEGORY_ICON_INFO[i].label}
        </option>
      ))}
    </select>
  );
}

function IconButton({ label, icon, onClick, disabled, danger = false }: { label: string; icon: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-40 ${
        danger ? "text-on-surface-variant hover:text-error hover:bg-error-container/40" : "text-on-surface-variant hover:text-primary hover:bg-surface-container"
      }`}
    >
      <Icon name={icon} className="text-[18px]" />
    </button>
  );
}
