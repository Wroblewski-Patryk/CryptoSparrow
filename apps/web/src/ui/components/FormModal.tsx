import type { KeyboardEvent, ReactNode } from "react";

type FormModalProps = {
  open: boolean;
  title: string;
  description?: string;
  maxWidthClassName?: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
};

export default function FormModal({
  open,
  title,
  description,
  maxWidthClassName = "max-w-2xl",
  onClose,
  children,
  actions,
}: FormModalProps) {
  if (!open) return null;

  const handleBackdropKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onClose();
  };

  return (
    <dialog className="modal modal-open" aria-modal="true" role="dialog" aria-label={title}>
      <div className={`modal-box ${maxWidthClassName}`}>
        <h3 className="text-lg font-semibold">{title}</h3>
        {description ? <p className="mt-1 text-sm opacity-80">{description}</p> : null}
        <div className="mt-4">{children}</div>
        {actions ? <div className="modal-action">{actions}</div> : null}
      </div>
      <div
        className="modal-backdrop"
        role="button"
        aria-label="Close modal"
        tabIndex={0}
        onClick={onClose}
        onKeyDown={handleBackdropKeyDown}
      />
    </dialog>
  );
}
