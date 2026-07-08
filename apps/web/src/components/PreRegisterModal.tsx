import { useEffect, useState } from "react";
import { Check, LoaderCircle, Wallet, X } from "lucide-react";
import { GameButton, GameModal, ModalHeader } from "./ui/GameUi";
import { createBrowserSupabaseClient } from "../lib/supabase";
import { openReownWalletPicker, useReownWallet } from "../lib/reown";

interface PreRegisterModalProps {
  onClose: () => void;
}

interface PreRegRewards {
  weapons: string[];
  armors: string[];
  costumes: string[];
  gold: number;
}

const PRE_REG_REWARDS: PreRegRewards = {
  weapons: ["Embershot Cannon", "Tidecall Staff", "Starlit Bow"],
  armors: ["Tideglass Mantle", "Reefguard Plate"],
  costumes: ["Capybara Vacation", "Banana Guardian", "Midnight Drum Runner"],
  gold: 100,
};

export function PreRegisterModal({ onClose }: PreRegisterModalProps) {
  const reownWallet = useReownWallet();
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [isPreRegistered, setIsPreRegistered] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const walletAddress = reownWallet.address || connectedAddress;

  // Check if already pre-registered when wallet connects
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
      // The hook will update the address
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
          // unique violation
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
          {/* Rewards Section - Compact */}
          <div className="rewards-section">
            <div className="rewards-header">Pre-Register Rewards</div>
            <div className="rewards-grid">
              <div className="reward-item">
                <div className="reward-label">Rare Weapons</div>
                <div className="reward-list">{PRE_REG_REWARDS.weapons.join(", ")}</div>
              </div>
              <div className="reward-item">
                <div className="reward-label">Rare Armors</div>
                <div className="reward-list">{PRE_REG_REWARDS.armors.join(", ")}</div>
              </div>
              <div className="reward-item">
                <div className="reward-label">Rare Costumes</div>
                <div className="reward-list">{PRE_REG_REWARDS.costumes.join(", ")}</div>
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
