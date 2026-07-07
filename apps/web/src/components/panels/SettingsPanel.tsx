import { useEffect, useState } from "react";
import { Camera, Copy, LogOut, Unplug } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { uiAssetManifest, type PlayerBootstrapData } from "@soltower/shared";
import {
  applyAudioSettings,
  playAmbience,
  playMusic,
  playUiSound,
  stopAudioPreviews
} from "../../lib/audio";
import { apiGet } from "../../lib/api";
import { useHeroAppearance } from "../../lib/heroAppearance";
import { useUserSettings } from "../../lib/userSettings";
import {
  AssetIcon,
  ConfirmationDialog,
  CurrencyChip,
  GameButton,
  GameCard,
  ModalTabs,
  SettingsSlider,
  ToggleRow
} from "../ui/GameUi";
import { HeroAppearancePreview } from "../ui/HeroAppearancePreview";
import {
  ShortcutHint,
  type ShortcutGroupDefinition,
  townShortcutGroups
} from "../ui/ShortcutHint";

type SettingsTab = "audio" | "motion" | "accessibility" | "controls" | "account";

const tabs: Array<{ id: SettingsTab; label: string; iconSrc: string }> = [
  { id: "audio", label: "Audio", iconSrc: uiAssetManifest.icons.sound },
  { id: "motion", label: "Motion", iconSrc: uiAssetManifest.icons.settings },
  { id: "accessibility", label: "Accessibility", iconSrc: uiAssetManifest.icons.achievement },
  { id: "controls", label: "Controls", iconSrc: uiAssetManifest.icons.heroLoadout },
  { id: "account", label: "Account", iconSrc: uiAssetManifest.icons.wallet }
];

const controlGroups: ShortcutGroupDefinition[] = [
  ...townShortcutGroups,
  { keys: ["Esc"], label: "Close" }
];

export function SettingsPanel({
  onCenterCamera,
  onLogout
}: {
  onCenterCamera?: () => void;
  onLogout?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("audio");
  const [settings, updateSettings] = useUserSettings();
  const [confirmation, setConfirmation] = useState<"disconnect" | "logout" | null>(null);
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<PlayerBootstrapData>("/api/player/me")
  });
  const [appearance] = useHeroAppearance(me.data?.selectedHeroId ?? "storm-archer");

  useEffect(() => {
    applyAudioSettings(settings);
  }, [settings]);

  return (
    <div className="settings-panel-v2">
      <ModalTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} label="Settings tabs" />

      {activeTab === "audio" ? (
        <section className="settings-tab-panel" aria-label="Audio settings">
          <GameCard>
            <SettingsSlider
              label="Master Volume"
              value={settings.masterVolume}
              onChange={(masterVolume) => updateSettings({ masterVolume })}
            />
            <SettingsSlider
              label="Background Music"
              value={settings.musicVolume}
              disabled={settings.muteAll || settings.muteMusic}
              onChange={(musicVolume) => updateSettings({ musicVolume })}
            />
            <SettingsSlider
              label="Sound Effects"
              value={settings.sfxVolume}
              disabled={settings.muteAll || settings.muteSfx}
              onChange={(sfxVolume) => updateSettings({ sfxVolume })}
            />
          </GameCard>
          <GameCard>
            <ToggleRow label="Mute All" checked={settings.muteAll} onChange={(muteAll) => updateSettings({ muteAll })} />
            <ToggleRow label="Mute Music" checked={settings.muteMusic} onChange={(muteMusic) => updateSettings({ muteMusic })} />
            <ToggleRow label="Mute SFX" checked={settings.muteSfx} onChange={(muteSfx) => updateSettings({ muteSfx })} />
          </GameCard>
          <div className="button-row">
            <GameButton variant="secondary" onClick={() => playUiSound("success")}>
              <AssetIcon src={uiAssetManifest.icons.sound} /> Test UI Sound
            </GameButton>
            <GameButton variant="secondary" onClick={() => playAmbience("softVillage")}>
              <AssetIcon src={uiAssetManifest.icons.music} /> Test Village Ambience
            </GameButton>
            <GameButton variant="ghost" onClick={playMusic}>
              <AssetIcon src={uiAssetManifest.icons.music} /> Test BGM
            </GameButton>
            <GameButton variant="ghost" onClick={stopAudioPreviews}>
              Stop Audio
            </GameButton>
          </div>
        </section>
      ) : null}

      {activeTab === "motion" ? (
        <section className="settings-tab-panel" aria-label="Motion settings">
          <GameCard>
            <ToggleRow
              label="Reduced Motion"
              description="Reduces interface transitions and future animated effects."
              checked={settings.reducedMotion}
              onChange={(reducedMotion) => updateSettings({ reducedMotion })}
            />
            <ToggleRow
              label="Camera Follow"
              description="Authenticated town camera follows the active Hero."
              checked={settings.cameraFollow}
              onChange={(cameraFollow) => updateSettings({ cameraFollow })}
            />
            <SettingsSlider
              label="Camera Height"
              value={settings.cameraZoom}
              onChange={(cameraZoom) => updateSettings({ cameraZoom })}
            />
            <ToggleRow
              label="Show Raid Range Circles"
              description="Shows each guardian's attack coverage during raids."
              checked={settings.showRaidRanges}
              onChange={(showRaidRanges) => updateSettings({ showRaidRanges })}
            />
            <ToggleRow
              label="Screen Shake"
              description="Prepared for future raid impact effects."
              checked={settings.screenShake}
              onChange={(screenShake) => updateSettings({ screenShake })}
            />
          </GameCard>
          <GameButton variant="secondary" onClick={onCenterCamera}>
            <Camera size={17} /> Center Camera
          </GameButton>
        </section>
      ) : null}

      {activeTab === "accessibility" ? (
        <section className="settings-tab-panel" aria-label="Accessibility settings">
          <GameCard>
            <ToggleRow
              label="Larger UI Text"
              checked={settings.largerText}
              onChange={(largerText) => updateSettings({ largerText })}
            />
            <ToggleRow
              label="Higher Contrast"
              checked={settings.highContrast}
              onChange={(highContrast) => updateSettings({ highContrast })}
            />
            <ToggleRow
              label="Reduce Particle Intensity"
              checked={settings.reducedParticles}
              onChange={(reducedParticles) => updateSettings({ reducedParticles })}
            />
          </GameCard>
        </section>
      ) : null}

      {activeTab === "controls" ? (
        <section className="settings-tab-panel" aria-label="Control shortcuts">
          <GameCard className="settings-controls-card">
            <ShortcutHint className="settings-shortcut-hint" groups={controlGroups} />
          </GameCard>
        </section>
      ) : null}

      {activeTab === "account" ? (
        <section className="settings-tab-panel" aria-label="Account settings">
          <GameCard className="account-card">
            <HeroAppearancePreview
              heroId={me.data?.selectedHeroId ?? "storm-archer"}
              appearance={appearance}
              size="portrait"
              className="hero-card-preview"
              label="Active Hero"
            />
            <div>
              <span className="game-eyebrow">Connected Wallet</span>
              <strong>{me.data?.player.displayName ?? "Guardian"}</strong>
              <small>{me.data?.profile.shortenedWalletAddress ?? "No wallet linked"}</small>
            </div>
          </GameCard>
          <div className="wallet-address-box">
            <span>{me.data?.profile.fullWalletAddress ?? "No wallet linked"}</span>
            <GameButton
              variant="secondary"
              onClick={() => {
                if (me.data?.profile.fullWalletAddress) {
                  void navigator.clipboard.writeText(me.data.profile.fullWalletAddress);
                }
              }}
            >
              <Copy size={16} /> Copy Address
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
        </section>
      ) : null}

      {confirmation ? (
        <ConfirmationDialog
          title={confirmation === "disconnect" ? "Disconnect Wallet?" : "Log Out to Landing?"}
          description="This closes the authenticated town session on this device. Your SolTower account, wallet ownership, inventory, and progress remain saved."
          confirmLabel={confirmation === "disconnect" ? "Disconnect" : "Log Out"}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            setConfirmation(null);
            onLogout?.();
          }}
        />
      ) : null}
    </div>
  );
}
