import { Icon } from "./Icon";

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm ${className}`}>{children}</div>;
}

export function Alert({
  tone = "error",
  children,
}: {
  tone?: "error" | "success";
  children: React.ReactNode;
}) {
  const isError = tone === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      className={`flex items-center gap-space-xs rounded-xl p-space-sm font-body-sm text-body-sm ${
        isError ? "bg-error-container/50 text-on-error-container" : "bg-emerald-50 text-emerald-800"
      }`}
    >
      <Icon name={isError ? "error" : "check_circle"} className={`text-[18px] ${isError ? "text-error" : "text-emerald-600"}`} />
      <span>{children}</span>
    </div>
  );
}
