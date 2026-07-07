import { useEffect } from "react";
import type { ModalKey } from "../store/ui";
import { emitClearMovementKeys, isEditableTarget } from "../lib/gameInput";

interface UseTownShortcutsOptions {
  active: boolean;
  modal: ModalKey | null;
  profileOpen: boolean;
  onOpenModal: (modal: ModalKey) => void;
  onCloseModal: () => void;
  onCloseProfile: () => void;
  onInteract: () => void;
}

export function useTownShortcuts({
  active,
  modal,
  profileOpen,
  onOpenModal,
  onCloseModal,
  onCloseProfile,
  onInteract
}: UseTownShortcutsOptions): void {
  useEffect(() => {
    if (modal || profileOpen) {
      emitClearMovementKeys();
    }
  }, [modal, profileOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) {
        return;
      }

      const editableFocused = isEditableTarget(event.target);
      const key = event.key.toLowerCase();
      const anyModalOpen = Boolean(modal) || profileOpen;

      if (key === "escape") {
        if (profileOpen) {
          event.preventDefault();
          onCloseProfile();
          emitClearMovementKeys();
          return;
        }
        if (modal) {
          event.preventDefault();
          onCloseModal();
          emitClearMovementKeys();
        }
        return;
      }

      if (!active || event.altKey || event.ctrlKey || event.metaKey || editableFocused) {
        return;
      }

      if (key === "i") {
        event.preventDefault();
        emitClearMovementKeys();
        if (modal === "inventory") {
          onCloseModal();
          return;
        }
        if (!anyModalOpen) {
          onOpenModal("inventory");
        }
        return;
      }

      if (key === "q") {
        event.preventDefault();
        emitClearMovementKeys();
        if (modal === "quests" || modal === "quest-board") {
          onCloseModal();
          return;
        }
        if (!anyModalOpen) {
          onOpenModal("quests");
        }
        return;
      }

      if (key === "e" && !anyModalOpen) {
        event.preventDefault();
        onInteract();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    active,
    modal,
    onCloseModal,
    onCloseProfile,
    onInteract,
    onOpenModal,
    profileOpen
  ]);
}
