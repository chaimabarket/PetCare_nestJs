"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { TextField } from "@/components/ui/TextField";
import { MAX_CONTACTS, patchPet, validateContacts, type Pet, type PetContactInput } from "@/lib/pets";
import { errorMessage } from "@/lib/users";

const EMPTY: PetContactInput = { name: "", detail: "", phone: "", emergency: false };
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

/** Contacts utiles de l'animal (5 maximum) : garde, voisin, éleveur… avec bouton d'appel. */
export function PetContacts({ pet, editable, onChange }: { pet: Pet; editable: boolean; onChange: (pet: Pet) => void }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<PetContactInput>(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(contacts: PetContactInput[]) {
    const { error: invalid } = validateContacts(contacts);
    if (invalid) {
      setError(invalid);
      return false;
    }
    setBusy(true);
    setError("");
    try {
      onChange(await patchPet(pet.id, { contacts }));
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (await save([...pet.contacts, draft])) {
      setDraft(EMPTY);
      setAdding(false);
    }
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Supprimer le contact ${name} ?`)) return;
    await save(pet.contacts.filter((c) => c.id !== id));
  }

  return (
    <section className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-md">
      <div className="flex items-center justify-between gap-space-sm pb-space-sm border-b border-surface-container">
        <h2 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
          <Icon name="contacts" className="text-primary text-[22px]" />
          Contacts utiles
        </h2>
        <span className="font-label-sm text-label-sm text-on-surface-variant">
          {pet.contacts.length} / {MAX_CONTACTS}
        </span>
      </div>

      {pet.contacts.length === 0 && !adding && (
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Ajoutez les personnes à prévenir : garde, voisin, éleveur, refuge…
        </p>
      )}

      <ul className="flex flex-col gap-space-sm">
        {pet.contacts.map((c) => (
          <li key={c.id} className="flex items-start gap-space-md bg-surface-container-low/70 p-3.5 rounded-xl">
            <span
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                c.emergency ? "bg-error-container text-on-error-container" : "bg-primary/10 text-primary"
              }`}
            >
              <Icon name={c.emergency ? "emergency" : "person"} className="text-[20px]" />
            </span>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-label-lg text-label-lg text-on-surface font-semibold truncate flex items-center gap-2">
                {c.name}
                {c.emergency && (
                  <span className="font-label-sm text-label-sm text-error bg-error-container/50 px-2 py-0.5 rounded-full">Urgence</span>
                )}
              </span>
              {c.detail && <span className="text-body-sm text-on-surface-variant truncate">{c.detail}</span>}
              <span className="text-body-sm text-outline">{c.phone}</span>
            </div>
            <a
              href={telHref(c.phone)}
              title={`Appeler ${c.name}`}
              aria-label={`Appeler ${c.name}`}
              className="w-9 h-9 rounded-full bg-surface-container-lowest text-primary flex items-center justify-center shadow-sm hover:bg-primary hover:text-on-primary transition-all shrink-0"
            >
              <Icon name="call" className="text-[18px]" />
            </a>
            {editable && (
              <button
                type="button"
                onClick={() => remove(c.id, c.name)}
                disabled={busy}
                aria-label={`Supprimer ${c.name}`}
                title="Supprimer"
                className="w-9 h-9 rounded-full text-on-surface-variant hover:text-error hover:bg-error-container/40 flex items-center justify-center transition-colors shrink-0"
              >
                <Icon name="delete" className="text-[18px]" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {adding && (
        <div className="flex flex-col gap-space-md bg-surface-container-low/60 rounded-xl p-space-md">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
            <TextField label="Nom *" maxLength={80} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <TextField
              label="Téléphone *"
              type="tel"
              maxLength={20}
              placeholder="+216 20 000 000"
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            />
          </div>
          <TextField
            label="Précision"
            hint="Facultatif"
            maxLength={120}
            placeholder="Ex : garde pendant les vacances, voisine…"
            value={draft.detail}
            onChange={(e) => setDraft({ ...draft, detail: e.target.value })}
          />
          <label className="inline-flex items-center gap-space-sm cursor-pointer self-start">
            <input
              type="checkbox"
              checked={draft.emergency}
              onChange={(e) => setDraft({ ...draft, emergency: e.target.checked })}
              className="w-4 h-4 rounded accent-primary"
            />
            <span className="font-body-sm text-body-sm text-on-surface">Contact d&apos;urgence</span>
          </label>
          <div className="flex justify-end gap-space-sm">
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setError("");
              }}
              className="h-10 px-space-md rounded-full bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={add}
              disabled={busy}
              className="h-10 px-space-lg rounded-full bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container disabled:opacity-70"
            >
              {busy ? "Enregistrement…" : "Ajouter le contact"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}

      {editable && !adding && pet.contacts.length < MAX_CONTACTS && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="self-start inline-flex items-center gap-1.5 h-10 px-space-md rounded-full text-primary hover:bg-primary/10 font-label-md text-label-md transition-colors"
        >
          <Icon name="person_add" className="text-[18px]" />
          Ajouter un contact
        </button>
      )}
    </section>
  );
}
