import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  starlightBanners,
  starlightCostumeDuplicateThreads,
  starlightDrawCosts,
  starlightEquipmentDuplicateShards,
  starlightPaymentTypes,
  starlightPityRules,
  starlightPoolEntries,
  starlightRates,
  starlightRewardDefinitions,
  starlightVaultIconAssets,
  starlightVaultTabs,
  starlightVaultUtilityTabs,
  type PlayerBootstrapData,
  type StarlightBannerDefinition,
  type StarlightBannerId,
  type StarlightPaymentType,
  type StarlightRewardDefinition,
  type StarlightVaultTab,
  type StarlightVaultUtilityTab
} from "@soltower/shared";
import { apiGet, apiPost, idempotencyKey } from "../../lib/api";
import {
  AssetIcon,
  CurrencyChip,
  EmptyState,
  GameButton,
  GameCard,
  ModalTabs
} from "../ui/GameUi";

interface VaultState {
  pityCounters?: Array<Record<string, unknown>>;
  history?: Array<Record<string, unknown>>;
  ownedCostumes?: Array<Record<string, unknown>>;
  equippedCosmetics?: Array<Record<string, unknown>>;
}

interface DrawResult {
  results?: Array<Record<string, unknown>>;
}

const pullTabs = starlightVaultTabs.map((tab) => ({ id: tab, label: tab }));
const bannersByTab = new Map<StarlightVaultTab, StarlightBannerDefinition>(
  starlightBanners.map((banner) => [banner.tab, banner])
);
const rewardsById = new Map<string, StarlightRewardDefinition>(
  starlightRewardDefinitions.map((reward) => [reward.id, reward])
);

export function StarlightVaultPanel() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<StarlightVaultTab>("Featured");
  const [activeUtility, setActiveUtility] = useState<StarlightVaultUtilityTab | null>(null);
  const [selectedBannerId, setSelectedBannerId] = useState<StarlightBannerId>("featured-starlight-selection");
  const [paymentType, setPaymentType] = useState<StarlightPaymentType>("LOCKED_GOLD");
  const [drawCount, setDrawCount] = useState<1 | 10>(1);
  const [confirming, setConfirming] = useState(false);
  const [lastResult, setLastResult] = useState<DrawResult | null>(null);
  const me = useQuery({ queryKey: ["me"], queryFn: () => apiGet<PlayerBootstrapData>("/api/player/me") });
  const vault = useQuery({ queryKey: ["starlight-vault"], queryFn: () => apiGet<VaultState>("/api/starlight-vault") });
  const draw = useMutation({
    mutationFn: () =>
      apiPost<DrawResult>("/api/starlight-vault/draw", {
        bannerId: selectedBannerId,
        paymentBalanceType: paymentType,
        drawCount,
        activeHeroId: me.data?.selectedHeroId ?? "storm-archer",
        idempotencyKey: idempotencyKey("starlight-vault")
      }),
    onSuccess: async (result) => {
      setLastResult(result);
      setConfirming(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["me"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["starlight-vault"] })
      ]);
    }
  });

  const selectedBanner = starlightBanners.find((banner) => banner.id === selectedBannerId) ?? starlightBanners[0];
  const bannerEntries = useMemo(
    () => starlightPoolEntries.filter((entry) => entry.bannerId === selectedBannerId),
    [selectedBannerId]
  );
  const bannerRewards = useMemo(
    () => starlightRewardDefinitions.filter((reward) => reward.bannerIds.includes(selectedBannerId)),
    [selectedBannerId]
  );
  const selectedCost = drawCount === 10 ? starlightDrawCosts.ten.gold : starlightDrawCosts.one.gold;
  const selectedBalance = me.data?.player.balances[paymentType] ?? 0;
  const shortage = Math.max(0, selectedCost - selectedBalance);
  const canDraw = bannerEntries.length > 0 && shortage === 0 && !draw.isPending;
  const pity = (vault.data?.pityCounters ?? []).find((entry) => String(entry.banner_id ?? entry.bannerId) === selectedBannerId);
  const ownedCostumeIds = new Set((vault.data?.ownedCostumes ?? []).map((entry) => String(entry.costume_id ?? entry.costumeId)));

  function selectTab(tab: StarlightVaultTab) {
    const nextBanner = bannersByTab.get(tab) ?? starlightBanners[0];
    setActiveTab(tab);
    setSelectedBannerId(nextBanner.id);
    setActiveUtility(null);
    setConfirming(false);
  }

  const featuredRewards = selectedBanner.featuredRewardIds
    .map((rewardId) => rewardsById.get(rewardId))
    .filter((reward): reward is StarlightRewardDefinition => Boolean(reward));

  return (
    <div className="starlight-vault-panel">
      <GameCard className="starlight-vault-summary">
        <div>
          <span className="game-eyebrow">STAR DRAWS</span>
          <h3>Starlight Vault</h3>
          <p>Draw powerful gear and full costumes for your Guardians.</p>
        </div>
        <div className="starlight-balance-row">
          <CurrencyChip iconSrc={starlightVaultIconAssets.earnedGold} label="Earned Gold" value={me.data?.player.balances.EARNED_GOLD ?? 0} tone="gold" />
          <CurrencyChip iconSrc={starlightVaultIconAssets.lockedGold} label="Locked Gold" value={me.data?.player.balances.LOCKED_GOLD ?? 0} tone="blue" />
        </div>
      </GameCard>

      <ModalTabs tabs={pullTabs} activeTab={activeTab} onChange={selectTab} label="Starlight Vault pull categories" />

      <div className="starlight-utility-row" aria-label="Starlight Vault utility panels">
        {starlightVaultUtilityTabs.map((utility) => (
          <GameButton
            key={utility}
            variant={activeUtility === utility ? "primary" : "secondary"}
            className="starlight-utility-button"
            onClick={() => {
              setActiveUtility(activeUtility === utility ? null : utility);
              setConfirming(false);
            }}
          >
            {utility}
          </GameButton>
        ))}
      </div>

      {activeUtility === "Collection" ? (
        <CollectionPanel ownedCostumeIds={ownedCostumeIds} />
      ) : activeUtility === "Pull History" ? (
        <PullHistoryPanel history={vault.data?.history ?? []} />
      ) : activeUtility === "Vault Odds" ? (
        <OddsPanel pity={pity} />
      ) : (
        <>
          <section className="starlight-banner-showcase" aria-label={`${selectedBanner.name} banner`}>
            <img src={selectedBanner.imagePath} alt="" aria-hidden="true" className="starlight-banner-art" />
            <div className="starlight-banner-copy">
              <span className="game-eyebrow">{selectedBanner.tab}</span>
              <h3>{selectedBanner.headline}</h3>
              <p>{selectedBanner.subhead}</p>
              <div className="starlight-banner-badges">
                <span><AssetIcon src={starlightVaultIconAssets.featured} /> {bannerRewards.length} rewards</span>
                <span><AssetIcon src={starlightVaultIconAssets.rateUp} /> Rate-up preview</span>
                <span><AssetIcon src={starlightVaultIconAssets.pity} /> Pity protected</span>
              </div>
            </div>
          </section>

          <section className="starlight-featured-layout" aria-label="Featured rewards and draw controls">
            <GameCard className="starlight-spotlight-card">
              <span className="game-eyebrow">Spotlight</span>
              {featuredRewards[0] ? <RewardSpotlight reward={featuredRewards[0]} /> : null}
            </GameCard>
            <DrawControls
              selectedBanner={selectedBanner}
              selectedHeroName={me.data?.profile.selectedHero ?? me.data?.selectedHeroId ?? "Active Hero"}
              paymentType={paymentType}
              onPaymentType={setPaymentType}
              drawCount={drawCount}
              onDrawCount={setDrawCount}
              selectedCost={selectedCost}
              selectedBalance={selectedBalance}
              shortage={shortage}
              canDraw={canDraw}
              confirming={confirming}
              isPending={draw.isPending}
              error={draw.error}
              onConfirming={setConfirming}
              onDraw={() => draw.mutate()}
            />
          </section>

          <section className="starlight-reward-section" aria-label={`${selectedBanner.tab} reward pool`}>
            <div className="section-title-row">
              <strong>{selectedBanner.tab} Reward Pool</strong>
              <span>{bannerRewards.length} local reward assets</span>
            </div>
            <div className="starlight-reward-grid">
              {bannerRewards.map((reward) => (
                <RewardCard key={`${selectedBanner.id}-${reward.id}`} reward={reward} owned={ownedCostumeIds.has(reward.id)} />
              ))}
            </div>
          </section>

          <OddsPanel pity={pity} compact />
        </>
      )}

      {lastResult ? <DrawResultPanel result={lastResult} /> : null}
    </div>
  );
}

function RewardSpotlight({ reward }: { reward: StarlightRewardDefinition }) {
  const preview = getRewardPreview(reward);

  return (
    <div className={`starlight-spotlight starlight-rarity-${reward.rarity.toLowerCase()}`}>
      <div className="starlight-spotlight-art">
        <AssetIcon src={reward.assetPath} alt={reward.name} decorative={false} />
        <AssetIcon src={reward.framePath} className="starlight-reward-frame" />
      </div>
      <div>
        <span>{reward.rarity} {reward.displayType}</span>
        <strong>{reward.name}</strong>
        <p>{reward.flavor}</p>
        <RewardPreview preview={preview} />
        <div className="starlight-mini-tags">
          {reward.rateUp ? <small>Rate Up</small> : null}
          {reward.limited ? <small>Limited</small> : null}
          {reward.heroExclusive ? <small>Active Hero</small> : <small>Global</small>}
        </div>
      </div>
    </div>
  );
}

function RewardCard({ reward, owned = false }: { reward: StarlightRewardDefinition; owned?: boolean }) {
  const preview = getRewardPreview(reward);
  const detailsId = `starlight-reward-details-${reward.id}`;

  return (
    <GameCard
      className={`starlight-reward-card starlight-rarity-${reward.rarity.toLowerCase()}`}
      tabIndex={0}
      aria-label={`${reward.name}, ${reward.rarity} ${reward.displayType}`}
      aria-describedby={detailsId}
    >
      <div className="starlight-reward-visual">
        <AssetIcon src={reward.assetPath} alt={reward.name} decorative={false} />
        <AssetIcon src={reward.framePath} className="starlight-reward-frame" />
      </div>
      <div className="starlight-reward-copy">
        <span className="game-eyebrow">{reward.rarity}</span>
        <strong>{reward.name}</strong>
        <small>{reward.displayType} · Bound · {owned ? "Owned" : "Unowned"}</small>
        <p>{reward.flavor}</p>
        <div className="starlight-mini-tags">
          {reward.rateUp ? <small>Rate Up</small> : null}
          {reward.limited ? <small>Limited</small> : null}
          {reward.heroExclusive ? <small>Active Hero</small> : <small>Global</small>}
        </div>
      </div>
      <div id={detailsId} className="starlight-reward-hover">
        <RewardPreview preview={preview} compact />
      </div>
    </GameCard>
  );
}

interface RewardPreviewData {
  advantage: string;
  stats: Array<{ label: string; value: string }>;
}

const rewardPowerLabels = ["Starter", "Reliable", "Potent", "Elite", "Exceptional", "Mythic"] as const;

function getRewardPreview(reward: StarlightRewardDefinition): RewardPreviewData {
  const rarityIndex = starlightRates.findIndex((rate) => rate.rarity === reward.rarity);
  const powerLabel = rewardPowerLabels[Math.max(0, rarityIndex)] ?? rewardPowerLabels[0];
  const dropRate = starlightRates.find((rate) => rate.rarity === reward.rarity)?.percent ?? 0;
  const duplicateValue = reward.rewardType === "FULL_COSTUME"
    ? `${starlightCostumeDuplicateThreads[reward.rarity]} Threads`
    : `${starlightEquipmentDuplicateShards[reward.rarity]} Shards`;

  if (reward.rewardType === "FULL_COSTUME") {
    return {
      advantage: `${powerLabel} full-character style with a complete visual theme for every direction.`,
      stats: [
        { label: "Coverage", value: "Full Outfit" },
        { label: "Prestige", value: powerLabel },
        { label: "Drop chance", value: `${dropRate.toFixed(2)}%` },
        { label: "Duplicate", value: duplicateValue }
      ]
    };
  }

  if (reward.rewardType === "WEAPON") {
    const specialty = reward.itemTags.includes("bow")
      ? "Boss Range"
      : reward.itemTags.includes("launcher")
        ? "Area Burst"
        : reward.itemTags.includes("water-catalyst")
          ? "Wave Control"
          : "Skill Power";
    return {
      advantage: `${powerLabel} offensive profile built for ${specialty.toLowerCase()} play.`,
      stats: [
        { label: "Damage", value: powerLabel },
        { label: "Specialty", value: specialty },
        { label: "Drop chance", value: `${dropRate.toFixed(2)}%` },
        { label: "Duplicate", value: duplicateValue }
      ]
    };
  }

  if (reward.rewardType === "ARMOR") {
    const specialty = reward.itemTags.includes("light-armor")
      ? "Mobility"
      : reward.itemTags.includes("tide-mage-armor")
        ? "Magic Guard"
        : reward.itemTags.includes("bombardier-armor")
          ? "Blast Guard"
          : "Ward Defense";
    return {
      advantage: `${powerLabel} defensive profile that strengthens ${specialty.toLowerCase()}.`,
      stats: [
        { label: "Defense", value: powerLabel },
        { label: "Best for", value: specialty },
        { label: "Drop chance", value: `${dropRate.toFixed(2)}%` },
        { label: "Duplicate", value: duplicateValue }
      ]
    };
  }

  const specialty = reward.itemTags.includes("water-catalyst")
    ? "Tide Control"
    : reward.itemTags.includes("star-focus")
      ? "Skill Timing"
      : reward.rewardType === "CHARM"
        ? "Precision"
        : "Ward Utility";

  return {
    advantage: `${powerLabel} utility profile tuned for ${specialty.toLowerCase()}.`,
    stats: [
      { label: reward.rewardType === "CHARM" ? "Focus" : "Utility", value: powerLabel },
      { label: "Specialty", value: specialty },
      { label: "Drop chance", value: `${dropRate.toFixed(2)}%` },
      { label: "Duplicate", value: duplicateValue }
    ]
  };
}

function RewardPreview({ preview, compact = false }: { preview: RewardPreviewData; compact?: boolean }) {
  return (
    <div className={`starlight-reward-preview ${compact ? "compact" : ""}`}>
      <strong className="starlight-advantage-copy">{preview.advantage}</strong>
      <div className="starlight-preview-stat-grid">
        {preview.stats.map((stat) => (
          <span key={stat.label}>
            <small>{stat.label}</small>
            <strong>{stat.value}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

function DrawControls({
  selectedBanner,
  selectedHeroName,
  paymentType,
  onPaymentType,
  drawCount,
  onDrawCount,
  selectedCost,
  selectedBalance,
  shortage,
  canDraw,
  confirming,
  isPending,
  error,
  onConfirming,
  onDraw
}: {
  selectedBanner: StarlightBannerDefinition;
  selectedHeroName: string;
  paymentType: StarlightPaymentType;
  onPaymentType: (paymentType: StarlightPaymentType) => void;
  drawCount: 1 | 10;
  onDrawCount: (drawCount: 1 | 10) => void;
  selectedCost: number;
  selectedBalance: number;
  shortage: number;
  canDraw: boolean;
  confirming: boolean;
  isPending: boolean;
  error: Error | null;
  onConfirming: (confirming: boolean) => void;
  onDraw: () => void;
}) {
  return (
    <GameCard className="starlight-draw-card">
      <span className="game-eyebrow">Star Draw</span>
      <strong>{selectedBanner.name}</strong>
      <small>{selectedBanner.requiresActiveHero ? `Active Hero: ${selectedHeroName}` : "Global guardian collection"}</small>
      <div className="segmented-control" aria-label="Payment choice">
        {starlightPaymentTypes.map((type) => (
          <button key={type} type="button" className={paymentType === type ? "active" : ""} onClick={() => onPaymentType(type)}>
            Spend {type === "LOCKED_GOLD" ? "Locked Gold" : "Earned Gold"}
          </button>
        ))}
      </div>
      <div className="segmented-control" aria-label="Draw count">
        <button type="button" className={drawCount === 1 ? "active" : ""} onClick={() => onDrawCount(1)}>1 Pull · 50 Gold</button>
        <button type="button" className={drawCount === 10 ? "active" : ""} onClick={() => onDrawCount(10)}>10 Pulls · 450 Gold</button>
      </div>
      <div className="starlight-cost-line">
        <span>Selected balance</span>
        <strong>{selectedBalance} Gold</strong>
        <span>Cost</span>
        <strong>{selectedCost} Gold</strong>
      </div>
      {shortage > 0 ? <span className="starlight-warning">Need {shortage} more {paymentType === "LOCKED_GOLD" ? "Locked" : "Earned"} Gold.</span> : null}
      {error ? <span className="starlight-warning">Draw failed. Please try again after the Vault syncs.</span> : null}
      {confirming ? (
        <GameCard className="starlight-confirm-card">
          <strong>Draw from {selectedBanner.name}?</strong>
          <p>{drawCount} pull{drawCount === 1 ? "" : "s"} will spend {selectedCost} {paymentType === "LOCKED_GOLD" ? "Locked Gold" : "Earned Gold"}.</p>
          <p>Vault rewards are bound to your account.</p>
          <div className="button-row">
            <GameButton variant="ghost" onClick={() => onConfirming(false)}>Cancel</GameButton>
            <GameButton disabled={!canDraw} onClick={onDraw}>{isPending ? "Drawing..." : "Confirm Star Draw"}</GameButton>
          </div>
        </GameCard>
      ) : (
        <GameButton disabled={!canDraw} onClick={() => onConfirming(true)}>
          {isPending ? "Drawing..." : `Pull ${drawCount}`}
        </GameButton>
      )}
    </GameCard>
  );
}

function CollectionPanel({ ownedCostumeIds }: { ownedCostumeIds: Set<string> }) {
  return (
    <section className="starlight-reward-section" aria-label="Starlight Vault collection">
      <div className="section-title-row">
        <strong>Collection</strong>
        <span>{ownedCostumeIds.size} costumes owned</span>
      </div>
      <div className="starlight-reward-grid">
        {starlightRewardDefinitions.map((reward) => (
          <RewardCard key={`collection-${reward.id}`} reward={reward} owned={ownedCostumeIds.has(reward.id)} />
        ))}
      </div>
    </section>
  );
}

function PullHistoryPanel({ history }: { history: Array<Record<string, unknown>> }) {
  return (
    <section className="starlight-history-panel" aria-label="Starlight Vault Pull History">
      {history.length ? (
        <div className="inventory-item-list">
          {history.map((event, index) => (
            <div key={String(event.id ?? index)} className="inventory-item-row">
              <span>
                <strong>{String(event.banner_id ?? event.bannerId ?? "Starlight Banner")}</strong>
                <small>{String(event.draw_count ?? event.drawCount ?? 1)} pull(s) · {String(event.payment_balance_type ?? event.paymentBalanceType ?? "Gold")}</small>
              </span>
              {event.created_at || event.createdAt ? <time>{String(event.created_at ?? event.createdAt)}</time> : null}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState iconSrc={starlightVaultIconAssets.pity} title="No Star Draws yet.">
          Your pull history will appear here after the server confirms a draw.
        </EmptyState>
      )}
    </section>
  );
}

function OddsPanel({ pity, compact = false }: { pity?: Record<string, unknown>; compact?: boolean }) {
  const rare = Number(pity?.rare_counter ?? pity?.rareCounter ?? 0);
  const epic = Number(pity?.epic_counter ?? pity?.epicCounter ?? 0);
  const legendary = Number(pity?.legendary_counter ?? pity?.legendaryCounter ?? 0);
  const mythical = Number(pity?.mythical_counter ?? pity?.mythicalCounter ?? 0);
  return (
    <section className={`starlight-odds ${compact ? "compact" : ""}`} aria-label="Vault Odds">
      <GameCard>
        <strong>Vault Odds</strong>
        <div className="starlight-odds-list">
          {starlightRates.map((rate) => (
            <span key={rate.rarity} className="stat-row">
              <span>{rate.label}</span>
              <strong>{rate.percent.toFixed(2)}%</strong>
            </span>
          ))}
        </div>
      </GameCard>
      <GameCard className="starlight-pity-card">
        <strong>Pity Progress</strong>
        <PityMeter label={starlightPityRules.rare.label} value={rare} max={starlightPityRules.rare.threshold} />
        <PityMeter label={starlightPityRules.epic.label} value={epic} max={starlightPityRules.epic.threshold} />
        <PityMeter label={starlightPityRules.legendary.label} value={legendary} max={starlightPityRules.legendary.threshold} />
        <PityMeter label={starlightPityRules.mythical.label} value={mythical} max={starlightPityRules.mythical.threshold} />
      </GameCard>
    </section>
  );
}

function PityMeter({ label, value, max }: { label: string; value: number; max: number }) {
  const progress = `${Math.min(100, Math.round((value / max) * 100))}%`;
  return (
    <div className="starlight-pity-meter">
      <span><span>{label}</span><strong>{value} / {max}</strong></span>
      <div><i style={{ width: progress }} /></div>
    </div>
  );
}

function DrawResultPanel({ result }: { result: DrawResult }) {
  const rewards = (result.results ?? [])
    .map((entry) => rewardsById.get(String(entry.rewardId ?? entry.reward_id)))
    .filter((reward): reward is StarlightRewardDefinition => Boolean(reward));

  return (
    <GameCard className="starlight-result-card">
      <span className="game-eyebrow">Reveal Complete</span>
      <strong>Star Draw Results</strong>
      {rewards.length ? (
        <div className="starlight-result-grid">
          {rewards.map((reward, index) => (
            <RewardCard key={`result-${reward.id}-${index}`} reward={reward} owned />
          ))}
        </div>
      ) : (
        <p>The server confirmed the draw. Collection details will refresh from your account state.</p>
      )}
    </GameCard>
  );
}
