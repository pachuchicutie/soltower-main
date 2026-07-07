import { create } from "zustand";

export type ModalKey =
  | "hero"
  | "inventory"
  | "market"
  | "friends"
  | "quests"
  | "settings"
  | "raid-captain"
  | "market-broker"
  | "blacksmith"
  | "quest-board"
  | "blackjack"
  | "tavern"
  | "event-board"
  | "open_starlight_vault";

interface UiStore {
  modal: ModalKey | null;
  openModal: (modal: ModalKey) => void;
  closeModal: () => void;
}

export const useUiStore = create<UiStore>((set) => ({
  modal: null,
  openModal: (modal) => set({ modal }),
  closeModal: () => set({ modal: null })
}));
