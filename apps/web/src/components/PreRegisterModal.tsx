import { useEffect, useState } from "react";
import { Check, LoaderCircle, Wallet, X } from "lucide-react";
import { GameButton, GameModal, ModalHeader } from "./ui/GameUi";
import { createBrowserSupabaseClient } from "../lib/supabase";
import { openReownWalletPicker, useReownWallet } from "../lib/reown";

interface PreRegisterModalProps {
  onClose: () => void;
}

interface PreRegReward {
  name: string;
  image: string;
  rarity: string;
}

const PRE_REG_REWARDS = {
  weapon: { name: "Embershot Cannon", image: "/assets/vault/rewards/weapons/embershot-cannon.png", rarity: "RARE" },
  armor: { name: "Tideglass Mantle", image: "/assets/vault/rewards/armor/tideglass-mantle.png", rarity: "RARE" },
  costume: { name: "Capybara Vacation", image: "/assets/costumes/capybara-vacation/storm-archer/idle-front.png", rarity: "RARE" },
  gold: 100,
};

const INITIAL_COUNTDOWN = 3 * 60 * 60; // 3 hours in seconds

export function PreRegisterModal({ onClose }: PreRegisterModalProps) {
  const reownWallet = useReownWallet();
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [isPreRegistered, setIsPreRegistered] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(INITIAL_COUNTDOWN);

  const walletAddress = reownWallet.address || connectedAddress;

  // Live ticking countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!walletAddress) {
      setIsPreRegistered(false);
      setSuccessMessage(null);
      return;
    }

    const checkRegistration = async () => {
      setIsChecking(true);
      setError(null);
      try {
        const supabase = createBrowserSupabaseClient();
        if (!supabase) {
          setError("Supabase not configured");
          return;
        }
        const { data, error: queryError } = await supabase
          .from("pre_registrations")
          .select("wallet_address")
          .eq("wallet_address", walletAddress)
          .maybeSingle();

        if (queryError) {
          console.error("Pre-reg check error:", queryError);
          setError("Could not check registration");
          return;
        }

        if (data) {
          setIsPreRegistered(true);
          setSuccessMessage("This wallet is already pre-registered.");
        } else {
          setIsPreRegistered(false);
        }
      } catch (e) {
        setError("Check failed");
      } finally {
        setIsChecking(false);
      }
    };

    void checkRegistration();
  }, [walletAddress]);

  const handleConnectWallet = async () => {
    setError(null);
    try {
      await openReownWalletPicker();
    } catch (e) {
      setError("Failed to open wallet picker");
    }
  };

  const handlePreRegister = () => {
    if (!walletAddress) return;
    setShowConfirm(true);
  };

  const confirmPreRegister = async () => {
    if (!walletAddress) return;

    setIsRegistering(true);
    setError(null);
    setShowConfirm(false);

    try {
      const supabase = createBrowserSupabaseClient();
      if (!supabase) {
        setError("Supabase not configured");
        return;
      }

      const { error: insertError } = await supabase
        .from("pre_registrations")
        .insert({ wallet_address: walletAddress });

      if (insertError) {
        if (insertError.code === "23505") {
          setIsPreRegistered(true);
          setSuccessMessage("Already pre-registered.");
        } else {
          setError("Registration failed. Try again.");
        }
        return;
      }

      setIsPreRegistered(true);
      setSuccessMessage("Congrats! Wallet pre-registered. Rewards at launch.");
    } catch (e) {
      setError("Registration error");
    } finally {
      setIsRegistering(false);
    }
  };

  const cancelConfirm = () => {
    setShowConfirm(false);
  };

  const handleClose = () => {
    onClose();
  };

  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;

  return (
    <GameModal>
      <div className="game-modal-content pre-register-modal">
        <ModalHeader
          eyebrow="LAUNCH"
          title="Pre-Register"
          description="Secure exclusive rewards"
          onClose={handleClose}
          titleId="pre-reg-title"
          closeLabel="Close pre-register"
        />

        <div className="pre-reg-content">
          {/* Live 3-hour Countdown - ticking per second */}
          <div className="countdown-section">
            <div className="countdown-label">LAUNCH IN</div>
            <div className="countdown-timer">
              <div className="countdown-unit">
                <span className="countdown-value">{String(hours).padStart(2, "0")}</span>
                <span className="countdown-label-small">HRS</span>
              </div>
              <div className="countdown-separator">:</div>
              <div className="countdown-unit">
                <span className="countdown-value">{String(minutes).padStart(2, "0")}</span>
                <span className="countdown-label-small">MIN</span>
              </div>
              <div className="countdown-separator">:</div>
              <div className="countdown-unit">
                <span className="countdown-value">{String(seconds).padStart(2, "0")}</span>
                <span className="countdown-label-small">SEC</span>
              </div>
            </div>
          </div>

          {/* Rewards Section - 3 shiny cards with images */}
          <div className="rewards-section">
            <div className="rewards-header">Pre-Register Rewards</div>
            <div className="rewards-grid">
              <div className="reward-card">
                <img src={PRE_REG_REWARDS.weapon.image} alt={PRE_REG_REWARDS.weapon.name} />
                <div className="reward-name">{PRE_REG_REWARDS.weapon.name}</div>
                <div className="reward-rarity">{PRE_REG_REWARDS.weapon.rarity}</div>
              </div>
              <div className="reward-card">
                <img src={PRE_REG_REWARDS.armor.image} alt={PRE_REG_REWARDS.armor.name} />
                <div className="reward-name">{PRE_REG_REWARDS.armor.name}</div>
                <div className="reward-rarity">{PRE_REG_REWARDS.armor.rarity}</div>
              </div>
              <div className="reward-card">
                <img src={PRE_REG_REWARDS.costume.image} alt={PRE_REG_REWARDS.costume.name} />
                <div className="reward-name">{PRE_REG_REWARDS.costume.name}</div>
                <div className="reward-rarity">{PRE_REG_REWARDS.costume.rarity}</div>
              </div>
              <div className="reward-item gold">
                <div className="reward-label">Gold</div>
                <div className="reward-value">{PRE_REG_REWARDS.gold} Gold</div>
              </div>
            </div>
          </div>

          {/* Wallet Connection Section */}
          <div className="wallet-section">
            {!walletAddress ? (
              <GameButton
                variant="primary"
                onClick={handleConnectWallet}
                className="connect-wallet-btn"
              >
                <Wallet size={16} /> Connect Wallet
              </GameButton>
            ) : (
              <div className="wallet-connected">
                <div className="wallet-address">
                  {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
                </div>
                {isChecking ? (
                  <div className="status">Checking...</div>
                ) : isPreRegistered ? (
                  <GameButton variant="secondary" disabled className="pre-reg-btn">
                    <Check size={16} /> Pre Registered
                  </GameButton>
                ) : (
                  <GameButton
                    variant="primary"
                    onClick={handlePreRegister}
                    disabled={isRegistering}
                    className="pre-reg-btn"
                  >
                    {isRegistering ? (
                      <LoaderCircle size={16} className="animate-spin" />
                    ) : (
                      "Pre Register"
                    )}
                  </GameButton>
                )}
              </div>
            )}
          </div>

          {error && <div className="error-text">{error}</div>}
          {successMessage && <div className="success-text">{successMessage}</div>}

          {/* Confirmation Dialog */}
          {showConfirm && (
            <div className="confirm-overlay">
              <div className="confirm-box">
                <div className="confirm-text">Confirm pre-register with this wallet?</div>
                <div className="confirm-actions">
                  <GameButton variant="secondary" onClick={cancelConfirm}>
                    Cancel
                  </GameButton>
                  <GameButton variant="primary" onClick={confirmPreRegister}>
                    Confirm
                  </GameButton>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="pre-reg-footer">
          <div className="note">Rewards distributed at launch. One wallet per pre-reg.</div>
        </div>
      </div>
    </GameModal>
  );
}
