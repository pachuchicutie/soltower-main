import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Backpack, BookOpen, Copy, LogOut, Settings, Unplug, UserRound } from "lucide-react";
import { heroDefinitions } from "@soltower/game-engine";
import {
  heroPreviewIconPath,
  uiAssetManifest,
  type PlayerBootstrapData
} from "@soltower/shared";
import { useModalFocusTrap } from "../hooks/useModalFocusTrap";
import { apiGet } from "../lib/api";
import { useHeroAppearance } from "../lib/heroAppearance";
import type { ModalKey } from "../store/ui";
import {
  ConfirmationDialog,
  CurrencyChip,
  GameButton,
  GameCard,
  GameModal,
  ModalHeader,
  StatRow
} from "./ui/GameUi";
import { HeroAppearancePreview } from "./ui/HeroAppearancePreview";

interface ProfilePanelProps {
  onClose: () => void;
  onDisconnect: () => void;
  onOpenModal: (modal: ModalKey) => void;
}

export function ProfilePanel({ onClose, onDisconnect, onOpenModal }: ProfilePanelProps) {
  const modalRef = useRef<HTMLElement>(null);
  const [confirmation, setConfirmation] = useState<"disconnect" | "logout" | null>(null);
  useModalFocusTrap(modalRef, onClose);
  const profile = useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<PlayerBootstrapData>("/api/player/me")
  });
  const data = profile.data;
  const selectedHero = heroDefinitions.find((hero) => hero.id === data?.selectedHeroId) ?? heroDefinitions[0];
  const [appearance] = useHeroAppearance(selectedHero.id);

  const openLinkedModal = (modal: ModalKey) => {
    onClose();
    onOpenModal(modal);
  };

  return (
    <GameModal
      ref={modalRef}
      className="profile-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-title"
      tabIndex={-1}
    >
      <ModalHeader
        eyebrow="Player Profile"
        title={data?.player.displayName ?? "Wallet"}
        description={data?.profile.shortenedWalletAddress ?? "No wallet linked"}
        iconSrc={heroPreviewIconPath(selectedHero.id)}
        iconAlt={selectedHero.name}
        onClose={onClose}
        titleId="profile-title"
        closeLabel="Close profile"
      />

      <GameCard className="profile-hero-summary">
        <HeroAppearancePreview
          heroId={selectedHero.id}
          appearance={appearance}
          size="portrait"
          className="hero-card-preview"
          label={selectedHero.name}
        />
        <div>
          <span className="game-eyebrow">Active Hero</span>
          <strong>{selectedHero.name}</strong>
          <small>{selectedHero.role}</small>
        </div>
      </GameCard>

      <div className="wallet-address-box">
        <span>{data?.profile.fullWalletAddress ?? "No wallet linked"}</span>
        <GameButton
          variant="secondary"
          onClick={() => {
            if (data?.profile.fullWalletAddress) {
              void navigator.clipboard.writeText(data.profile.fullWalletAddress);
            }
          }}
        >
          <Copy size={16} /> Copy Address
        </GameButton>
      </div>

      {data ? (
        <div className="profile-detail-grid">
          <StatRow label="Account Level" value={data.profile.accountLevel} />
          <StatRow label="Power" value={data.profile.power} />
          <StatRow label="Earned Gold" value={data.profile.balances.EARNED_GOLD} />
          <StatRow label="Locked Gold" value={data.profile.balances.LOCKED_GOLD} />
          <StatRow label="$TOWER (DEV)" value={data.profile.balances.TEST_TOKEN} />
          <StatRow label="Unlocked Maps" value={data.profile.unlockedMaps.length} />
        </div>
      ) : (
        <p>Loading profile...</p>
      )}

      <div className="profile-menu-grid">
        <GameButton variant="secondary" onClick={() => openLinkedModal("hero")}>
          <UserRound size={17} /> View Hero / Loadout
        </GameButton>
        <GameButton variant="secondary" onClick={() => openLinkedModal("inventory")}>
          <Backpack size={17} /> Inventory
        </GameButton>
        <GameButton variant="secondary" onClick={() => openLinkedModal("quests")}>
          <BookOpen size={17} /> Quests
        </GameButton>
        <GameButton variant="secondary" onClick={() => openLinkedModal("settings")}>
          <Settings size={17} /> Settings
        </GameButton>
      </div>

      <CurrencyChip
        iconSrc={uiAssetManifest.icons.disconnect}
        label="Disconnecting ends the local session but does not remove account ownership."
      />

      <div className="button-row">
        <GameButton variant="danger" onClick={() => setConfirmation("disconnect")}>
          <Unplug size={17} /> Disconnect Wallet
        </GameButton>
        <GameButton variant="ghost" onClick={() => setConfirmation("logout")}>
          <LogOut size={17} /> Log Out to Landing
        </GameButton>
      </div>

      {confirmation ? (
        <ConfirmationDialog
          title={confirmation === "disconnect" ? "Disconnect Wallet?" : "Log Out to Landing?"}
          description="This closes the authenticated town session on this device. Your SolTower account, wallet ownership, inventory, and progress remain saved."
          confirmLabel={confirmation === "disconnect" ? "Disconnect" : "Log Out"}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            setConfirmation(null);
            onDisconnect();
          }}
        />
      ) : null}
    </GameModal>
  );
}
