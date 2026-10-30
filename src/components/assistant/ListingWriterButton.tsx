"use client";

import { useState } from "react";
import { Dialog } from "@/components/adoption/Dialog";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { ListingInput } from "@/lib/adoption";
import { AssistantError, countMessage, writeListingDescription } from "@/lib/assistant/service";

/** « ✨ Rédiger avec l'IA » (maquette Stitch W4) : propose une description à partir du formulaire. */
export function ListingWriterButton({ form, onUse }: { form: ListingInput; onUse: (text: string) => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    setError("");
    setText("");
    try {
      if (user) await countMessage(user.uid);
      setText(await writeListingDescription(form));
    } catch (err) {
      setError(err instanceof AssistantError ? err.message : "L'IA n'a pas pu rédiger de description. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  function start() {
    if (!form.name.trim()) {
      setError("Indiquez d'abord le nom de l'animal.");
      setText("");
      setOpen(true);
      return;
    }
    setOpen(true);
    void generate();
  }

  return (
    <>
      <button
        type="button"
        onClick={start}
        className="self-start inline-flex items-center gap-1 h-9 px-space-md rounded-full ring-1 ring-primary/40 text-primary font-label-md text-label-md hover:bg-primary-fixed/30 transition-colors"
      >
        ✨ Rédiger avec l&apos;IA
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="✨ Description proposée">
        <div className="min-h-32 rounded-2xl bg-surface-container-low p-space-md font-body-md text-body-md whitespace-pre-wrap">
          {loading ? (
            <span className="flex items-center gap-space-sm text-on-surface-variant">
              <Icon name="progress_activity" className="animate-spin text-primary" />
              L&apos;IA rédige…
            </span>
          ) : error ? (
            <span className="text-error">{error}</span>
          ) : (
            text
          )}
        </div>
        <p className="-mt-space-sm font-body-sm text-body-sm text-on-surface-variant">Relisez et modifiez le texte avant de publier.</p>
        <div className="flex flex-wrap justify-end gap-space-sm">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button type="button" variant="secondary" onClick={generate} disabled={loading || !form.name.trim()}>
            Régénérer
          </Button>
          <Button
            type="button"
            disabled={loading || !text}
            onClick={() => {
              onUse(text);
              setOpen(false);
            }}
          >
            Utiliser ce texte
          </Button>
        </div>
      </Dialog>
    </>
  );
}
