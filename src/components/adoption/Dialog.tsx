"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { TextArea } from "@/components/ui/TextField";
import { REPORT_REASONS, reportContent, type ReportReason, type ReportTarget } from "@/lib/adoption";
import { errorMessage } from "@/lib/users";

/** Fenêtre modale (bas de l'écran sur mobile, centrée sur ordinateur). */
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-margin">
      <div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto bg-surface-container-lowest rounded-t-2xl sm:rounded-2xl p-space-lg md:p-space-xl shadow-[0px_20px_40px_-12px_rgba(15,118,110,0.12),0px_1px_3px_rgba(31,41,55,0.05)] flex flex-col gap-space-lg"
      >
        <div className="flex items-start justify-between gap-space-md">
          <h2 id={titleId} className="font-headline-md text-headline-md text-on-surface tracking-tight">
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors shrink-0"
          >
            <Icon name="close" className="text-[22px]" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Lien « Signaler » + fenêtre de signalement (traité par l'administration). */
export function ReportButton({ targetType, targetId, className = "" }: { targetType: ReportTarget; targetId: string; className?: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>(REPORT_REASONS[0]);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  function start() {
    if (!user) {
      router.push("/connexion");
      return;
    }
    setStatus("idle");
    setError("");
    setOpen(true);
  }

  async function send() {
    if (!user) return;
    setStatus("sending");
    setError("");
    try {
      await reportContent({ reporterId: user.uid, targetType, targetId, reason, comment: comment.trim() });
      setStatus("sent");
      setComment("");
    } catch (err) {
      setError(errorMessage(err));
      setStatus("idle");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={start}
        className={`inline-flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant hover:text-error transition-colors ${className}`}
      >
        <Icon name="flag" className="text-[16px]" />
        Signaler
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={targetType === "annonce" ? "Signaler l'annonce" : "Signaler l'histoire"}>
        {status === "sent" ? (
          <>
            <Alert tone="success">Merci, votre signalement a été transmis à l&apos;équipe de modération.</Alert>
            <Button type="button" onClick={() => setOpen(false)}>
              Fermer
            </Button>
          </>
        ) : (
          <>
            <fieldset className="flex flex-col gap-space-xs">
              <legend className="font-label-lg text-label-lg text-on-surface mb-space-sm">Motif</legend>
              {REPORT_REASONS.map((r) => (
                <label
                  key={r}
                  className="flex items-center gap-space-sm p-space-sm rounded-xl hover:bg-surface-container-low cursor-pointer font-body-md text-body-md"
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="accent-[#ba1a1a] w-4 h-4"
                  />
                  {r}
                </label>
              ))}
            </fieldset>
            <TextArea
              label="Commentaire"
              hint="Facultatif"
              rows={3}
              maxLength={500}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Précisez le problème…"
            />
            {error && <Alert>{error}</Alert>}
            <div className="flex justify-end gap-space-sm">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="button" variant="danger" onClick={send} loading={status === "sending"}>
                Signaler
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}
