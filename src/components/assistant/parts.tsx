"use client";

import { useState } from "react";
import Link from "next/link";
import { Photo } from "@/components/adoption/ui";
import { Icon } from "@/components/ui/Icon";
import { ADOPTION_ROUTES, SPECIES, type AdoptionListing } from "@/lib/adoption";
import type { AnswerRating, AssistantMessage } from "@/lib/assistant/history";
import type { ReminderSuggestion } from "@/lib/assistant/parser";
import { petEmoji, type AssistantPet } from "@/lib/assistant/pets";
import { QUESTION_MAX_LENGTH, type Suggestion } from "@/lib/assistant/prompt";

const shortDate = (date: Date) => date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

export function AssistantAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "w-7 h-7 text-[16px]", md: "w-9 h-9 text-[20px]", lg: "w-20 h-20 text-[40px]" };
  return (
    <span className={`${sizes[size]} rounded-full bg-primary-fixed/50 text-primary flex items-center justify-center shrink-0`}>
      <Icon name="pets" filled className="text-[1em]" />
    </span>
  );
}

export function Disclaimer() {
  return (
    <p className="flex items-center gap-space-xs rounded-xl bg-amber-50 text-amber-900 px-space-sm py-space-xs font-body-sm text-body-sm">
      <Icon name="info" className="text-[18px] text-amber-700" />
      Je ne remplace pas un vétérinaire. N&apos;indiquez pas de données personnelles.
    </p>
  );
}

/** Choix du sujet : « Général » ou un animal de l'utilisateur (sa fiche et son carnet sont joints). */
export function PetSelector({
  pets,
  selected,
  onSelect,
  disabled,
}: {
  pets: AssistantPet[];
  selected: AssistantPet | null;
  onSelect: (pet: AssistantPet | null) => void;
  disabled?: boolean;
}) {
  const chip = (key: string, label: string, active: boolean, onClick: () => void) => (
    <button
      key={key}
      type="button"
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full font-label-md text-label-md shrink-0 transition-colors disabled:opacity-60 ${
        active ? "bg-primary-container text-on-primary shadow-sm" : "bg-surface-container-low text-on-surface hover:bg-surface-container"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-space-xs overflow-x-auto pb-1">
        {chip("general", "💬 Général", selected === null, () => onSelect(null))}
        {pets.map((p) => chip(p.id, `${petEmoji(p)} ${p.name}`, selected?.id === p.id, () => onSelect(p)))}
      </div>
      {selected && (
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Les infos et le carnet de santé de {selected.name} sont utilisés pour répondre.
        </p>
      )}
    </div>
  );
}

export function SuggestionList({ suggestions, onPick }: { suggestions: Suggestion[]; onPick: (s: Suggestion) => void }) {
  return (
    <div className="grid gap-space-xs sm:grid-cols-2">
      {suggestions.map((s) => (
        <button
          key={s.question}
          type="button"
          onClick={() => onPick(s)}
          className="flex items-center justify-between gap-space-sm text-left rounded-2xl bg-surface-container-lowest px-space-md py-space-sm shadow-sm ring-1 ring-outline-variant/40 hover:ring-primary/40 hover:shadow-md transition-all font-body-md text-body-md"
        >
          <span>{s.label}</span>
          <Icon name="north_east" className="text-[16px] text-primary shrink-0" />
        </button>
      ))}
    </div>
  );
}

export function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary-container text-on-primary px-space-md py-space-sm font-body-md text-body-md">
        {text}
      </p>
    </div>
  );
}

/** Réponse de l'assistant : texte, rappels proposés, cartes d'annonces et actions (copier, 👍 / 👎). */
export function AssistantBubble({
  message,
  listings = [],
  createdReminders,
  onCreateReminder,
  onRate,
  onRetry,
  writing = false,
}: {
  message: AssistantMessage;
  listings?: AdoptionListing[];
  createdReminders?: Set<string>;
  onCreateReminder?: (reminder: ReminderSuggestion) => void;
  onRate?: (rating: AnswerRating | null) => void;
  onRetry?: () => void;
  writing?: boolean;
}) {
  const urgent = message.text.startsWith("⚠️");
  const highlight = message.isError || urgent;
  return (
    <div className="flex gap-space-sm pr-space-lg">
      <AssistantAvatar size="sm" />
      <div className="flex flex-col gap-space-xs min-w-0 max-w-[85%]">
        <p
          className={`whitespace-pre-wrap rounded-2xl rounded-tl-md px-space-md py-space-sm font-body-md text-body-md shadow-sm ${
            message.isError ? "bg-error-container/40 text-error" : "bg-surface-container-lowest text-on-surface"
          } ${highlight ? "ring-2 ring-error/70" : "ring-1 ring-outline-variant/40"}`}
        >
          {message.text}
          {writing && <span className="animate-pulse"> ▍</span>}
        </p>
        {message.reminders?.map((r) => (
          <ReminderButton
            key={r.title}
            reminder={r}
            created={createdReminders?.has(r.title) ?? false}
            onClick={onCreateReminder ? () => onCreateReminder(r) : undefined}
          />
        ))}
        {listings.map((l) => (
          <ListingSuggestionCard key={l.id} listing={l} />
        ))}
        {listings.length > 0 && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            La décision finale revient au refuge ou au propriétaire de l&apos;annonce.
          </p>
        )}
        {onRetry && (
          <button type="button" onClick={onRetry} className="self-start inline-flex items-center gap-1 font-label-md text-label-md text-primary hover:underline">
            <Icon name="refresh" className="text-[18px]" />
            Réessayer
          </button>
        )}
        {!message.isError && !writing && <AnswerActions message={message} onRate={onRate} />}
      </div>
    </div>
  );
}

function AnswerActions({ message, onRate }: { message: AssistantMessage; onRate?: (rating: AnswerRating | null) => void }) {
  const [copied, setCopied] = useState(false);
  const action = (icon: string, label: string, active: boolean, onClick: () => void) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container transition-colors ${
        active ? "text-primary" : "text-on-surface-variant"
      }`}
    >
      <Icon name={icon} filled={active} className="text-[18px]" />
    </button>
  );
  return (
    <div className="flex items-center gap-1">
      {action(copied ? "check" : "content_copy", copied ? "Copié" : "Copier", false, async () => {
        await navigator.clipboard.writeText(message.text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })}
      {onRate && (
        <>
          {action("thumb_up", "Réponse utile", message.rating === "up", () => onRate(message.rating === "up" ? null : "up"))}
          {action("thumb_down", "Réponse peu utile", message.rating === "down", () =>
            onRate(message.rating === "down" ? null : "down"),
          )}
        </>
      )}
    </div>
  );
}

function ReminderButton({ reminder, created, onClick }: { reminder: ReminderSuggestion; created: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      disabled={created || !onClick}
      onClick={onClick}
      className={`flex items-center gap-space-sm rounded-2xl px-space-md py-space-sm text-left transition-colors ${
        created ? "bg-primary-fixed/40" : "bg-secondary-fixed/50 hover:bg-secondary-fixed"
      }`}
    >
      <Icon name={created ? "check_circle" : "alarm_add"} filled={created} className={`text-[22px] ${created ? "text-primary" : "text-[#E07A5F]"}`} />
      <span className="flex-1 min-w-0">
        <span className={`block font-label-md text-label-md ${created ? "text-primary" : "text-[#E07A5F]"}`}>
          {created ? "Rappel créé" : "Créer un rappel"}
        </span>
        <span className="block font-label-lg text-label-lg text-on-surface">
          {reminder.title} · {shortDate(reminder.dueAt)}
        </span>
      </span>
      {!created && <Icon name="chevron_right" className="text-[#E07A5F]" />}
    </button>
  );
}

export function ListingSuggestionCard({ listing }: { listing: AdoptionListing }) {
  return (
    <Link
      href={ADOPTION_ROUTES.listing(listing.id)}
      className="flex items-center gap-space-sm rounded-2xl bg-surface-container-lowest p-space-sm shadow-sm ring-1 ring-outline-variant/40 hover:ring-primary/40 hover:shadow-md transition-all"
    >
      <Photo src={listing.thumbnail || listing.photos[0]} alt={listing.name} className="w-16 h-16 rounded-xl shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block font-label-lg text-label-lg text-on-surface">{listing.name}</span>
        <span className="block font-body-sm text-body-sm text-on-surface-variant">
          {SPECIES[listing.species].label} · {listing.ageLabel}
        </span>
        <span className="flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant truncate">
          <Icon name="location_on" className="text-[14px]" />
          {listing.city}
        </span>
      </span>
      <span className="font-label-md text-label-md text-primary whitespace-nowrap">Voir la fiche</span>
      <Icon name="chevron_right" className="text-primary" />
    </Link>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-space-sm">
      <AssistantAvatar size="sm" />
      <Icon name="progress_activity" className="animate-spin text-[18px] text-primary" />
      <span className="font-body-sm text-body-sm text-on-surface-variant">L&apos;assistant écrit…</span>
    </div>
  );
}

export function InputBar({
  value,
  onChange,
  onSend,
  onStop,
  busy,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  placeholder: string;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
      className="flex items-end gap-space-sm"
    >
      <div className="flex-1 flex flex-col gap-1">
        <textarea
          rows={1}
          value={value}
          disabled={busy}
          maxLength={QUESTION_MAX_LENGTH}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder={placeholder}
          aria-label="Votre question"
          className="w-full resize-none rounded-3xl bg-surface-container-low px-space-md py-3 font-body-md text-body-md placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest disabled:opacity-70 max-h-40"
        />
        <span className="self-end font-label-sm text-label-sm text-on-surface-variant">
          {value.length}/{QUESTION_MAX_LENGTH}
        </span>
      </div>
      {busy ? (
        <button
          type="button"
          onClick={onStop}
          aria-label="Arrêter"
          className="mb-6 w-11 h-11 rounded-full bg-surface-container-high text-on-surface flex items-center justify-center"
        >
          <Icon name="stop" filled />
        </button>
      ) : (
        <button
          type="submit"
          aria-label="Envoyer"
          className="mb-6 w-11 h-11 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-sm hover:bg-primary-container"
        >
          <Icon name="send" filled />
        </button>
      )}
    </form>
  );
}
