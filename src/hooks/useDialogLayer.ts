import { useEffect, useRef } from "react";

interface ElementRef {
  readonly current: HTMLElement | null;
}

interface DialogLayerOptions {
  active: boolean;
  onClose: () => void;
  panelRef?: ElementRef;
  initialFocusRef?: ElementRef;
  initialFocusDelay?: number;
  autoFocus?: boolean;
  trapFocus?: boolean;
  lockScroll?: boolean;
  restoreFocus?: boolean;
}

const stack: string[] = [];
let layerSequence = 0;
let scrollLocks = 0;
let savedBodyStyle: { overflow: string; paddingRight: string } | null = null;

function removeLayer(id: string): void {
  const index = stack.lastIndexOf(id);
  if (index >= 0) stack.splice(index, 1);
}

function isTopLayer(id: string): boolean {
  return stack[stack.length - 1] === id;
}

function lockBodyScroll(): void {
  if (scrollLocks === 0) {
    const body = document.body;
    savedBodyStyle = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      const padding = Number.parseFloat(getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = `${padding + scrollbarWidth}px`;
    }
    body.style.overflow = "hidden";
  }
  scrollLocks += 1;
}

function unlockBodyScroll(): void {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks > 0 || !savedBodyStyle) return;
  document.body.style.overflow = savedBodyStyle.overflow;
  document.body.style.paddingRight = savedBodyStyle.paddingRight;
  savedBodyStyle = null;
}

function focusableElements(panel: HTMLElement): HTMLElement[] {
  return Array.from(
    panel.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((node) => node.getClientRects().length > 0);
}

/**
 * Keeps every dialog on one stack. Only the top layer answers Escape or traps
 * Tab, and body scrolling stays locked until the last layer closes. That fixes
 * nested cases like kitchen mode over a bake detail, or saving an edit over the
 * bake it came from.
 */
export function useDialogLayer({
  active,
  onClose,
  panelRef,
  initialFocusRef,
  initialFocusDelay = 60,
  autoFocus = true,
  trapFocus = true,
  lockScroll = true,
  restoreFocus = true,
}: DialogLayerOptions): void {
  const idRef = useRef<string | null>(null);
  if (idRef.current === null) {
    layerSequence += 1;
    idRef.current = `dialog-${layerSequence}`;
  }
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active) return;
    const id = idRef.current as string;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    removeLayer(id);
    stack.push(id);
    if (lockScroll) lockBodyScroll();

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTopLayer(id)) return;

      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !trapFocus) return;

      const panel = panelRef?.current;
      if (!panel) return;
      const nodes = focusableElements(panel);
      if (nodes.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const current = document.activeElement;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!(current instanceof Node) || !panel.contains(current)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && (current === first || current === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    const focusTimer = autoFocus
      ? window.setTimeout(() => {
          (initialFocusRef?.current ?? panelRef?.current)?.focus();
        }, initialFocusDelay)
      : 0;

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown, true);
      removeLayer(id);
      if (lockScroll) unlockBodyScroll();

      if (!restoreFocus || !previousFocus?.isConnected) return;
      const nextTop = stack[stack.length - 1];
      // If something above this layer is still open, only return focus to an
      // element that belongs to a dialog (the normal nested-close case).
      if (!nextTop || previousFocus.closest('[role="dialog"]')) previousFocus.focus();
    };
  }, [
    active,
    autoFocus,
    initialFocusDelay,
    initialFocusRef,
    lockScroll,
    panelRef,
    restoreFocus,
    trapFocus,
  ]);
}
