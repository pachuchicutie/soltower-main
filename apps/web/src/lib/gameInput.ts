const CLEAR_MOVEMENT_EVENT = "soltower:clear-movement";
const MOBILE_MOVEMENT_EVENT = "soltower:mobile-movement";

export type MobileMovementDetail = {
  active: boolean;
  x: number;
  y: number;
  running: boolean;
};

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const editable = target.closest(
    'input, textarea, select, [contenteditable="true"], [role="textbox"], [data-game-input="text"]'
  );
  return Boolean(editable) || target.isContentEditable;
}

export function isTextEntryActive(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  return isEditableTarget(document.activeElement);
}

export function emitClearMovementKeys(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CLEAR_MOVEMENT_EVENT));
  }
}

export function onClearMovementKeys(handler: () => void): () => void {
  window.addEventListener(CLEAR_MOVEMENT_EVENT, handler);
  return () => window.removeEventListener(CLEAR_MOVEMENT_EVENT, handler);
}

export function emitMobileMovement(detail: MobileMovementDetail): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<MobileMovementDetail>(MOBILE_MOVEMENT_EVENT, { detail }));
  }
}

export function onMobileMovement(handler: (detail: MobileMovementDetail) => void): () => void {
  const listener = (event: Event) => {
    handler((event as CustomEvent<MobileMovementDetail>).detail);
  };
  window.addEventListener(MOBILE_MOVEMENT_EVENT, listener);
  return () => window.removeEventListener(MOBILE_MOVEMENT_EVENT, listener);
}
