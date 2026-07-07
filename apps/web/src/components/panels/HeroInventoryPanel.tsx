import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { heroDefinitions } from "@soltower/game-engine";
import {
  equipmentSlots,
  itemAssetPath,
  rarityColors,
  uiAssetManifest,
  type EquipmentSlot,
  type ItemRarity,
  type PublicPlayer
} from "@soltower/shared";
import { apiGet, apiPost, idempotencyKey } from "../../lib/api";
import { useHeroAppearance } from "../../lib/heroAppearance";
import {
  EmptyState,
  GameButton,
  GameCard,
  ItemCard,
  ModalTabs,
  StatRow
} from "../ui/GameUi";
import { HeroAppearancePreview } from "../ui/HeroAppearancePreview";

type HeroTab = "overview" | "equipment" | "stats" | "compare";

interface InventoryResponse {
  equipment: EquipmentItem[];
}

interface EquipmentItem {
    id: string;
    definitionId: string;
    name: string;
    rarity: keyof typeof rarityColors;
    slot: EquipmentSlot;
    equippedSlot: EquipmentSlot | null;
    level: number;
    bound: boolean;
    relistable: boolean;
    stats: Record<string, number>;
}

interface EquipmentSwapResult {
  slot: EquipmentSlot;
  equippedItem: EquipmentItem;
  returnedItem: EquipmentItem;
  power: number;
}

interface MeResponse {
  player: PublicPlayer;
  selectedHeroId: string;
}

const tabs: Array<{ id: HeroTab; label: string; iconSrc: string }> = [
  { id: "overview", label: "Overview", iconSrc: uiAssetManifest.icons.heroLoadout },
  { id: "equipment", label: "Equipment", iconSrc: uiAssetManifest.icons.inventory },
  { id: "stats", label: "Stats", iconSrc: uiAssetManifest.icons.achievement },
  { id: "compare", label: "Compare", iconSrc: uiAssetManifest.icons.history }
];

export function HeroInventoryPanel() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<HeroTab>("overview");
  const [changingSlot, setChangingSlot] = useState<EquipmentSlot | null>(null);
  const [pendingReplacement, setPendingReplacement] = useState<EquipmentItem | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const me = useQuery({ queryKey: ["me"], queryFn: () => apiGet<MeResponse>("/api/player/me") });
  const inventory = useQuery({
    queryKey: ["inventory"],
    queryFn: () => apiGet<InventoryResponse>("/api/inventory")
  });
  const swap = useMutation({
    mutationFn: (input: { equipmentId: string; slot: EquipmentSlot }) =>
      apiPost<EquipmentSwapResult>("/api/inventory/swap", {
        equipmentId: input.equipmentId,
        slot: input.slot,
        idempotencyKey: idempotencyKey("equipment-swap")
      }),
    onSuccess: async (result) => {
      setSuccessMessage(`${result.equippedItem.name} equipped. ${result.returnedItem.name} returned to Inventory.`);
      setChangingSlot(null);
      setPendingReplacement(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["me"] })
      ]);
    }
  });

  const selectedHero = heroDefinitions.find((hero) => hero.id === me.data?.selectedHeroId) ?? heroDefinitions[0];
  const [appearance] = useHeroAppearance(selectedHero.id);
  const equipment = inventory.data?.equipment ?? [];
  const equippedBySlot = useMemo(() => {
    const map = new Map<EquipmentSlot, EquipmentItem>();
    for (const item of equipment) {
      if (item.equippedSlot) {
        map.set(item.equippedSlot, item);
      }
    }
    return map;
  }, [equipment]);
  const equipmentTotals = totalStats(selectedHero.stats, Array.from(equippedBySlot.values()));
  const currentSlotItem = changingSlot ? equippedBySlot.get(changingSlot) ?? null : null;
  const replacementItems = changingSlot
    ? equipment.filter((item) => item.slot === changingSlot && !item.equippedSlot && item.id !== currentSlotItem?.id)
    : [];

  return (
    <div className="hero-loadout-panel">
      <ModalTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} label="Hero loadout tabs" />

      {activeTab === "overview" ? (
        <section className="hero-overview" aria-label="Hero overview">
          <GameCard className="hero-summary-card">
            <HeroAppearancePreview
              heroId={selectedHero.id}
              appearance={appearance}
              size="portrait"
              className="hero-card-preview"
              label={selectedHero.name}
            />
            <div>
              <span className="game-eyebrow">Active Hero</span>
              <h3>{selectedHero.name}</h3>
              <p>{selectedHero.role}</p>
              <span className="tag">{selectedHero.ultimate}</span>
            </div>
          </GameCard>
          <GameCard>
            <strong>Class Summary</strong>
            <p>{selectedHero.tags.map((tag) => titleCase(tag)).join(" · ")}</p>
            <div className="stats-grid">
              <StatRow label="Power" value={equipmentTotals.power} />
              <StatRow label="Damage" value={equipmentTotals.damage} />
              <StatRow label="Attack Speed" value={equipmentTotals.attackSpeed} />
              <StatRow label="Range" value={equipmentTotals.range} />
            </div>
          </GameCard>
        </section>
      ) : null}

      {activeTab === "equipment" ? (
        <section className="hero-equipment-view" aria-label="Hero equipment">
          <div className="equipment-slot-grid">
            {equipmentSlots.map((slot) => {
              const item = equippedBySlot.get(slot);
              return (
                <GameCard
                  key={slot}
                  className="equipment-slot-card"
                  style={{ borderColor: item ? rarityColors[item.rarity] : undefined }}
                >
                  <span>{formatSlot(slot)}</span>
                  {item ? (
                    <>
                      <ItemCard
                        iconSrc={itemAssetPath(item.definitionId)}
                        frameSrc={rarityFrame(item.rarity)}
                        title={item.name}
                        meta={`${item.rarity} · ${item.bound ? "Bound" : "Tradeable"} · Level ${item.level}`}
                      >
                        <ItemStats stats={item.stats} />
                        <span className="tag">Equipped</span>
                      </ItemCard>
                      <GameButton
                        variant="secondary"
                        onClick={() => {
                          setChangingSlot(slot);
                          setPendingReplacement(null);
                        }}
                      >
                        Change
                      </GameButton>
                    </>
                  ) : (
                    <EmptyState title={`${formatSlot(slot)} required`} iconSrc={uiAssetManifest.icons.inventory}>
                      Core equipment slots cannot be empty.
                    </EmptyState>
                  )}
                </GameCard>
              );
            })}
          </div>
          {successMessage ? <span className="equipment-success tag">{successMessage}</span> : null}
          {changingSlot ? (
            <GameCard className="equipment-detail-panel">
              <div className="section-title-row">
                <strong>Choose {formatSlot(changingSlot)} Replacement</strong>
                <GameButton
                  variant="ghost"
                  onClick={() => {
                    setChangingSlot(null);
                    setPendingReplacement(null);
                  }}
                >
                  Cancel
                </GameButton>
              </div>
              {pendingReplacement && currentSlotItem ? (
                <div className="equipment-confirm-card">
                  <strong>Equip {pendingReplacement.name}?</strong>
                  <p>Your {currentSlotItem.name} will return to your Inventory.</p>
                  <div className="button-row">
                    <GameButton variant="ghost" onClick={() => setPendingReplacement(null)}>
                      Cancel
                    </GameButton>
                    <GameButton
                      onClick={() => swap.mutate({ equipmentId: pendingReplacement.id, slot: changingSlot })}
                      disabled={swap.isPending}
                    >
                      Confirm Swap
                    </GameButton>
                  </div>
                </div>
              ) : null}
              {replacementItems.length ? (
                <div className="equipment-picker-grid">
                  {replacementItems.map((item) => (
                    <GameCard key={item.id} className="equipment-replacement-card" style={{ borderColor: rarityColors[item.rarity] }}>
                      <ItemCard
                        iconSrc={itemAssetPath(item.definitionId)}
                        frameSrc={rarityFrame(item.rarity)}
                        title={item.name}
                        meta={`${item.rarity} · Level ${item.level} · ${item.bound ? "Bound" : "Tradeable"}`}
                      >
                        <ItemStats stats={item.stats} compareTo={currentSlotItem?.stats} />
                      </ItemCard>
                      <GameButton onClick={() => setPendingReplacement(item)} disabled={swap.isPending}>
                        Equip {item.name}
                      </GameButton>
                      {currentSlotItem ? <small>Replaces {currentSlotItem.name}</small> : null}
                    </GameCard>
                  ))}
                </div>
              ) : (
                <EmptyState title="No replacement equipment yet." iconSrc={uiAssetManifest.icons.heroLoadout}>
                  Clear more stages, craft gear, or visit the Market Board.
                </EmptyState>
              )}
            </GameCard>
          ) : null}
        </section>
      ) : null}

      {activeTab === "stats" ? (
        <section className="hero-stat-groups" aria-label="Hero stats">
          <StatGroup
            title="Core"
            rows={[
              ["Power", equipmentTotals.power],
              ["Damage", equipmentTotals.damage],
              ["Attack Speed", equipmentTotals.attackSpeed],
              ["Range", equipmentTotals.range]
            ]}
          />
          <StatGroup
            title="Critical"
            rows={[
              ["Crit Chance", `${equipmentTotals.critChance}%`],
              ["Crit Damage", `${equipmentTotals.critDamage}%`]
            ]}
          />
          <StatGroup
            title="Specialty"
            rows={[
              ["Boss Damage", `${equipmentTotals.bossDamage}%`],
              ["Luck", equipmentTotals.luck]
            ]}
          />
        </section>
      ) : null}

      {activeTab === "compare" ? (
        <section className="hero-compare-panel" aria-label="Hero compare">
          <EmptyState title="Compare Coming Soon" iconSrc={uiAssetManifest.icons.history}>
            Side-by-side hero and gear comparison will unlock after the next combat tuning pass.
          </EmptyState>
        </section>
      ) : null}
    </div>
  );
}

function StatGroup({ title, rows }: { title: string; rows: Array<[string, string | number]> }) {
  return (
    <GameCard>
      <strong>{title}</strong>
      <div className="stats-grid">
        {rows.map(([label, value]) => (
          <StatRow key={label} label={label} value={value} />
        ))}
      </div>
    </GameCard>
  );
}

function ItemStats({ stats, compareTo }: { stats: Record<string, number>; compareTo?: Record<string, number> | null }) {
  return (
    <div className="item-stat-list">
      {Object.entries(stats).map(([stat, value]) => {
        const delta = compareTo ? value - (compareTo[stat] ?? 0) : null;
        return (
          <span key={stat}>
            {formatStat(stat)} <strong>+{value}</strong>
            {delta ? <em className={delta > 0 ? "stat-positive" : "stat-negative"}>{delta > 0 ? `+${delta}` : delta}</em> : null}
          </span>
        );
      })}
      {compareTo
        ? Object.entries(compareTo)
            .filter(([stat]) => !(stat in stats))
            .map(([stat, value]) => (
              <span key={stat}>
                {formatStat(stat)} <strong>+0</strong>
                <em className="stat-negative">-{value}</em>
              </span>
            ))
        : null}
    </div>
  );
}

function rarityFrame(rarity: ItemRarity): string {
  return (
    uiAssetManifest.rarityFrames[rarity as keyof typeof uiAssetManifest.rarityFrames] ??
    uiAssetManifest.rarityFrames.LEGENDARY
  );
}

function formatSlot(slot: EquipmentSlot): string {
  return slot.slice(0, 1) + slot.slice(1).toLowerCase();
}

function formatStat(stat: string): string {
  return stat.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function titleCase(value: string): string {
  return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function totalStats(base: Record<string, number>, equipment: EquipmentItem[]): Record<string, number> {
  const totals = { ...base };
  for (const item of equipment) {
    for (const [stat, value] of Object.entries(item.stats)) {
      totals[stat] = (totals[stat] ?? 0) + value;
    }
  }
  return totals;
}
