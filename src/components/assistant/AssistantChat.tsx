"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Dialog } from "@/components/adoption/Dialog";
import { useAuth } from "@/components/auth/AuthProvider";
import { Icon } from "@/components/ui/Icon";
import { timeAgo } from "@/lib/dates";
import { getListing, type AdoptionListing } from "@/lib/adoption";
import {
  addMessage,
  createChat,
  deleteChat,
  listChats,
  listMessages,
  rateMessage,
  type AnswerRating,
  type AssistantChat as Chat,
  type AssistantMessage,
} from "@/lib/assistant/history";
import { buildListingContext, contextListings } from "@/lib/assistant/listing-context";
import { parseAnswer, type ReminderSuggestion } from "@/lib/assistant/parser";
import { buildPetContext, fetchHealthSummary, fetchLatestWeight, listMyPets, type AssistantPet } from "@/lib/assistant/pets";
import { HISTORY_CHATS, isAdoptionQuestion, isoDay, recommendedQuestions } from "@/lib/assistant/prompt";
import { AssistantError, countMessage, fetchAvailableListings, reply } from "@/lib/assistant/service";
import {
  AssistantAvatar,
  AssistantBubble,
  Disclaimer,
  InputBar,
  PetSelector,
  SuggestionList,
  TypingIndicator,
  UserBubble,
} from "./parts";
import { ReminderDialog } from "./ReminderDialog";

type Streaming = { raw: string; knownIds: Set<string>; pet: AssistantPet | null };

/**
 * Assistant PetCare (maquettes Stitch W1 et W2).
 *
 * - Visiteur : questions générales et suggestions d'adoption.
 * - Connecté : choix d'un de ses animaux (fiche et carnet joints), rappels, historique et avis 👍 / 👎.
 *
 * `startWithAdoption` envoie directement « Trouver mon compagnon » (bannière du fil d'adoption).
 */
export function AssistantChat({ startWithAdoption = false }: { startWithAdoption?: boolean }) {
  const { user, loading } = useAuth();
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [listings, setListings] = useState<Record<string, AdoptionListing>>({});
  const [pets, setPets] = useState<AssistantPet[]>([]);
  const [pet, setPet] = useState<AssistantPet | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState<Streaming | null>(null);
  const [createdReminders, setCreatedReminders] = useState<Record<number, Set<string>>>({});
  const [reminder, setReminder] = useState<{ index: number; suggestion: ReminderSuggestion } | null>(null);
  const [notice, setNotice] = useState("");
  const stopped = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const refreshChats = useCallback(async () => {
    if (!user) return;
    try {
      setChats(await listChats(user.uid));
    } catch (error) {
      console.error("Historique indisponible :", error);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void listMyPets(user.uid).then(setPets);
    listChats(user.uid)
      .then(setChats)
      .catch((error) => console.error("Historique indisponible :", error));
  }, [user]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streaming?.raw]);

  const send = useCallback(
    async (text: string, { adoption = false, retry = false } = {}) => {
      const question = text.trim();
      if (!question || busy) return;
      const base = retry && messages.at(-1)?.isError ? messages.slice(0, -1) : messages;
      const history = retry ? base.slice(0, -1) : base;
      const next = retry ? base : [...base, { fromUser: true, text: question }];
      setMessages(next);
      setInput("");
      setBusy(true);
      stopped.current = false;

      const selectedPet = user ? pet : null;
      let raw = "";
      let knownIds = new Set<string>();
      let error: unknown = null;
      try {
        if (user) await countMessage(user.uid);

        const now = new Date();
        let context = `DATE DU JOUR : ${isoDay(now)}`;
        if (selectedPet) {
          const [weight, health] = await Promise.all([
            fetchLatestWeight(selectedPet.id),
            fetchHealthSummary(selectedPet.id),
          ]);
          context += `\n\n${buildPetContext(selectedPet, { weight, health, now })}`;
        }
        if (adoption || isAdoptionQuestion(question)) {
          try {
            const available = await fetchAvailableListings();
            setListings((current) => ({ ...current, ...Object.fromEntries(available.map((l) => [l.id, l])) }));
            knownIds = new Set(contextListings(available).map((l) => l.id));
            context += `\n\n${buildListingContext(available)}`;
          } catch (err) {
            // Sans les annonces, l'assistant répond quand même (sans proposer d'animal).
            console.error("Annonces indisponibles :", err);
          }
        }
        if (stopped.current) return;

        setStreaming({ raw: "", knownIds, pet: selectedPet });
        for await (const partial of reply(history, question, context)) {
          if (stopped.current) break;
          raw = partial;
          setStreaming({ raw, knownIds, pet: selectedPet });
        }
      } catch (err) {
        error = err;
      } finally {
        const final: AssistantMessage[] = [];
        let answer: AssistantMessage | null = null;
        if (raw.trim()) {
          const parsed = parseAnswer(raw, knownIds, { allowReminders: Boolean(selectedPet) });
          answer = { fromUser: false, text: parsed.text, listingIds: parsed.listingIds, reminders: parsed.reminders };
          final.push(answer);
        }
        if (error) {
          const message =
            error instanceof AssistantError ? error.message : "L'assistant n'est pas disponible pour le moment. Réessayez plus tard.";
          final.push({ fromUser: false, text: message, isError: true });
        }
        setMessages([...next, ...final]);
        setStreaming(null);
        setBusy(false);
        if (answer && user) void saveExchange(question, answer, next.length, selectedPet);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busy, messages, pet, user, chatId],
  );

  /** Enregistre la question et la réponse dans l'historique (utilisateur connecté). */
  async function saveExchange(question: string, answer: AssistantMessage, index: number, selectedPet: AssistantPet | null) {
    if (!user) return;
    try {
      const petRef = selectedPet ? { id: selectedPet.id, name: selectedPet.name } : null;
      const id =
        chatId ?? (await createChat(user.uid, { firstQuestion: question, petId: selectedPet?.id, petName: selectedPet?.name }));
      if (!chatId) setChatId(id);
      await addMessage(user.uid, id, { fromUser: true, text: question }, petRef);
      const answerId = await addMessage(user.uid, id, answer, petRef);
      setMessages((current) => current.map((m, i) => (i === index ? { ...m, id: answerId } : m)));
      void refreshChats();
    } catch (error) {
      // L'historique n'est pas bloquant : la conversation continue.
      console.error("Historique non enregistré :", error);
    }
  }

  useEffect(() => {
    if (!startWithAdoption || started.current || loading) return;
    const timer = setTimeout(() => {
      if (started.current) return;
      started.current = true;
      const suggestion = recommendedQuestions(Boolean(user)).find((s) => s.adoption);
      if (suggestion) void send(suggestion.question, { adoption: true });
    }, 0);
    return () => clearTimeout(timer);
  }, [startWithAdoption, loading, user, send]);

  async function rate(index: number, rating: AnswerRating | null) {
    const message = messages[index];
    setMessages((current) => current.map((m, i) => (i === index ? { ...m, rating } : m)));
    if (!user || !chatId || !message.id) return;
    try {
      await rateMessage(user.uid, chatId, message.id, rating);
    } catch (error) {
      console.error("Avis non enregistré :", error);
    }
  }

  function newConversation() {
    setMessages([]);
    setCreatedReminders({});
    setChatId(null);
    setHistoryOpen(false);
  }

  async function openChat(chat: Chat) {
    if (!user) return;
    setHistoryOpen(false);
    try {
      const loaded = await listMessages(user.uid, chat.id);
      const ids = [...new Set(loaded.flatMap((m) => m.listingIds ?? []))].filter((id) => !listings[id]);
      const fetched = (await Promise.all(ids.map((id) => getListing(id).catch(() => null)))).filter(
        (l): l is AdoptionListing => Boolean(l),
      );
      setListings((current) => ({ ...current, ...Object.fromEntries(fetched.map((l) => [l.id, l])) }));
      setMessages(loaded);
      setCreatedReminders({});
      setChatId(chat.id);
      setPet(pets.find((p) => p.id === chat.petId) ?? null);
    } catch (error) {
      console.error("Conversation non chargée :", error);
      setNotice("La conversation n'a pas pu être ouverte.");
    }
  }

  async function removeChat(chat: Chat) {
    if (!user) return;
    try {
      await deleteChat(user.uid, chat.id);
      if (chat.id === chatId) newConversation();
      void refreshChats();
    } catch (error) {
      console.error("Suppression impossible :", error);
      setNotice("La suppression a échoué. Réessayez.");
    }
  }

  const partial = streaming
    ? parseAnswer(streaming.raw, streaming.knownIds, { allowReminders: Boolean(streaming.pet), streaming: true })
    : null;
  const empty = messages.length === 0 && !streaming;
  const lastQuestion = [...messages].reverse().find((m) => m.fromUser)?.text ?? "";

  const historyList = (
    <div className="flex flex-col gap-space-xs">
      <button
        type="button"
        onClick={newConversation}
        className="inline-flex items-center justify-center gap-1 h-10 rounded-full bg-primary text-on-primary font-label-lg text-label-lg hover:bg-primary-container"
      >
        <Icon name="add" className="text-[18px]" />
        Nouvelle conversation
      </button>
      <p className="mt-space-sm font-label-md text-label-md text-on-surface-variant">Vos {HISTORY_CHATS} dernières conversations</p>
      {chats.length === 0 && <p className="font-body-sm text-body-sm text-on-surface-variant">Aucune conversation pour le moment.</p>}
      {chats.map((chat) => (
        <div
          key={chat.id}
          className={`group flex items-start gap-1 rounded-xl px-space-sm py-space-xs ${
            chat.id === chatId ? "bg-primary-fixed/40" : "hover:bg-surface-container-low"
          }`}
        >
          <button type="button" onClick={() => openChat(chat)} className="flex-1 min-w-0 text-left">
            <span className="block truncate font-label-lg text-label-lg text-on-surface">{chat.title}</span>
            <span className="block font-body-sm text-body-sm text-on-surface-variant">
              {[chat.petName, chat.updatedAt ? timeAgo(chat.updatedAt) : null].filter(Boolean).join(" · ")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => removeChat(chat)}
            aria-label={`Supprimer « ${chat.title} »`}
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error-container/40"
          >
            <Icon name="delete" className="text-[18px]" />
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-margin md:px-margin-md lg:px-margin-lg py-space-lg grid gap-space-lg lg:grid-cols-[260px_1fr]">
      {user && <aside className="hidden lg:block bg-surface-container-lowest rounded-2xl p-space-md shadow-sm h-fit sticky top-20">{historyList}</aside>}

      <section className={`flex flex-col gap-space-md min-h-[70vh] ${user ? "" : "lg:col-span-2 max-w-3xl w-full mx-auto"}`}>
        <header className="flex items-center gap-space-sm">
          <AssistantAvatar />
          <div className="flex-1">
            <h1 className="font-headline-sm text-headline-sm text-on-surface">Assistant PetCare</h1>
            <p className="font-body-sm text-body-sm text-on-surface-variant">IA · Réponses indicatives</p>
          </div>
          {messages.length > 0 && !busy && (
            <button
              type="button"
              onClick={newConversation}
              title="Nouvelle conversation"
              aria-label="Nouvelle conversation"
              className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
            >
              <Icon name="add_comment" />
            </button>
          )}
          {user && (
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              aria-label="Mes conversations"
              className="lg:hidden w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
            >
              <Icon name="history" />
            </button>
          )}
        </header>
        <Disclaimer />
        {user && pets.length > 0 && <PetSelector pets={pets} selected={pet} onSelect={setPet} disabled={busy} />}
        {notice && (
          <p role="status" className="font-body-sm text-body-sm text-error">
            {notice}
          </p>
        )}

        <div className="flex-1 flex flex-col gap-space-md">
          {empty ? (
            <div className="flex flex-col items-center gap-space-sm text-center py-space-xl">
              <AssistantAvatar size="lg" />
              <h2 className="font-headline-md text-headline-md text-on-surface">
                {pet ? `Une question sur ${pet.name} ?` : "Comment puis-je vous aider ?"}
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
                {user
                  ? "Posez une question sur les soins, l'alimentation, le comportement ou l'adoption."
                  : "Connectez-vous pour des réponses adaptées à vos animaux et des rappels de soins."}
              </p>
              {!user && (
                <Link href="/connexion" className="font-label-lg text-label-lg text-primary hover:underline">
                  Se connecter
                </Link>
              )}
              <div className="w-full mt-space-md text-left flex flex-col gap-space-sm">
                <h3 className="font-label-lg text-label-lg text-on-surface">Questions recommandées</h3>
                <SuggestionList
                  suggestions={recommendedQuestions(Boolean(user), user ? pet : null)}
                  onPick={(s) => send(s.question, { adoption: s.adoption })}
                />
              </div>
            </div>
          ) : (
            <>
              {messages.map((m, i) =>
                m.fromUser ? (
                  <UserBubble key={i} text={m.text} />
                ) : (
                  <AssistantBubble
                    key={i}
                    message={m}
                    listings={(m.listingIds ?? []).map((id) => listings[id]).filter(Boolean)}
                    createdReminders={createdReminders[i]}
                    onCreateReminder={user ? (suggestion) => (pet ? setReminder({ index: i, suggestion }) : setNotice("Sélectionnez un animal pour créer un rappel.")) : undefined}
                    onRate={m.isError ? undefined : (rating) => rate(i, rating)}
                    onRetry={m.isError && i === messages.length - 1 && !busy ? () => send(lastQuestion, { retry: true }) : undefined}
                  />
                ),
              )}
              {busy && (!partial || !partial.text) && <TypingIndicator />}
              {partial?.text && <AssistantBubble message={{ fromUser: false, text: partial.text }} writing />}
            </>
          )}
          <div ref={endRef} />
        </div>

        <div className="sticky bottom-20 md:bottom-4 bg-background/90 backdrop-blur pt-space-xs">
          <InputBar
            value={input}
            onChange={setInput}
            onSend={() => send(input)}
            onStop={() => {
              stopped.current = true;
            }}
            busy={busy}
            placeholder={pet ? `Une question sur ${pet.name} ?` : "Posez votre question…"}
          />
        </div>
      </section>

      <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} title="Mes conversations">
        {historyList}
      </Dialog>

      {reminder && pet && user && (
        <ReminderDialog
          suggestion={reminder.suggestion}
          pet={pet}
          ownerId={user.uid}
          onClose={() => setReminder(null)}
          onCreated={() => {
            setCreatedReminders((current) => ({
              ...current,
              [reminder.index]: new Set([...(current[reminder.index] ?? []), reminder.suggestion.title]),
            }));
            setNotice("");
            setReminder(null);
          }}
        />
      )}
    </div>
  );
}
