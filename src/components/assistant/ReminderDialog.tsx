"use client";

import { useState } from "react";
import { Dialog } from "@/components/adoption/Dialog";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import type { ReminderSuggestion } from "@/lib/assistant/parser";
import type { AssistantPet } from "@/lib/assistant/pets";
import { isoDay } from "@/lib/assistant/prompt";
import { createReminder, guessReminderCategory, REMINDER_CATEGORIES, type ReminderCategory } from "@/lib/assistant/reminders";
import { keysOf } from "@/lib/adoption";

/** Fenêtre « Créer un rappel » préremplie par l'assistant ; l'utilisateur confirme. */
export function ReminderDialog({
  suggestion,
  pet,
  ownerId,
  onClose,
  onCreated,
}: {
  suggestion: ReminderSuggestion;
  pet: AssistantPet;
  ownerId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const today = new Date();
  const [title, setTitle] = useState(suggestion.title);
  const [date, setDate] = useState(isoDay(suggestion.dueAt));
  const [category, setCategory] = useState<ReminderCategory>(guessReminderCategory(suggestion.title));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    const [y, m, d] = date.split("-").map(Number);
    if (!title.trim()) return setError("L'intitulé est obligatoire.");
    if (!y || !m || !d) return setError("Choisissez une date.");
    setSaving(true);
    setError("");
    try {
      await createReminder({
        ownerId,
        petName: pet.name,
        petBreed: pet.breed,
        title,
        category,
        dueAt: new Date(y, m - 1, d, 9),
      });
      onCreated();
    } catch (err) {
      console.error("Rappel non créé :", err);
      setError("Le rappel n'a pas pu être créé. Vérifiez votre connexion.");
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title="⏰ Créer un rappel">
      <p className="-mt-space-sm font-body-md text-body-md text-on-surface-variant">
        Pour {pet.name} · visible dans « Rappels de soins ».
      </p>
      <TextField label="Intitulé" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
      <TextField
        label="Date"
        type="date"
        value={date}
        min={isoDay(today)}
        max={isoDay(new Date(today.getTime() + 731 * 86_400_000))}
        onChange={(e) => setDate(e.target.value)}
      />
      <label className="flex flex-col gap-space-xs">
        <span className="font-label-lg text-label-lg text-on-surface">Catégorie</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ReminderCategory)}
          className="h-12 rounded-lg bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {keysOf(REMINDER_CATEGORIES).map((c) => (
            <option key={c} value={c}>
              {REMINDER_CATEGORIES[c]}
            </option>
          ))}
        </select>
      </label>
      {error && <Alert>{error}</Alert>}
      <div className="flex justify-end gap-space-sm">
        <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
          Annuler
        </Button>
        <Button type="button" onClick={save} loading={saving}>
          Créer le rappel
        </Button>
      </div>
    </Dialog>
  );
}
