import { create } from "zustand";

export type AdminSection =
  | "dashboard"
  | "players"
  | "economy"
  | "market"
  | "blackjack"
  | "raids"
  | "content"
  | "quests"
  | "chat"
  | "moderation"
  | "announcements"
  | "audit"
  | "admins"
  | "system"
  | "devtools";

interface AdminUiState {
  section: AdminSection;
  setSection: (section: AdminSection) => void;
}

export const useAdminUi = create<AdminUiState>((set) => ({
  section: "dashboard",
  setSection: (section) => set({ section })
}));
