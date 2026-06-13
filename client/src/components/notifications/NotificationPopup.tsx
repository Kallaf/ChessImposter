import type { ReactNode } from "react";

export interface NotificationAction {
  label: string;
  onClick: () => void;
  variant?: "primary" | "success" | "danger" | "secondary";
  disabled?: boolean;
}

interface NotificationPopupProps {
  open: boolean;
  title: string;
  description: string;
  icon?: ReactNode;
  actions: NotificationAction[];
  onClose?: () => void;
}

const buttonVariants = {
  primary: "bg-blue-600 hover:bg-blue-700",
  success: "bg-green-600 hover:bg-green-700",
  danger: "bg-red-600 hover:bg-red-700",
  secondary: "bg-zinc-700 hover:bg-zinc-600",
};

export default function NotificationPopup({
  open,
  title,
  description,
  icon,
  actions,
  onClose,
}: NotificationPopupProps) {
  if (!open) return null;

  return (
    <div className="fixed top-5 right-5 z-50 w-96 animate-in slide-in-from-right-5 duration-300">
      <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl">

        <div className="flex gap-3">

          {icon && (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-xl">
              {icon}
            </div>
          )}

          <div className="flex-1">
            <h2 className="font-semibold text-white">
              {title}
            </h2>

            <p className="mt-1 text-sm text-zinc-400">
              {description}
            </p>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          {actions.map((action) => (
            <button
              key={action.label}
              disabled={action.disabled}
              onClick={action.onClick}
              className={`
                rounded-lg px-4 py-2 text-sm font-medium text-white transition
                ${buttonVariants[action.variant ?? "primary"]}
                disabled:cursor-not-allowed disabled:opacity-50
              `}
            >
              {action.label}
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}