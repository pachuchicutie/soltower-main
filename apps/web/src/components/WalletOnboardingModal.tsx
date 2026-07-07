import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ArrowLeft,
  ChevronDown,
  Code2,
  ExternalLink,
  Sparkle,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  WalletCards
} from "lucide-react";
import {
  displayNameSchema,
  economyConfig,
  heroAssetManifest,
  type HeroDefinition,
  type HeroId,
  type PlayerBootstrapData
} from "@soltower/shared";
import { heroDefinitions } from "@soltower/game-engine";
import { apiPost, WalletAuthError, type WalletAuthErrorCode } from "../lib/api";
import {
  isReownConfigured,
  openReownWalletPicker,
  signReownWalletMessage,
  useReownWallet
} from "../lib/reown";
import { devMockWallet, markDevWalletSession } from "../lib/wallets";
import {
  createWalletAuthRequestId,
  decodeChallengeMessageBase64,
  normalizeWalletSignature,
  validateWalletVerificationPayload
} from "../lib/walletAuth";
import {
  ErrorState,
  GameButton,
  GameModal,
  LoadingState,
  ModalHeader
} from "./ui/GameUi";

interface WalletOnboardingModalProps {
  onClose: () => void;
  onEntered: (bootstrap: PlayerBootstrapData) => void;
  onSpectate: () => void;
}

interface NonceResponse {
  publicKey: string;
  challengeWalletPublicKey: string;
  challengeId: string;
  nonce: string;
  messageBase64: string;
  messageSha256: string;
  expiresAt: string;
  requestId: string;
}

interface VerifiedWallet {
  publicKey: string;
  nonce: string;
  expiresAt: string;
}

interface VerifyResponse extends Partial<PlayerBootstrapData> {
  isNewPlayer: boolean;
  requiresProfile: boolean;
  intro: string;
  verifiedWallet?: VerifiedWallet;
}

interface ProfileResponse extends PlayerBootstrapData {
  isNewPlayer: boolean;
  requiresProfile: false;
  intro: string;
}

type OnboardingStep = "wallet" | "profile" | "ready";
type Availability = "idle" | "checking" | "available" | "taken" | "invalid";
interface OnboardingError {
  code: WalletAuthErrorCode | null;
  message: string;
}

export function WalletOnboardingModal({
  onClose,
  onEntered,
  onSpectate
}: WalletOnboardingModalProps) {
  const reownWallet = useReownWallet();
  const [step, setStep] = useState<OnboardingStep>("wallet");
  const [displayName, setDisplayName] = useState("");
  const [selectedHeroId, setSelectedHeroId] = useState<HeroId>("storm-archer");
  const [availability, setAvailability] = useState<Availability>("idle");
  const [verifiedWallet, setVerifiedWallet] = useState<VerifiedWallet | null>(null);
  const [verifiedWalletName, setVerifiedWalletName] = useState("Solana Wallet");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<OnboardingError | null>(null);
  const [summary, setSummary] = useState<PlayerBootstrapData | null>(null);
  const [busy, setBusy] = useState(false);
  const modalRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const attemptedAddressRef = useRef<string | null>(null);
  const connectRequestedRef = useRef(false);
  const pendingChallengeRef = useRef<NonceResponse | null>(null);
  const pendingSignatureRef = useRef<string | null>(null);
  const currentWalletAddressRef = useRef<string | null>(reownWallet.address);
  currentWalletAddressRef.current = reownWallet.address;
  const isDevMode =
    import.meta.env.VITE_APP_ENV === "development" || import.meta.env.MODE === "test";

  useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const modal = modalRef.current;
    modal?.querySelector<HTMLElement>("button, input, summary")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        onClose();
      }
      if (event.key !== "Tab" || !modal) {
        return;
      }
      const focusables = Array.from(
        modal.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), summary, [href], [tabindex]:not([tabindex='-1'])"
        )
      );
      if (focusables.length === 0) {
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previousFocusRef.current?.focus();
    };
  }, [busy, onClose]);

  useEffect(() => {
    if (
      step !== "wallet" ||
      busy ||
      !connectRequestedRef.current ||
      !reownWallet.isConnected ||
      !reownWallet.address ||
      !reownWallet.provider ||
      attemptedAddressRef.current === reownWallet.address
    ) {
      return;
    }
    attemptedAddressRef.current = reownWallet.address;
    void authenticateWallet(
      reownWallet.address,
      reownWallet.walletName,
      async (message) =>
        signReownWalletMessage(
          reownWallet.provider!,
          reownWallet.walletName,
          message,
          reownWallet.address ?? undefined
        )
    );
  }, [
    busy,
    reownWallet.address,
    reownWallet.isConnected,
    reownWallet.provider,
    reownWallet.walletName,
    step
  ]);

  useEffect(() => {
    if (step !== "profile") {
      return;
    }
    const parsed = displayNameSchema.safeParse(displayName.trim());
    if (!parsed.success) {
      setAvailability(displayName.length === 0 ? "idle" : "invalid");
      return;
    }

    let cancelled = false;
    setAvailability("checking");
    const timer = window.setTimeout(() => {
      void apiPost<{ available: boolean }>("/api/auth/wallet/display-name", {
        displayName: parsed.data
      })
        .then((response) => {
          if (!cancelled) {
            setAvailability(response.available ? "available" : "taken");
          }
        })
        .catch(() => {
          if (!cancelled) {
            setAvailability("idle");
          }
        });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [displayName, step]);

  async function authenticateWallet(
    publicKey: string,
    walletName: string,
    signMessage: (message: Uint8Array) => Promise<unknown>
  ) {
    const requestId = createWalletAuthRequestId();
    let challengeWalletPublicKey: string | null = null;
    setBusy(true);
    setError(null);
    setSummary(null);
    pendingChallengeRef.current = null;
    pendingSignatureRef.current = null;
    setVerifiedWalletName(walletName);
    try {
      setStatus("Creating a single-use login message...");
      const nonce = await apiPost<NonceResponse>("/api/auth/wallet/nonce", {
        publicKeyBase58: publicKey,
        requestId,
        provider: walletName
      });
      pendingChallengeRef.current = nonce;
      challengeWalletPublicKey = nonce.challengeWalletPublicKey ?? nonce.publicKey;
      const currentWalletPublicKey = currentWalletAddressRef.current ?? publicKey;
      if (
        challengeWalletPublicKey !== publicKey ||
        currentWalletPublicKey !== publicKey
      ) {
        throw new WalletAuthError(
          "wallet_changed",
          "The connected wallet changed. Please reconnect and sign again."
        );
      }
      setStatus("Confirm the ownership message in your wallet...");
      const messageBytes = decodeChallengeMessageBase64(nonce.messageBase64);
      let providerSignature: unknown;
      try {
        providerSignature = await signMessage(messageBytes);
      } catch {
        throw new WalletAuthError(
          "provider_sign_message_failure",
          "Your wallet did not sign the login message. Please open it and try again."
        );
      }
      const signatureBase64 = normalizeWalletSignature(providerSignature);
      pendingSignatureRef.current = signatureBase64;
      setStatus("Verifying wallet ownership...");
      const payload = validateWalletVerificationPayload({
        publicKeyBase58: publicKey,
        currentWalletPublicKey,
        challengeId: nonce.challengeId,
        signatureBase64,
        requestId,
        provider: walletName
      }, isDevMode);
      if (isDevMode) {
        console.info("wallet_auth_preverify_diagnostic", {
          provider: walletName,
          challengeId: nonce.challengeId,
          currentWalletPublicKey: maskWalletForLog(currentWalletPublicKey),
          challengeWalletPublicKey: maskWalletForLog(challengeWalletPublicKey),
          signedMessageByteLength: messageBytes.byteLength,
          messageSha256: nonce.messageSha256,
          signatureByteLength: atob(signatureBase64).length,
          signatureEncoding: "base64"
        });
      }
      const response = await apiPost<VerifyResponse>("/api/auth/wallet/verify", payload);
      pendingSignatureRef.current = null;

      if (response.requiresProfile && response.verifiedWallet) {
        setVerifiedWallet(response.verifiedWallet);
        setStep("profile");
        setStatus(null);
        return;
      }
      if (hasBootstrap(response)) {
        setSummary(response);
        setStep("ready");
        setStatus(null);
        return;
      }
      throw new Error("Wallet verification returned an incomplete profile.");
    } catch (caught) {
      const authError =
        caught instanceof WalletAuthError
          ? caught
          : new WalletAuthError(
              "unknown_verification_error",
              caught instanceof Error ? caught.message : "Wallet connection failed."
            );
      setError({ code: authError.code, message: authError.message });
      if (isDevMode) {
        console.error("wallet_auth_failure", {
          code: authError.code,
          message: authError.message,
          provider: walletName,
          currentWalletPublicKey: currentWalletAddressRef.current,
          challengeWalletPublicKey,
          requestId
        });
      }
      setStatus(null);
    } finally {
      connectRequestedRef.current = false;
      setBusy(false);
    }
  }

  async function openWalletPicker() {
    setError(null);
    if (!isReownConfigured) {
      setError({
        code: null,
        message: isDevMode
          ? "Set VITE_REOWN_PROJECT_ID in apps/web/.env.local to enable Reown AppKit."
          : "Wallet connection is temporarily unavailable."
      });
      return;
    }
    connectRequestedRef.current = true;
    if (
      reownWallet.isConnected &&
      reownWallet.address &&
      reownWallet.provider
    ) {
      attemptedAddressRef.current = reownWallet.address;
      await authenticateWallet(
        reownWallet.address,
        reownWallet.walletName,
        async (message) =>
          signReownWalletMessage(
            reownWallet.provider!,
            reownWallet.walletName,
            message,
            reownWallet.address ?? undefined
          )
      );
      return;
    }
    try {
      await openReownWalletPicker();
    } catch (caught) {
      connectRequestedRef.current = false;
      setError({
        code: null,
        message: caught instanceof Error ? caught.message : "Wallet picker could not open."
      });
    }
  }

  async function connectDevWallet() {
    markDevWalletSession();
    attemptedAddressRef.current = devMockWallet.publicKey;
    await authenticateWallet(
      devMockWallet.publicKey,
      devMockWallet.name,
      async () => new Uint8Array(64)
    );
  }

  async function retryWalletAuthentication() {
    pendingSignatureRef.current = null;
    pendingChallengeRef.current = null;
    attemptedAddressRef.current = null;
    setVerifiedWallet(null);
    setSummary(null);
    setError(null);
    setStatus(null);
    connectRequestedRef.current = true;
    if (reownWallet.isConnected && reownWallet.address && reownWallet.provider) {
      attemptedAddressRef.current = reownWallet.address;
      await authenticateWallet(
        reownWallet.address,
        reownWallet.walletName,
        async (message) =>
          signReownWalletMessage(
            reownWallet.provider!,
            reownWallet.walletName,
            message,
            reownWallet.address ?? undefined
          )
      );
      return;
    }
    await openWalletPicker();
  }

  async function createProfile() {
    const parsed = displayNameSchema.safeParse(displayName.trim());
    if (!parsed.success || !verifiedWallet || !selectedHeroId) {
      setAvailability("invalid");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus("Creating your guardian...");
    try {
      const response = await apiPost<ProfileResponse>("/api/auth/wallet/profile", {
        ...verifiedWallet,
        displayName: parsed.data,
        walletName: verifiedWalletName,
        heroId: selectedHeroId
      });
      setSummary(response);
      setStep("ready");
      setStatus(null);
    } catch (caught) {
      setError({
        code: null,
        message: caught instanceof Error ? caught.message : "Profile creation failed."
      });
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  const heading =
    step === "wallet"
      ? "Connect Your Wallet"
      : step === "profile"
        ? "Create Your Guardian"
        : summary
          ? `Welcome, ${summary.player.displayName}`
          : "Welcome to SolBloom Village";

  const description =
    step === "wallet"
      ? "Connect a Solana wallet to save your hero, keep your progress, and enter SolBloom Village."
      : step === "profile"
        ? "Choose your starter hero and set the name other guardians will see in the village."
        : "Your guardian is ready for the village.";

  return (
    <GameModal
      ref={modalRef}
      className={`wallet-modal is-${step}`}
      backdropClassName="onboarding-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-title"
      aria-describedby="wallet-description"
    >
      <ModalHeader
        eyebrow="Enter SolBloom Village"
        title={heading}
        description={description}
        onClose={onClose}
        closeDisabled={busy}
        titleId="wallet-title"
        descriptionId="wallet-description"
        closeLabel="Close wallet onboarding"
      />

      {step === "wallet" ? (
        <div className="wallet-entry-step">
          <div className="signature-note">
            <ShieldCheck size={20} aria-hidden="true" />
            <span>
              Signing confirms wallet ownership only. SolTower never moves funds or requests
              transaction approval during sign-in.
            </span>
          </div>
          <TokenAccessNote isDevMode={isDevMode} />
          <GameButton
            variant="primary"
            className="wallet-connect-command"
            disabled={busy || (!isReownConfigured && !isDevMode)}
            onClick={() => void openWalletPicker()}
          >
            {busy ? <LoaderCircle className="spin" size={19} /> : <WalletCards size={20} />}
            Connect Wallet
          </GameButton>
          <button type="button" className="spectate-link" onClick={onSpectate} disabled={busy}>
            Spectate SolBloom Village instead
          </button>
          {!isReownConfigured && isDevMode ? (
            <div className="reown-config-note" role="note">
              <Code2 size={17} aria-hidden="true" />
              <span>
                Reown is not configured. Set <code>VITE_REOWN_PROJECT_ID</code> in{" "}
                <code>apps/web/.env.local</code>.
              </span>
            </div>
          ) : null}
          {isDevMode ? (
            <details className="developer-options">
              <summary>
                <span>Developer options</span>
                <ChevronDown size={16} aria-hidden="true" />
              </summary>
              <GameButton
                variant="ghost"
                className="dev-wallet-command"
                disabled={busy}
                onClick={() => void connectDevWallet()}
              >
                <Code2 size={18} />
                DEV ONLY — NOT A REAL WALLET
              </GameButton>
            </details>
          ) : null}
          <p className="wallet-safety-footer">
            No transactions. No approvals. Your wallet stays in your control.
          </p>
        </div>
      ) : null}

      {step === "profile" ? (
        <form
          className="character-setup"
          onSubmit={(event) => {
            event.preventDefault();
            void createProfile();
          }}
        >
          <HeroStarterSelection
            selectedHeroId={selectedHeroId}
            onSelectHero={setSelectedHeroId}
          />
          <label>
            Display name
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              minLength={2}
              maxLength={24}
              autoComplete="off"
              autoFocus
              aria-describedby="display-name-status"
              placeholder="Your guardian name"
            />
          </label>
          <p
            id="display-name-status"
            className={`name-availability is-${availability}`}
            aria-live="polite"
          >
            {availabilityMessage(availability)}
          </p>
          <div className="starter-grant-note">
            You will begin with <strong>50 Locked Gold</strong> and starter gear.
          </div>
          <GameButton
            variant="primary"
            type="submit"
            disabled={busy || availability !== "available" || !selectedHeroId}
          >
            {busy ? <LoaderCircle className="spin" size={18} /> : <ShieldCheck size={18} />}
            Create Guardian
          </GameButton>
          <GameButton
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setStep("wallet");
              setVerifiedWallet(null);
              setError(null);
              setStatus(null);
            }}
          >
            <ArrowLeft size={17} /> Back
          </GameButton>
        </form>
      ) : null}

      {step === "ready" && summary ? (
        <div className="profile-preview">
          <ProfilePreviewStat label="Account Level" value={summary.player.accountLevel} />
          <ProfilePreviewStat label="Earned Gold" value={summary.player.balances.EARNED_GOLD} />
          <ProfilePreviewStat label="Locked Gold" value={summary.player.balances.LOCKED_GOLD} />
          <ProfilePreviewStat
            label="Test Token · DEV"
            value={summary.player.balances.TEST_TOKEN}
          />
          <ProfilePreviewStat
            label="Hero"
            value={
              heroDefinitions.find((hero) => hero.id === summary.selectedHeroId)?.name ??
              summary.selectedHeroId
            }
          />
          <ProfilePreviewStat label="Power" value={summary.player.power} />
          <ProfilePreviewStat label="Unlocked Maps" value={summary.unlockedMapCount} />
          <GameButton variant="primary" onClick={() => onEntered(summary)}>
            <Sparkles size={18} /> Enter Village
          </GameButton>
        </div>
      ) : null}

      {status ? <LoadingState>{status}</LoadingState> : null}
      {error ? (
        <ErrorState
          action={
            reownWallet.isConnected && step === "wallet" ? (
              <GameButton variant="ghost" onClick={() => void retryWalletAuthentication()}>
                Try Again
              </GameButton>
            ) : undefined
          }
        >
          {error.message}
        </ErrorState>
      ) : null}
    </GameModal>
  );
}

function TokenAccessNote({ isDevMode }: { isDevMode: boolean }) {
  const playRequirement = economyConfig.tokenGate.playMinimumTower.toLocaleString();
  const sellRequirement = economyConfig.tokenGate.sellerMinimumTower.toLocaleString();
  const towerLabel = isDevMode
    ? `${economyConfig.towerToken.symbol} (DEV)`
    : economyConfig.towerToken.symbol;
  return (
    <div className="token-access-note" role="note">
      <ShieldCheck size={19} aria-hidden="true" />
      <div>
        <strong>{playRequirement} {towerLabel} required to enter SolBloom Village.</strong>
        <span>
          Selling Gold or auction items requires Level {economyConfig.tokenGate.sellerMinimumAccountLevel} and{" "}
          {sellRequirement} {towerLabel}. Buying remains open.
        </span>
        {isDevMode ? (
          <small>Local development shows this gate but skips wallet-token enforcement for testing.</small>
        ) : null}
      </div>
      <a
        href={economyConfig.towerToken.jupiterSwapUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={`Get ${economyConfig.towerToken.symbol} on Jupiter`}
      >
        <ExternalLink size={15} aria-hidden="true" />
        Jupiter
      </a>
    </div>
  );
}

function HeroStarterSelection({
  selectedHeroId,
  onSelectHero
}: {
  selectedHeroId: HeroId;
  onSelectHero: (heroId: HeroId) => void;
}) {
  const selectedHero =
    heroDefinitions.find((hero) => hero.id === selectedHeroId) ?? heroDefinitions[0];

  return (
    <section className="starter-hero-selection" aria-labelledby="starter-hero-selection-title">
      <div className="starter-section-heading">
        <span>Starter Hero</span>
        <h3 id="starter-hero-selection-title">Choose Your First Guardian</h3>
        <p>Pick the playstyle you want to begin with. You can unlock more heroes later.</p>
      </div>
      <div className="starter-hero-grid" role="listbox" aria-label="Starter heroes">
        {heroDefinitions.map((hero) => (
          <HeroSelectionCard
            key={hero.id}
            hero={hero}
            selected={hero.id === selectedHeroId}
            onSelect={() => onSelectHero(hero.id)}
          />
        ))}
      </div>
      <HeroPreviewPanel hero={selectedHero} />
    </section>
  );
}

function HeroSelectionCard({
  hero,
  selected,
  onSelect
}: {
  hero: HeroDefinition;
  selected: boolean;
  onSelect: () => void;
}) {
  const assets = heroAssetManifest[hero.id];

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      className={`starter-hero-card ${selected ? "is-selected" : ""}`}
      onClick={onSelect}
      style={{ "--hero-accent": hero.accent } as CSSProperties}
    >
      <span className="starter-hero-card-frame">
        <img src={assets.previewIconPath} alt="" loading="lazy" decoding="async" />
      </span>
      <span className="starter-hero-card-copy">
        <span className="starter-hero-card-role">{hero.className}</span>
        <strong>{hero.name}</strong>
        <small>{hero.tagline}</small>
      </span>
      {selected ? <span className="starter-selected-pill">Selected</span> : null}
    </button>
  );
}

function HeroPreviewPanel({ hero }: { hero: HeroDefinition }) {
  const previewLayout = heroPreviewSpriteLayout(hero.id);

  return (
    <article
      className="selected-hero-panel"
      style={{ "--hero-accent": hero.accent } as CSSProperties}
    >
      <div className="selected-hero-stage" aria-label={`${hero.name} walking preview`}>
        <SpriteAnimator
          layout={previewLayout}
          heroName={hero.name}
        />
        <span className="selected-hero-glow" aria-hidden="true" />
      </div>
      <div className="selected-hero-copy">
        <div className="selected-hero-title-row">
          <div>
            <span>{hero.className}</span>
            <h3>{hero.name}</h3>
          </div>
          <span className="selected-hero-ultimate">{hero.ultimate}</span>
        </div>
        <p>{hero.description}</p>
        <div className="selected-hero-meta">
          <span>
            <strong>Attack</strong>
            {hero.attackType}
          </span>
          <span>
            <strong>Best For</strong>
            {hero.bestFor}
          </span>
          <span>
            <strong>Starter Gear</strong>
            {hero.starterGearSummary}
          </span>
        </div>
        <HeroStatBars hero={hero} />
        <div className="hero-traits-grid">
          <HeroTraitList title="Strengths" items={hero.strengths} />
          <HeroTraitList title="Tradeoffs" items={hero.weaknesses} />
        </div>
      </div>
    </article>
  );
}

interface SpritePreviewLayout {
  spritePath: string;
  rows: number;
  row: number;
  durationMs: number;
}

function heroPreviewSpriteLayout(heroId: HeroId): SpritePreviewLayout {
  if (heroId === "storm-archer") {
    return {
      spritePath: "/assets/soltower/heroes/storm-archer/walk-8dir.png?v=video-all-directions",
      rows: 8,
      row: 7,
      durationMs: 720
    };
  }
  if (heroId === "tide-mage") {
    return {
      spritePath: "/assets/soltower/heroes/tide-mage/walk-8dir.png?v=video-all-directions",
      rows: 8,
      row: 7,
      durationMs: 720
    };
  }
  if (heroId === "bombardier") {
    return {
      spritePath: "/assets/soltower/heroes/bombardier/walk-8dir.png?v=video-all-directions",
      rows: 8,
      row: 7,
      durationMs: 720
    };
  }
  if (heroId === "coral-alchemist") {
    return {
      spritePath: "/assets/soltower/heroes/coral-alchemist/walk-8dir.png?v=video-all-directions",
      rows: 8,
      row: 7,
      durationMs: 720
    };
  }
  return {
    spritePath: heroAssetManifest[heroId].worldSpritePaths.walk,
    rows: 4,
    row: 0,
    durationMs: 820
  };
}

function SpriteAnimator({ layout, heroName }: { layout: SpritePreviewLayout; heroName: string }) {
  return (
    <div
      className="sprite-animator"
      role="img"
      aria-label={`${heroName} walking animation`}
      style={
        {
          backgroundImage: `url("${layout.spritePath}")`,
          "--sprite-rows": layout.rows,
          "--sprite-row": layout.row,
          "--sprite-duration": `${layout.durationMs}ms`
        } as CSSProperties
      }
    />
  );
}

const heroStatLabels: Array<{
  key: keyof HeroDefinition["onboardingStats"];
  label: string;
}> = [
  { key: "power", label: "Power" },
  { key: "damage", label: "Damage" },
  { key: "attackSpeed", label: "Attack Speed" },
  { key: "range", label: "Range" },
  { key: "survivability", label: "Survivability" },
  { key: "utility", label: "Utility" },
  { key: "difficulty", label: "Difficulty" }
];

function HeroStatBars({ hero }: { hero: HeroDefinition }) {
  return (
    <div className="hero-stat-bars" aria-label={`${hero.name} starter stats`}>
      {heroStatLabels.map((stat) => {
        const value = hero.onboardingStats[stat.key];
        return (
          <div className="hero-stat-row" key={stat.key}>
            <span>{stat.label}</span>
            <div className="hero-stat-track" aria-hidden="true">
              <span style={{ width: `${value}%` }} />
            </div>
            <strong>{value}</strong>
          </div>
        );
      })}
    </div>
  );
}

function HeroTraitList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="hero-trait-list">
      <span>{title}</span>
      <ul>
        {items.map((item) => (
          <li key={item}>
            <Sparkle size={12} aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function maskWalletForLog(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return value.length <= 10 ? `${value.slice(0, 2)}...` : `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function hasBootstrap(response: VerifyResponse): response is VerifyResponse & PlayerBootstrapData {
  return Boolean(response.player && response.profile);
}

function availabilityMessage(availability: Availability): string {
  if (availability === "checking") return "Checking availability...";
  if (availability === "available") return "Name available.";
  if (availability === "taken") return "That name is already in use.";
  if (availability === "invalid") {
    return "Use 2-24 letters, numbers, spaces, underscores, or hyphens.";
  }
  return "Choose a unique name for SolBloom Village.";
}

function ProfilePreviewStat({ label, value }: { label: string; value: string | number }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
