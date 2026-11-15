"use client";

import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { motion } from "motion/react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

const GOOEY_SPRING = {
  duration: 0.38,
  type: "spring" as const,
  bounce: 0.22,
};

const iconBubbleVariants = {
  collapsed: { scale: 0, opacity: 0 },
  expanded: { scale: 1, opacity: 1 },
};

export interface GooeySearchInputProps {
  placeholder?: string;
  compactLabel?: string;
  className?: string;
  inputClassName?: string;
  /** "bar" keeps full responsive width; "morph" starts collapsed like Aceternity's liquid pill */
  mode?: "bar" | "morph";
  collapsedWidth?: number;
  expandedWidth?: number;
  expandedOffset?: number;
  gooeyBlur?: number;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
  onSubmit?: (value: string) => void;
  ariaLabel?: string;
  disabled?: boolean;
  rightSlot?: React.ReactNode;
}

/**
 * Aceternity GooeyInput adapted for Cards by cogify:
 * Supports both liquid morph-from-pill ("morph") and full-width sticky bar ("bar")
 * with an SVG gooey metaball detached icon bubble.
 */
export function GooeySearchInput({
  placeholder = "Search cards, banks, lounges, offers...",
  compactLabel = "Search",
  className,
  inputClassName,
  mode = "bar",
  collapsedWidth = 116,
  expandedWidth = 260,
  expandedOffset = 48,
  gooeyBlur = 4.5,
  value: valueProp,
  defaultValue = "",
  onValueChange,
  onOpenChange,
  onSubmit,
  ariaLabel,
  disabled = false,
  rightSlot,
}: GooeySearchInputProps) {
  const reactId = useId();
  const safeId = reactId.replace(/:/g, "");
  const filterId = `cardify-gooey-${safeId}`;
  const iconLayoutId = `cardify-gooey-icon-${safeId}`;
  const inputLayoutId = `cardify-gooey-input-${safeId}`;

  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocusedOrExpanded, setIsFocusedOrExpanded] = useState(mode === "bar");
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);

  const isControlled = valueProp !== undefined;
  const searchText = isControlled ? valueProp : uncontrolledValue;

  const setSearchText = useCallback(
    (next: string) => {
      if (!isControlled) setUncontrolledValue(next);
      onValueChange?.(next);
    },
    [isControlled, onValueChange],
  );

  const handleOpenToggle = useCallback(
    (next: boolean) => {
      setIsFocusedOrExpanded(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  useEffect(() => {
    if (mode === "morph" && isFocusedOrExpanded) {
      inputRef.current?.focus();
    }
  }, [mode, isFocusedOrExpanded]);

  const morphVariants = useMemo(
    () => ({
      collapsed: { width: collapsedWidth, marginLeft: 0 },
      expanded: { width: expandedWidth, marginLeft: expandedOffset },
    }),
    [collapsedWidth, expandedWidth, expandedOffset],
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
    const bubbleActive = isFocusedOrExpanded || searchText.length > 0;
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
          {/* Animated detached search orb on focus / query */}
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
              onFocus={() => setIsFocusedOrExpanded(true)}
              onBlur={() => setIsFocusedOrExpanded(false)}
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
    <div className={cn("relative flex items-center justify-center max-w-full", className)}>
      <svg className="pointer-events-none absolute h-0 w-0" aria-hidden="true">
        <defs>
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={gooeyBlur} result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      <div
        className="relative flex h-10 max-w-full items-center justify-center"
        style={{ filter: `url(#${filterId})` }}
      >
        <motion.div
          className="flex h-10 items-center justify-center"
          variants={morphVariants}
          initial="collapsed"
          animate={isFocusedOrExpanded ? "expanded" : "collapsed"}
          transition={GOOEY_SPRING}
        >
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (!disabled) handleOpenToggle(true);
            }}
            aria-label={ariaLabel || compactLabel}
            className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#0F5C4D] px-4 text-[13px] font-medium text-white shadow-sm outline-none transition-colors hover:bg-[#0B473B] disabled:opacity-50"
          >
            {!isFocusedOrExpanded && (
              <motion.span layoutId={iconLayoutId} className="inline-flex shrink-0">
                <Search className="h-3.5 w-3.5" />
              </motion.span>
            )}
            <motion.input
              layoutId={inputLayoutId}
              ref={inputRef}
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              aria-label={ariaLabel || placeholder}
              value={searchText}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                if (!searchText) handleOpenToggle(false);
              }}
              disabled={disabled || !isFocusedOrExpanded}
              placeholder={isFocusedOrExpanded ? placeholder : compactLabel}
              className={cn(
                "h-full min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none",
                isFocusedOrExpanded
                  ? "placeholder:text-white/70"
                  : "pointer-events-none placeholder:text-white/95 text-center",
              )}
            />
          </button>
        </motion.div>

        <motion.div
          className="pointer-events-none absolute left-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center"
          variants={iconBubbleVariants}
          initial="collapsed"
          animate={isFocusedOrExpanded ? "expanded" : "collapsed"}
          transition={GOOEY_SPRING}
          aria-hidden="true"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0F5C4D] text-white shadow-sm">
            <Search className="h-4 w-4" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
