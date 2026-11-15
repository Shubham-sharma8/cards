"use client";

import {
  useState,
  useRef,
  useEffect,
  useId,
  useMemo,
  useCallback,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

const GOOEY_SPRING = {
  type: "spring" as const,
  stiffness: 420,
  damping: 32,
  mass: 0.8,
};

const iconBubbleVariants = {
  collapsed: { scale: 0.9, opacity: 0 },
  expanded: { scale: 1, opacity: 1 },
};

export interface GooeySearchInputProps {
  /** Controlled value */
  value?: string;
  /** Initial uncontrolled value */
  defaultValue?: string;
  /** Controlled change callback */
  onValueChange?: (value: string) => void;
  /** Optional legacy HTML input change alias */
  onChange?: (value: string) => void;
  /** Submit callback on Enter */
  onSubmit?: (value: string) => void;
  /** Display mode: "bar" always expanded; "morph" icon-only button that expands bigger when clicked */
  mode?: "bar" | "morph";
  /** Controlled open state (used when mode === "morph") */
  open?: boolean;
  /** Callback when morph state toggles */
  onOpenChange?: (open: boolean) => void;
  /** Compact trigger label when mode === "morph" (empty = strict icon-only circle) */
  compactLabel?: string;
  /** Width in px when collapsed in morph mode */
  collapsedWidth?: number;
  /** Width in px when expanded in morph mode */
  expandedWidth?: number;
  /** Horizontal offset when expanded */
  expandedOffset?: number;
  /** Optional blur radius for gooey backdrop orb */
  gooeyBlur?: number;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  rightSlot?: ReactNode;
}

export function GooeySearchInput({
  value,
  defaultValue = "",
  onValueChange,
  onChange,
  onSubmit,
  mode = "bar",
  open: controlledOpen,
  onOpenChange,
  compactLabel = "",
  collapsedWidth = 44,
  expandedWidth = 380,
  expandedOffset = 0,
  gooeyBlur = 6,
  placeholder = "Search...",
  ariaLabel,
  className,
  inputClassName,
  disabled = false,
  autoFocus = false,
  rightSlot,
}: GooeySearchInputProps) {
  const isControlled = value !== undefined;
  const [internalText, setInternalText] = useState(defaultValue);
  const searchText = isControlled ? value : internalText;

  const setSearchText = useCallback(
    (next: string) => {
      if (!isControlled) setInternalText(next);
      onValueChange?.(next);
      onChange?.(next);
    },
    [isControlled, onChange, onValueChange],
  );

  const isOpenControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(
    mode === "bar" || Boolean(defaultValue) || autoFocus,
  );
  const isExpanded =
    mode === "bar"
      ? true
      : isOpenControlled
        ? controlledOpen || searchText.length > 0
        : internalOpen || searchText.length > 0;

  const [barFocused, setBarFocused] = useState(false);

  const handleOpenToggle = useCallback(
    (next: boolean) => {
      if (!isOpenControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isOpenControlled, onOpenChange],
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rawId = useId();
  const filterId = `gooey-${rawId.replace(/:/g, "")}`;

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    if (mode === "morph" && isExpanded) {
      const id = requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      return () => cancelAnimationFrame(id);
    }
  }, [mode, isExpanded]);

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    };
  }, []);

  const hasLabel = compactLabel.trim().length > 0;
  const collapsedPx = hasLabel ? Math.max(collapsedWidth, 108) : collapsedWidth;

  const morphVariants = useMemo(
    () => ({
      collapsed: { width: collapsedPx, marginLeft: 0 },
      expanded: { width: expandedWidth, marginLeft: expandedOffset },
    }),
    [collapsedPx, expandedWidth, expandedOffset],
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setSearchText(e.target.value);
    },
    [setSearchText],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && onSubmit) {
        e.preventDefault();
        onSubmit(searchText);
      } else if (e.key === "Escape") {
        if (searchText) {
          setSearchText("");
        } else if (mode === "morph") {
          handleOpenToggle(false);
          inputRef.current?.blur();
        }
      }
    },
    [handleOpenToggle, mode, onSubmit, searchText, setSearchText],
  );

  if (mode === "bar") {
    const bubbleActive = barFocused || searchText.length > 0;
    return (
      <div className={cn("relative flex w-full items-center", className)}>
        <svg className="pointer-events-none absolute h-0 w-0" aria-hidden="true">
          <defs>
            <filter id={filterId} x="-25%" y="-25%" width="150%" height="150%">
              <feGaussianBlur in="SourceGraphic" stdDeviation={gooeyBlur} result="blur" />
              <feColorMatrix
                in="blur"
                type="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8"
                result="goo"
              />
              <feComposite in="SourceGraphic" in2="goo" operator="atop" />
            </filter>
          </defs>
        </svg>

        <div className="relative flex w-full items-center">
          <motion.div
            animate={bubbleActive ? { scale: 1, x: 0, opacity: 1 } : { scale: 0.92, x: 4, opacity: 0.95 }}
            transition={GOOEY_SPRING}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0F5C4D] text-white shadow-sm"
            style={{ filter: `url(#${filterId})` }}
            aria-hidden="true"
          >
            <Search className="h-4 w-4" />
          </motion.div>

          <div
            className={cn(
              "ml-2 flex min-h-[42px] flex-1 items-center gap-2 rounded-full border bg-white px-3.5 transition-all",
              bubbleActive
                ? "border-[#0F5C4D] ring-2 ring-[#0F5C4D]/12 shadow-sm"
                : "border-[#E4E4DF] hover:border-[#C9C9C2]",
              inputClassName,
            )}
          >
            <input
              ref={inputRef}
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              aria-label={ariaLabel || placeholder}
              value={searchText}
              disabled={disabled}
              onFocus={() => setBarFocused(true)}
              onBlur={() => setBarFocused(false)}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="w-full min-w-0 bg-transparent py-2 text-[13.5px] text-[#1A1D21] placeholder:text-[#717882] outline-none"
            />
            {searchText.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSearchText("");
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F3F2EE] text-[#4B525C] hover:bg-[#E4E4DF] hover:text-[#1A1D21] cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {rightSlot}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative inline-flex max-w-full items-center", className)}>
      <motion.div
        className="flex h-11 max-w-full items-center overflow-hidden"
        variants={morphVariants}
        initial={isExpanded ? "expanded" : "collapsed"}
        animate={isExpanded ? "expanded" : "collapsed"}
        transition={GOOEY_SPRING}
        style={{ maxWidth: "100%" }}
      >
        {!isExpanded ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
              if (!disabled) handleOpenToggle(true);
            }}
            title={ariaLabel || "Search"}
            aria-label={ariaLabel || (hasLabel ? compactLabel : "Search")}
            className={cn(
              "flex h-11 w-full cursor-pointer items-center justify-center rounded-full bg-[#0F5C4D] text-white shadow-sm outline-none transition-colors hover:bg-[#0B473B] disabled:opacity-50",
              hasLabel ? "gap-2 px-4 text-[13px] font-medium" : "px-0",
            )}
          >
            <Search className="h-4 w-4 shrink-0" />
            {hasLabel && <span className="truncate">{compactLabel}</span>}
          </button>
        ) : (
          <div className="flex h-11 w-full items-center gap-2">
            <motion.div
              variants={iconBubbleVariants}
              initial="collapsed"
              animate="expanded"
              transition={GOOEY_SPRING}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0F5C4D] text-white shadow-sm"
              aria-hidden="true"
            >
              <Search className="h-4 w-4" />
            </motion.div>

            <div
              className={cn(
                "flex h-10 min-w-0 flex-1 items-center gap-1.5 rounded-full border border-[#0F5C4D] bg-white px-3.5 ring-2 ring-[#0F5C4D]/12 shadow-sm",
                inputClassName,
              )}
            >
              <input
                ref={inputRef}
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                aria-label={ariaLabel || placeholder}
                value={searchText}
                disabled={disabled}
                onFocus={() => {
                  if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
                }}
                onBlur={() => {
                  blurTimerRef.current = setTimeout(() => {
                    if (!searchText.trim()) handleOpenToggle(false);
                  }, 180);
                }}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="w-full min-w-0 bg-transparent py-1.5 text-[13.5px] text-[#1A1D21] placeholder:text-[#717882] outline-none"
              />
              {searchText.length > 0 ? (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setSearchText("");
                    inputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F3F2EE] text-[#4B525C] hover:bg-[#E4E4DF] hover:text-[#1A1D21] cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleOpenToggle(false)}
                  aria-label="Close search"
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#717882] hover:bg-[#F3F2EE] hover:text-[#1A1D21] cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              {rightSlot}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
