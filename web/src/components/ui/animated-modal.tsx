"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOutsideClick } from "@/hooks/use-outside-click";
import { BankLogo } from "@/components/BankLogo";

interface ModalContextType {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <ModalContext.Provider value={{ open, setOpen }}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return context;
}

export function Modal({ children }: { children: ReactNode }) {
  return <ModalProvider>{children}</ModalProvider>;
}

export function ModalTrigger({
  children,
  className,
  ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  const { setOpen } = useModal();
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={cn(
        "relative overflow-hidden rounded-lg px-3.5 py-2 text-center cursor-pointer transition-colors",
        className,
      )}
      onClick={() => setOpen(true)}
    >
      {children}
    </button>
  );
}

/**
 * Aceternity Animated Modal Select/Action button:
 * Replaces the animated emoji curtain with the card's actual <BankLogo />.
 */
export function BankModalTrigger({
  label,
  bankSlug,
  bank,
  className,
  onBeforeOpen,
}: {
  label: string;
  bankSlug?: string;
  bank?: string;
  className?: string;
  onBeforeOpen?: () => void;
}) {
  const { setOpen } = useModal();
  return (
    <button
      type="button"
      onClick={() => {
        onBeforeOpen?.();
        setOpen(true);
      }}
      className={cn(
        "group/modal-btn relative inline-flex items-center justify-center overflow-hidden rounded-lg border border-[#0F5C4D] bg-[#0F5C4D] px-3.5 py-2 text-[12px] font-medium text-white cursor-pointer transition-colors hover:bg-[#0B473B]",
        className,
      )}
    >
      <span className="flex items-center gap-1.5 transition-transform duration-300 group-hover/modal-btn:translate-x-44">
        <BankLogo bankSlug={bankSlug} bank={bank} size="xs" className="shrink-0 bg-white/95 rounded p-0.5" />
        <span>{label}</span>
      </span>
      <span
        aria-hidden="true"
        className="absolute inset-0 z-20 flex -translate-x-44 items-center justify-center gap-1.5 transition-transform duration-300 group-hover/modal-btn:translate-x-0"
      >
        <BankLogo bankSlug={bankSlug} bank={bank} size="sm" className="shrink-0 bg-white rounded p-0.5 shadow-sm" />
        <span className="text-[11px] font-medium text-white">Inspect</span>
      </span>
    </button>
  );
}

export function ModalBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { open, setOpen } = useModal();
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = "";
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, setOpen]);

  useOutsideClick(modalRef, () => setOpen(false));

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex h-full w-full items-center justify-center p-3 sm:p-5"
          style={{ perspective: "800px", transformStyle: "preserve-3d" }}
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#1A1D21]/45 backdrop-blur-sm"
            aria-hidden="true"
          />

          <motion.div
            ref={modalRef}
            className={cn(
              "relative z-50 flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[#E4E4DF] bg-white shadow-2xl",
              className,
            )}
            initial={{ opacity: 0, scale: 0.92, rotateX: 18, y: 24 }}
            animate={{ opacity: 1, scale: 1, rotateX: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, rotateX: 8, y: 12 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close modal"
              className="group absolute right-3.5 top-3.5 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#E4E4DF] bg-white/95 text-[#4B525C] transition-colors hover:border-[#C9C9C2] hover:text-[#1A1D21] cursor-pointer"
            >
              <X className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" />
            </button>
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function ModalContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-1 flex-col overflow-y-auto p-5 sm:p-7", className)}>
      {children}
    </div>
  );
}

export function ModalFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-end gap-2.5 border-t border-[#E4E4DF] bg-[#FAF9F6] px-5 py-3.5",
        className,
      )}
    >
      {children}
    </div>
  );
}
