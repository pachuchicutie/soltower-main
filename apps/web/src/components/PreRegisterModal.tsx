import { useEffect, useState } from "react";
import { Check, LoaderCircle, Wallet, X } from "lucide-react";
import { GameButton, GameModal, ModalHeader } from "./ui/GameUi";
import { createBrowserSupabaseClient } from "../lib/supabase";
import { openReownWalletPicker, useReownWallet, disconnectReownWallet } from "../lib/reown";

interface PreRegisterModalProps {
  onClose: () => void;
}

interface PreRegReward {
  name: string;
  image: string;
  rarity: string;
}

const PRE_REG_REWARDS = {
  weapon: { name: "Rare Weapon", image: "/assets/pre-reg-rewards/rare-weapon.jpg", rarity: "RARE" },
  armor: { name: "Rare Armor", image: "/assets/pre-reg-rewards/rare-armor.jpg", rarity: "RARE" },
  costume: { name: "Rare Costume", image: "/assets/pre-reg-rewards/rare-costume.jpg", rarity: "RARE" },
  gold: 100,
};

const LAUNCH_TIME = new Date("2026-07-09T12:00:00.000Z").getTime();

export function PreRegisterModal({ onClose }: PreRegisterModalProps) {
  const reownWallet = useReownWallet();
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [isPreRegistered, setIsPreRegistered] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [preRegCount, setPreRegCount] = useState(0);

  const walletAddress = reownWallet.address || connectedAddress;

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((LAUNCH_TIME - now) / 1000));
      setTimeLeft(remaining);
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch pre-registration count
  useEffect(() => {
    const fetchCount = async () => {
      const supabase = createBrowserSupabaseClient();
      if (!supabase) return;
      const { count, error } = await supabase
        .from("pre_registrations")
        .select("*", { count: "exact", head: true });
      if (!error && count !== null) {
        setPreRegCount(count);
      }
    };
    void fetchCount();
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
      setError("Failed to connect wallet");
    }
  };

  const handleDisconnect = async () => {
    await disconnectReownWallet();
    setConnectedAddress(null);
    setIsPreRegistered(false);
    setSuccessMessage(null);
    setError(null);
  };

  const handlePreRegister = async () => {
    if (!walletAddress) return;

    setShowConfirm(true);
  };

  const confirmPreRegister = async () => {
    if (!walletAddress) return;

    setShowConfirm(false);
    setIsRegistering(true);
    setError(null);

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
        console.error("Pre-reg insert error:", insertError);
        if (insertError.code === "23505") {
          setIsPreRegistered(true);
          setSuccessMessage("This wallet is already pre-registered.");
        } else {
          setError(insertError.message || "Failed to pre-register");
        }
        return;
      }

      setIsPreRegistered(true);
      setSuccessMessage("Pre-registration successful! Rewards will be sent at launch.");
    } catch (e) {
      setError("Registration failed");
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

          <div className="rewards-section">
            <div className="rewards-grid">
              <div className="reward-card">
                <img src={PRE_REG_REWARDS.weapon.image} alt="Rare Weapon" />
                <div className="reward-name">Rare Weapon</div>
                <div className="reward-rarity">{PRE_REG_REWARDS.weapon.rarity}</div>
              </div>
              <div className="reward-card">
                <img src={PRE_REG_REWARDS.armor.image} alt="Rare Armor" />
                <div className="reward-name">Rare Armor</div>
                <div className="reward-rarity">{PRE_REG_REWARDS.armor.rarity}</div>
              </div>
              <div className="reward-card">
                <img src={PRE_REG_REWARDS.costume.image} alt="Rare Costume" />
                <div className="reward-name">Rare Costume</div>
                <div className="reward-rarity">{PRE_REG_REWARDS.costume.rarity}</div>
              </div>
              <div className="reward-item gold">
                <div className="reward-label">Gold</div>
                <div className="reward-value">{PRE_REG_REWARDS.gold} Gold</div>
              </div>
            </div>
          </div>

          <div className="pre-reg-stats">
            <div className="pre-reg-badge">
              {preRegCount.toLocaleString()} wallets pre-registered
            </div>
          </div>

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
                  <button 
                    onClick={handleDisconnect} 
                    className="disconnect-btn"
                    title="Disconnect wallet"
                  >
                    <X size={14} />
                  </button>
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
