import { RefObject, useEffect } from "react";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useModalFocusTrap(
  ref: RefObject<HTMLElement>,
  onClose: () => void
): void {
  useEffect(() => {
    const modal = ref.current;
    if (!modal) {
      return;
    }

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = Array.from(modal.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = focusable[0] ?? modal;
    first.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.isComposing) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }

      const currentFocusable = Array.from(modal.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (currentFocusable.length === 0) {
        event.preventDefault();
        modal.focus();
        return;
      }

      const firstFocusable = currentFocusable[0];
      const lastFocusable = currentFocusable[currentFocusable.length - 1];
      if (event.shiftKey && document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      } else if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    };

    modal.addEventListener("keydown", onKeyDown);
    return () => {
      modal.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [onClose, ref]);
}
