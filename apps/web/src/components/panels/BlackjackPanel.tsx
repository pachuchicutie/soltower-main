import { useRef, useState, type MutableRefObject } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronsUp, History, Play, ShieldCheck, Sparkles, Target } from "lucide-react";
import { uiAssetManifest, type BalanceType } from "@soltower/shared";
import { apiGet, apiPost, idempotencyKey } from "../../lib/api";
import { playUiSound } from "../../lib/audio";
import { AssetIcon, GameButton } from "../ui/GameUi";

interface Card {
  rank: string;
  suit: string;
}

interface Hand {
  id: string;
  balanceType: BalanceType;
  bet: number;
  totalWager: number;
  practiceMode: boolean;
  status: string;
  playerCards: Card[];
  dealerCards: Card[];
  resultMetadata: Record<string, unknown>;
  createdAt?: string;
}

interface BlackjackState {
  practiceAllowed: boolean;
  limits: { minBet: number; tableMaxBet: number; balanceMaxBet: number; actualMaxBet: number };
  profitCap: number;
  profitProgress: number;
  history: Hand[];
}

const balanceOptions: Array<{
  id: Extract<BalanceType, "EARNED_GOLD" | "LOCKED_GOLD">;
  label: string;
  icon: string;
}> = [
  { id: "EARNED_GOLD", label: "Earned Gold", icon: uiAssetManifest.currencies.earnedGold },
  { id: "LOCKED_GOLD", label: "Locked Gold", icon: uiAssetManifest.currencies.lockedGold }
];

export function BlackjackPanel() {
  const queryClient = useQueryClient();
  const [balanceType, setBalanceType] =
    useState<Extract<BalanceType, "EARNED_GOLD" | "LOCKED_GOLD">>("EARNED_GOLD");
  const [bet, setBet] = useState(5);
  const [activeHand, setActiveHand] = useState<Hand | null>(null);
  const lastResolvedSoundHandId = useRef<string | null>(null);
  const state = useQuery({
    queryKey: ["blackjack"],
    queryFn: () => apiGet<BlackjackState>("/api/blackjack"),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["blackjack"] });
    void queryClient.invalidateQueries({ queryKey: ["me"] });
  };
  const updateHand = (hand: Hand) => {
    setActiveHand(hand);
    queryClient.setQueryData<BlackjackState>(["blackjack"], (cached) => {
      if (!cached) return cached;
      return {
        ...cached,
        history: [hand, ...cached.history.filter((historyHand) => historyHand.id !== hand.id)]
      };
    });
    refresh();
  };
  const deal = useMutation({
    mutationFn: () =>
      apiPost<{ hand: Hand }>("/api/blackjack/deal", {
        balanceType,
        bet: state.data?.practiceAllowed ? 0 : bet,
        practice: Boolean(state.data?.practiceAllowed),
        idempotencyKey: idempotencyKey("deal")
      }),
    onSuccess: (data) => {
      playUiSound("blackjackDeal");
      playUiSound("blackjackCard", { throttleMs: 120 });
      playBlackjackHandSound(data.hand, lastResolvedSoundHandId);
      updateHand(data.hand);
    }
  });
  const act = useMutation({
    mutationFn: ({
      action,
      handId
    }: {
      action: "HIT" | "STAND" | "DOUBLE_DOWN";
      handId: string;
    }) =>
      apiPost<{ hand: Hand }>(`/api/blackjack/${handId}/action`, {
        action,
        idempotencyKey: idempotencyKey(action.toLowerCase())
      }),
    onSuccess: (data) => {
      playBlackjackHandSound(data.hand, lastResolvedSoundHandId);
      updateHand(data.hand);
    }
  });

  const current = activeHand ?? state.data?.history[0] ?? null;
  const limits = state.data?.limits;
  const practiceAllowed = Boolean(state.data?.practiceAllowed);
  const minBet = limits?.minBet ?? 5;
  const maxBet = limits?.actualMaxBet ?? 0;
  const active = current?.status === "ACTIVE";
  const validBet = practiceAllowed || (Number.isFinite(bet) && bet >= minBet && bet <= maxBet);

  return (
    <div className="blackjack-layout blackjack-panel-v2">
      <section className="compact-panel blackjack-bet-panel">
        <header className="blackjack-section-heading">
          <div>
            <span className="game-eyebrow">Table Setup</span>
            <h3>Lady Vesper's Table</h3>
          </div>
          <span className="blackjack-table-tier">
            {practiceAllowed ? "DEV Practice Table" : "Village Table"}
          </span>
        </header>

        {practiceAllowed ? (
          <div className="blackjack-practice-callout" role="status">
            <Sparkles size={21} />
            <div>
              <strong>Practice mode is active</strong>
              <span>Play complete hands for free. Wins and losses never change your Gold.</span>
            </div>
          </div>
        ) : (
          <>
            <div className="blackjack-balance-toggle" role="group" aria-label="Choose wager source">
              {balanceOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={balanceType === option.id}
                  className={balanceType === option.id ? "active" : ""}
                  onClick={() => setBalanceType(option.id)}
                >
                  <AssetIcon src={option.icon} />
                  <span>{option.label}</span>
                </button>
              ))}
            </div>

            <label className="blackjack-bet-field">
              <span>Wager</span>
              <div className="blackjack-bet-input">
                <AssetIcon src={uiAssetManifest.currencies.earnedGold} />
                <input
                  type="number"
                  min={minBet}
                  max={maxBet || undefined}
                  value={bet}
                  onChange={(event) => setBet(Number(event.target.value))}
                  aria-label="Blackjack wager"
                />
                <span>Gold</span>
              </div>
            </label>

            <div className="blackjack-limit-grid" aria-label="Table limits">
              <LimitStat label="Minimum" value={minBet} />
              <LimitStat label="Table limit" value={limits?.tableMaxBet ?? 25} />
              <LimitStat label="Available now" value={maxBet} unavailable={maxBet <= 0} />
            </div>

            <div className="blackjack-profit-meter">
              <div>
                <span>Earned Gold profit today</span>
                <strong>
                  {state.data?.profitProgress ?? 0} / {state.data?.profitCap ?? 0}
                </strong>
              </div>
              <div className="blackjack-meter-track" aria-hidden="true">
                <span style={{ width: `${profitPercent(state.data?.profitProgress, state.data?.profitCap)}%` }} />
              </div>
            </div>
          </>
        )}

        {practiceAllowed ? (
          <div className="blackjack-practice-facts" aria-label="Practice table rules">
            <div>
              <span>Entry cost</span>
              <strong>0 Gold</strong>
            </div>
            <div>
              <span>Rewards</span>
              <strong>0 Gold</strong>
            </div>
            <div>
              <span>Fairness</span>
              <strong>Server dealt</strong>
            </div>
          </div>
        ) : null}

        <div className={`blackjack-deal-actions${practiceAllowed ? " practice" : ""}`}>
          {!practiceAllowed ? (
            <GameButton
              variant="secondary"
              onClick={() => setBet(maxBet)}
              disabled={maxBet <= 0 || deal.isPending || active}
            >
              Max Bet
            </GameButton>
          ) : null}
          <GameButton
            variant="primary"
            onClick={() => {
              playUiSound("blackjackDeal", { throttleMs: 240 });
              deal.mutate();
            }}
            disabled={!validBet || deal.isPending || active}
          >
            <Play size={17} />
            {deal.isPending
              ? "Dealing..."
              : practiceAllowed
                ? "Deal Practice Hand"
                : "Deal Hand"}
          </GameButton>
        </div>

        {deal.isError ? (
          <p className="blackjack-error" role="alert">
            {practiceAllowed
              ? "The practice table could not deal that hand. Try again."
              : "The table could not accept that wager. Check your available Gold and try again."}
          </p>
        ) : null}

        <div className="blackjack-rules-note">
          <ShieldCheck size={18} />
          <p>
            {practiceAllowed
              ? "Practice hands are server dealt and recorded with zero wager and zero reward."
              : "Wagers and outcomes are settled by the game server. Test Token is never used at this table."}
          </p>
        </div>
      </section>

      <section
        className={`compact-panel blackjack-table${current && current.status !== "ACTIVE" ? ` blackjack-table-${current.status.toLowerCase()}` : ""}`}
      >
        <header className="blackjack-section-heading">
          <div>
            <span className="game-eyebrow">Live Table</span>
            <h3>Current Hand</h3>
          </div>
          {current ? <HandStatus status={current.status} /> : null}
        </header>

        {current ? (
          <>
            <div className="blackjack-board">
              <HandRow
                label="Dealer"
                cards={current.dealerCards}
                concealed={current.status === "ACTIVE"}
              />
              <div className="blackjack-versus" aria-hidden="true">
                <span>VS</span>
              </div>
              <HandRow label="Your Hand" cards={current.playerCards} />
            </div>

            <div className="blackjack-hand-summary">
              {current.practiceMode ? (
                <span className="blackjack-practice-chip">
                  <Sparkles size={15} />
                  Practice hand · 0 Gold
                </span>
              ) : (
                <span>
                  <AssetIcon src={balanceIcon(current.balanceType)} />
                  {current.totalWager} Gold wager
                </span>
              )}
              <span>
                <ShieldCheck size={15} />
                Fair shuffle secured
              </span>
            </div>

            {current.status === "ACTIVE" ? (
              <div className="blackjack-action-row">
                <GameButton
                  variant="primary"
                  onClick={() => {
                    playUiSound("blackjackHit");
                    act.mutate({ action: "HIT", handId: current.id });
                  }}
                  disabled={act.isPending}
                >
                  <Target size={17} />
                  Hit
                </GameButton>
                <GameButton
                  variant="secondary"
                  onClick={() => {
                    playUiSound("blackjackStand");
                    act.mutate({ action: "STAND", handId: current.id });
                  }}
                  disabled={act.isPending}
                >
                  <ShieldCheck size={17} />
                  Stand
                </GameButton>
                <GameButton
                  variant="secondary"
                  onClick={() => {
                    playUiSound("blackjackDoubleDown");
                    act.mutate({ action: "DOUBLE_DOWN", handId: current.id });
                  }}
                  disabled={act.isPending || current.playerCards.length !== 2}
                >
                  <ChevronsUp size={17} />
                  Double Down
                </GameButton>
              </div>
            ) : (
              <div className={`blackjack-result blackjack-result-${current.status.toLowerCase()}`} role="status">
                <Sparkles size={18} />
                <div>
                  <strong>{statusLabel(current.status)}</strong>
                  <span>{resultDescription(current)}</span>
                </div>
              </div>
            )}

            {act.isError ? (
              <p className="blackjack-error" role="alert">
                That move could not be completed. Your hand was not changed.
              </p>
            ) : null}
          </>
        ) : (
          <div className="blackjack-empty-hand">
            <div className="blackjack-card-back-preview">
              <Sparkles size={28} />
            </div>
            <strong>The table is ready.</strong>
            <p>Choose a Gold source and deal a hand to begin.</p>
          </div>
        )}
      </section>

      <section className="compact-panel full-span blackjack-history-panel">
        <header className="blackjack-section-heading">
          <div>
            <span className="game-eyebrow">Recent Play</span>
            <h3>Hand History</h3>
          </div>
          <History size={20} />
        </header>

        {state.data?.history.length ? (
          <div className="blackjack-history-list">
            {state.data.history.map((hand) => (
              <div className="blackjack-history-row" key={hand.id}>
                <span className={`blackjack-history-mark blackjack-history-${hand.status.toLowerCase()}`}>
                  {statusMark(hand.status)}
                </span>
                <div className="blackjack-history-copy">
                  <strong>{statusLabel(hand.status)}</strong>
                  <small>{resultDescription(hand)}</small>
                </div>
                <div className="blackjack-history-meta">
                  {hand.practiceMode ? (
                    <>
                      <span className="blackjack-practice-chip">
                        <Sparkles size={14} />
                        Practice
                      </span>
                      <strong>0 Gold · No reward</strong>
                    </>
                  ) : (
                    <>
                      <span>
                        <AssetIcon src={balanceIcon(hand.balanceType)} />
                        {balanceLabel(hand.balanceType)}
                      </span>
                      <strong>{hand.totalWager} Gold wager</strong>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="blackjack-history-empty">Completed hands will appear here.</p>
        )}
      </section>
    </div>
  );
}

function LimitStat({
  label,
  value,
  unavailable = false
}: {
  label: string;
  value: number;
  unavailable?: boolean;
}) {
  return (
    <div>
      <span>{label}</span>
      <strong>{unavailable ? "Unavailable" : `${value} Gold`}</strong>
    </div>
  );
}

function playBlackjackHandSound(hand: Hand, lastResolvedHandId: MutableRefObject<string | null>): void {
  if (hand.status === "ACTIVE") {
    playUiSound("blackjackCard", { throttleMs: 120 });
    return;
  }
  if (lastResolvedHandId.current === hand.id) {
    return;
  }
  lastResolvedHandId.current = hand.id;
  if (hand.status === "WON") {
    playUiSound("blackjackWin");
  } else if (hand.status === "LOST") {
    playUiSound("blackjackLose");
  } else if (hand.status === "PUSH") {
    playUiSound("blackjackPush");
  }
}

function HandRow({
  label,
  cards,
  concealed = false
}: {
  label: string;
  cards: Card[];
  concealed?: boolean;
}) {
  const total = handTotal(cards);
  return (
    <div className="blackjack-hand-row">
      <div className="blackjack-hand-label">
        <span>{label}</span>
        <strong>{concealed ? `Showing ${total}` : `${total}`}</strong>
      </div>
      <div className="blackjack-cards">
        {cards.map((card, index) => (
          <PlayingCard card={card} key={`${card.rank}-${card.suit}-${index}`} />
        ))}
        {concealed ? (
          <div className="playing-card playing-card-back" aria-label="Face-down card">
            <Sparkles size={24} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PlayingCard({ card }: { card: Card }) {
  const suit = suitDetails(card.suit);
  const rank = card.rank === "A" ? "A" : card.rank;
  return (
    <div
      className={`playing-card ${suit.red ? "playing-card-red" : "playing-card-black"}`}
      aria-label={`${rankName(card.rank)} of ${suit.name}`}
    >
      <span className="playing-card-corner">
        <strong>{rank}</strong>
        <i>{suit.symbol}</i>
      </span>
      <span className="playing-card-suit">{suit.symbol}</span>
      <span className="playing-card-corner playing-card-corner-bottom">
        <strong>{rank}</strong>
        <i>{suit.symbol}</i>
      </span>
    </div>
  );
}

function HandStatus({ status }: { status: string }) {
  return (
    <span className={`blackjack-status blackjack-status-${status.toLowerCase()}`}>
      {statusLabel(status)}
    </span>
  );
}

function handTotal(cards: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    if (card.rank === "A") {
      aces += 1;
      total += 11;
    } else if (["K", "Q", "J"].includes(card.rank)) {
      total += 10;
    } else {
      total += Number(card.rank) || 0;
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

function suitDetails(suit: string): { symbol: string; name: string; red: boolean } {
  const normalized = suit.toUpperCase();
  if (normalized === "H") return { symbol: "\u2665", name: "Hearts", red: true };
  if (normalized === "D") return { symbol: "\u2666", name: "Diamonds", red: true };
  if (normalized === "C") return { symbol: "\u2663", name: "Clubs", red: false };
  return { symbol: "\u2660", name: "Spades", red: false };
}

function rankName(rank: string): string {
  if (rank === "A") return "Ace";
  if (rank === "K") return "King";
  if (rank === "Q") return "Queen";
  if (rank === "J") return "Jack";
  return rank;
}

function statusLabel(status: string): string {
  if (status === "ACTIVE") return "Your turn";
  if (status === "WON") return "You won";
  if (status === "LOST") return "Dealer wins";
  if (status === "PUSH") return "Push";
  return "Hand complete";
}

function statusMark(status: string): string {
  if (status === "WON") return "+";
  if (status === "LOST") return "-";
  if (status === "PUSH") return "=";
  return "\u2022";
}

function resultDescription(hand: Hand): string {
  const result = String(hand.resultMetadata.result ?? "");
  if (hand.status === "ACTIVE") return "Hand in progress";
  if (result === "PLAYER_BUST") return "Your hand went over 21.";
  if (result === "DEALER_BUST") return "The dealer went over 21.";
  if (result === "PLAYER_HIGH") return "Your hand finished closer to 21.";
  if (result === "DEALER_HIGH") return "The dealer finished closer to 21.";
  if (hand.status === "PUSH") return "Your wager was returned.";
  return hand.status === "WON" ? "Winnings were credited." : "Hand settled.";
}

function balanceLabel(balanceType: BalanceType): string {
  return balanceType === "LOCKED_GOLD" ? "Locked Gold" : "Earned Gold";
}

function balanceIcon(balanceType: BalanceType): string {
  return balanceType === "LOCKED_GOLD"
    ? uiAssetManifest.currencies.lockedGold
    : uiAssetManifest.currencies.earnedGold;
}

function profitPercent(progress = 0, cap = 0): number {
  if (cap <= 0) return 0;
  return Math.min(100, Math.max(0, (progress / cap) * 100));
}
