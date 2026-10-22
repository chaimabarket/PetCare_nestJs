"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { Icon } from "./Icon";

type FieldProps = {
  label: string;
  /** Icône Material à gauche du champ (ex. "mail"). */
  icon?: string;
  /** Texte ou lien affiché à droite du libellé (ex. "Requis", "Mot de passe oublié ?"). */
  hint?: ReactNode;
  /** Aide affichée sous le champ quand il n'y a pas d'erreur. */
  help?: string;
  error?: string;
};

const inputBase =
  "w-full rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-md placeholder:text-outline shadow-sm transition-all focus:outline-none focus:bg-surface-container-lowest focus:ring-2 disabled:cursor-not-allowed disabled:opacity-85";

function FieldShell({
  id,
  label,
  hint,
  help,
  error,
  children,
  className = "",
}: FieldProps & { id: string; children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-space-xs ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className={`font-label-lg text-label-lg ${error ? "text-error" : "text-on-surface"}`}>
          {label}
        </label>
        {hint && <span className="font-label-sm text-label-sm text-on-surface-variant">{hint}</span>}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="flex items-center gap-1 font-body-sm text-body-sm text-error">
          <Icon name="warning" className="text-[16px]" />
          {error}
        </p>
      ) : (
        help && (
          <p className="flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant">
            <Icon name="info" className="text-[15px] text-outline" />
            {help}
          </p>
        )
      )}
    </div>
  );
}

export function TextField({
  label,
  icon,
  hint,
  help,
  error,
  className,
  type = "text",
  ...props
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";

  return (
    <FieldShell id={id} label={label} hint={hint} help={help} error={error} className={className}>
      <div className="relative flex items-center">
        {icon && (
          <Icon
            name={icon}
            className={`pointer-events-none absolute left-3 text-xl ${error ? "text-error" : "text-outline"}`}
          />
        )}
        <input
          id={id}
          type={isPassword && visible ? "text" : type}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${inputBase} h-11 ${icon ? "pl-10" : "pl-3.5"} ${isPassword || error ? "pr-10" : "pr-3.5"} ${
            error ? "ring-2 ring-error" : "focus:ring-primary/20"
          }`}
          {...props}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            title={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            className="absolute right-3 flex items-center text-outline transition-colors hover:text-on-surface"
          >
            <Icon name={visible ? "visibility_off" : "visibility"} className="text-[20px]" />
          </button>
        ) : (
          error && <Icon name="error" className="pointer-events-none absolute right-3 text-xl text-error" />
        )}
      </div>
    </FieldShell>
  );
}

export function TextArea({
  label,
  hint,
  help,
  error,
  className,
  ...props
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} help={help} error={error} className={className}>
      <textarea
        id={id}
        aria-invalid={Boolean(error)}
        className={`${inputBase} resize-none p-3 ${error ? "ring-2 ring-error" : "focus:ring-primary/20"}`}
        {...props}
      />
    </FieldShell>
  );
}
