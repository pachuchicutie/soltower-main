import { useMemo, useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Palette } from "lucide-react";
import { heroDefinitions } from "@soltower/game-engine";
import {
  consumables as consumableDefinitions,
  equipmentSlots,
  fullCostumeDefinitions,
  heroCustomizationOptions,
  itemAssetPath,
  materialDefinitions,
  rarityColors,
  starlightMaterialDefinitions,
  uiAssetManifest,
  type HeroAppearance,
  type EquipmentSlot,
  type ItemRarity,
  type PublicPlayer
} from "@soltower/shared";
import { apiGet, apiPost, idempotencyKey } from "../../lib/api";
import { useHeroAppearance } from "../../lib/heroAppearance";
import {
  AssetIcon,
  EmptyState,
  GameButton,
  GameCard,
  ItemCard,
  ModalTabs,
  StatRow
} from "../ui/GameUi";
import { HeroAppearancePreview } from "../ui/HeroAppearancePreview";

type InventoryTab = "equipment" | "consumables" | "materials" | "cosmetics";

interface InventoryResponse {
  equipment: EquipmentItem[];
  consumables: Array<{
    id: string;
    definitionId: string;
    name: string;
    description: string;
    quantity: number;
    bound: boolean;
  }>;
  materials: Array<{ id: string; name: string; quantity: number; bound: boolean }>;
  cosmetics?: Array<{
    id: string;
    costumeId: string;
    name: string;
    rarity: keyof typeof rarityColors;
    bound: boolean;
    tradeable: boolean;
    source: string;
  }>;
  equippedCosmetics?: Array<{ heroId?: string; hero_id?: string; costumeId?: string | null; costume_id?: string | null }>;
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

const tabs: Array<{ id: InventoryTab; label: string; iconSrc: string }> = [
  { id: "equipment", label: "Equipment", iconSrc: uiAssetManifest.icons.heroLoadout },
  { id: "consumables", label: "Consumables", iconSrc: uiAssetManifest.items["mana-tonic"] },
  { id: "materials", label: "Materials", iconSrc: uiAssetManifest.items["tower-shard"] },
  { id: "cosmetics", label: "Cosmetics", iconSrc: uiAssetManifest.icons.settings }
];
const starlightMaterialIds = new Set<string>(starlightMaterialDefinitions.map((material) => material.id));

export function InventoryPanel() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<InventoryTab>("equipment");
  const [changingSlot, setChangingSlot] = useState<EquipmentSlot | null>(null);
  const [pendingReplacement, setPendingReplacement] = useState<EquipmentItem | null>(null);
  const [showEquippedItems, setShowEquippedItems] = useState(false);
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
  const equipCostume = useMutation({
    mutationFn: (input: { heroId: string; costumeId: string | null }) =>
      apiPost<{ heroId: string; costumeId: string | null }>("/api/inventory/full-costume", input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["me"] })
      ]);
    }
  });

  const selectedHero =
    heroDefinitions.find((hero) => hero.id === me.data?.selectedHeroId) ?? heroDefinitions[0];
  const [appearance, updateAppearance] = useHeroAppearance(selectedHero.id);
  const equippedBySlot = useMemo(() => {
    const map = new Map<EquipmentSlot, EquipmentItem>();
    for (const item of inventory.data?.equipment ?? []) {
      if (item.equippedSlot) {
        map.set(item.equippedSlot, item);
      }
    }
    return map;
  }, [inventory.data?.equipment]);
  const allEquipment = inventory.data?.equipment ?? [];
  const ownedEquipment = showEquippedItems ? allEquipment : allEquipment.filter((item) => !item.equippedSlot);
  const equipmentTotals = totalStats(selectedHero.stats, Array.from(equippedBySlot.values()));
  const currentSlotItem = changingSlot ? equippedBySlot.get(changingSlot) ?? null : null;
  const replacementItems = changingSlot
    ? allEquipment.filter((item) => item.slot === changingSlot && item.id !== currentSlotItem?.id && (!item.equippedSlot || showEquippedItems))
    : [];
  const ownedCostumes = inventory.data?.cosmetics ?? [];
  const equippedFullCostumeId = inventory.data?.equippedCosmetics?.find((entry) =>
    (entry.heroId ?? entry.hero_id) === selectedHero.id
  )?.costumeId ?? inventory.data?.equippedCosmetics?.find((entry) =>
    (entry.heroId ?? entry.hero_id) === selectedHero.id
  )?.costume_id ?? null;
  const equippedFullCostume = ownedCostumes.find((costume) => costume.costumeId === equippedFullCostumeId);

  return (
    <div className="inventory-panel">
      <ModalTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} label="Inventory tabs" />

      {activeTab === "equipment" ? (
        <section className="inventory-equipment-view" aria-label="Equipment inventory">
          <GameCard className="active-hero-card">
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
            </div>
            <div className="stats-grid">
              {["power", "damage", "attackSpeed", "range"].map((stat) => (
                <StatRow
                  key={stat}
                  label={formatStat(stat)}
                  value={equipmentTotals[stat] ?? selectedHero.stats[stat as keyof typeof selectedHero.stats]}
                />
              ))}
            </div>
          </GameCard>
          {successMessage ? <span className="equipment-success tag">{successMessage}</span> : null}

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
                        meta={`${formatSlot(item.slot)} · ${item.rarity} · ${item.bound ? "Bound" : "Tradeable"}`}
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
                      Core equipment slots are protected. Choose a replacement to restore this slot.
                    </EmptyState>
                  )}
                </GameCard>
              );
            })}
          </div>

          {changingSlot ? (
            <section className="inventory-subsection equipment-picker" aria-label={`${formatSlot(changingSlot)} replacement picker`}>
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
                <GameCard className="equipment-confirm-card">
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
                </GameCard>
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
                      <GameButton
                        onClick={() => setPendingReplacement(item)}
                        disabled={Boolean(item.equippedSlot) || swap.isPending}
                      >
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
            </section>
          ) : null}

          <section className="inventory-subsection" aria-label="Owned equipment">
            <div className="section-title-row">
              <strong>Owned Equipment</strong>
              <label className="equipment-toggle">
                <input
                  type="checkbox"
                  checked={showEquippedItems}
                  onChange={(event) => setShowEquippedItems(event.target.checked)}
                />
                Show Equipped Items
              </label>
            </div>
            {ownedEquipment.length ? (
              <div className="inventory-item-list">
                {ownedEquipment.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className="inventory-item-row"
                    style={{ borderColor: rarityColors[item.rarity] }}
                    onClick={() => {
                      setChangingSlot(item.slot);
                      setPendingReplacement(item.equippedSlot ? null : item);
                    }}
                  >
                    <AssetIcon src={itemAssetPath(item.definitionId)} alt={item.name} decorative={false} />
                    <span>
                      <strong>{item.name}</strong>
                      <small>{formatSlot(item.slot)} · Level {item.level} · {item.bound ? "Bound" : "Tradeable"}</small>
                    </span>
                    <em>{item.equippedSlot ? "Equipped" : "Change"}</em>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState title="No replacement equipment yet." iconSrc={uiAssetManifest.icons.heroLoadout}>
                Clear more stages, craft gear, or visit the Market Board.
              </EmptyState>
            )}
          </section>
        </section>
      ) : null}

      {activeTab === "consumables" ? (
        <section className="inventory-card-grid" aria-label="Consumables">
          {(inventory.data?.consumables ?? consumableDefinitions.map((item) => ({
            ...item,
            definitionId: item.id,
            quantity: 0,
            bound: true
          }))).map((item) => (
            <ItemCard
              key={item.definitionId}
              iconSrc={itemAssetPath(item.definitionId)}
              title={item.name}
              meta={`Quantity ${item.quantity} · ${item.bound ? "Bound" : "Tradeable"}`}
            >
              <p>{item.description}</p>
            </ItemCard>
          ))}
        </section>
      ) : null}

      {activeTab === "materials" ? (
        <section className="inventory-card-grid" aria-label="Materials">
          {inventory.data?.materials?.length ? (
            inventory.data.materials.map((item) =>
              starlightMaterialIds.has(item.id) ? (
                <GameCard key={item.id} className="inventory-stack-card">
                  <strong>{item.name}</strong>
                  <small>Quantity {item.quantity} · {item.bound ? "Bound" : "Tradeable"}</small>
                  <p>Starlight Vault material. Icon hidden until manual art is supplied.</p>
                </GameCard>
              ) : (
                <ItemCard
                  key={item.id}
                  iconSrc={itemAssetPath(item.id)}
                  title={item.name}
                  meta={`Quantity ${item.quantity} · ${item.bound ? "Bound" : "Tradeable"}`}
                />
              )
            )
          ) : (
            <EmptyState title="No materials collected yet." iconSrc={uiAssetManifest.items["tower-shard"]}>
              Tower Shards, Moss Thread, Ember Cores, Tidal Pearls, and Starlit Dust will appear here.
            </EmptyState>
          )}
          <div className="known-material-strip" aria-label="Known material examples">
            {materialDefinitions.map((material) => (
              <span key={material.id}>
                <AssetIcon src={itemAssetPath(material.id)} />
                {material.name}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === "cosmetics" ? (
        <section className="cosmetics-panel" aria-label="Cosmetics">
          <GameCard className="active-hero-card">
            <HeroAppearancePreview
              heroId={selectedHero.id}
              appearance={appearance}
              size="portrait"
              className="hero-card-preview"
              label={`${selectedHero.name} customization preview`}
            />
            <div>
              <span className="game-eyebrow">Active Hero Appearance</span>
              <h3>{selectedHero.name}</h3>
              <p>Town, lobby, profile, and raid avatar appearance are tied to the active selected Hero.</p>
            </div>
          </GameCard>
          <section className="inventory-subsection" aria-label="Full Costume slot">
            <div className="section-title-row">
              <strong>Full Costume</strong>
              <span className="tag">Appearance-only</span>
            </div>
            <GameCard className="full-costume-slot-card">
              <div>
                <span className="game-eyebrow">Active Hero Slot</span>
                <strong>{equippedFullCostume?.name ?? "Default Appearance"}</strong>
                <p>Full Costume is separate from Weapon, Armor, Relic, and Charm. It does not change combat stats or equipment slots.</p>
              </div>
              <GameButton
                variant="secondary"
                disabled={!equippedFullCostumeId || equipCostume.isPending}
                onClick={() => equipCostume.mutate({ heroId: selectedHero.id, costumeId: null })}
              >
                Use Default Appearance
              </GameButton>
            </GameCard>
            {ownedCostumes.length ? (
              <div className="starlight-reward-grid">
                {ownedCostumes.map((costume) => {
                  const definition = fullCostumeDefinitions.find((entry) => entry.id === costume.costumeId);
                  const equipped = costume.costumeId === equippedFullCostumeId;
                  return (
                    <GameCard key={costume.costumeId} className="starlight-reward-card" style={{ borderColor: rarityColors[costume.rarity] }}>
                      <span className="game-eyebrow">{costume.rarity}</span>
                      <strong>{costume.name}</strong>
                      <small>{costume.bound ? "Bound" : "Tradeable"} · {equipped ? "Equipped" : "Owned"}</small>
                      <p>{definition?.theme ?? "Manual costume details pending."}</p>
                      <span className="tag">Preview hidden until manual Hero assets are ready</span>
                      <GameButton
                        disabled={equipped || equipCostume.isPending}
                        onClick={() => equipCostume.mutate({ heroId: selectedHero.id, costumeId: costume.costumeId })}
                      >
                        {equipped ? "Equipped" : "Equip Costume"}
                      </GameButton>
                    </GameCard>
                  );
                })}
              </div>
            ) : (
              <EmptyState title="No Full Costumes owned yet.">
                Starlight Vault Full Costumes will appear here after their manual assets are ready and you unlock them.
              </EmptyState>
            )}
          </section>
          <div className="cosmetic-grid" data-testid="cosmetic-metadata-grid">
            <CosmeticSelect
              label="Hair"
              value={appearance.hairStyle}
              options={heroCustomizationOptions.hairStyles}
              onChange={(hairStyle) => updateAppearance({ hairStyle })}
            />
            <ColorCosmetic
              label="Hair Color"
              value={appearance.hairColor}
              options={heroCustomizationOptions.hairColors}
              onChange={(hairColor) => updateAppearance({ hairColor })}
            />
            <ColorCosmetic
              label="Skin Tone"
              value={appearance.skinTone}
              options={heroCustomizationOptions.skinTones}
              onChange={(skinTone) => updateAppearance({ skinTone })}
            />
            <CosmeticSelect
              label="Outfit Variant"
              value={appearance.outfitVariant}
              options={heroCustomizationOptions.outfitVariants}
              onChange={(outfitVariant) => updateAppearance({ outfitVariant })}
            />
            <ColorCosmetic
              label="Accent Color"
              value={appearance.accentColor}
              options={heroCustomizationOptions.accentColors}
              onChange={(accentColor) => updateAppearance({ accentColor })}
            />
            <CosmeticSelect
              label="Cloak / Back"
              value={appearance.backAccessory}
              options={heroCustomizationOptions.backAccessories}
              onChange={(backAccessory) => updateAppearance({ backAccessory })}
            />
            <ColorCosmetic
              label="Weapon Accent"
              value={appearance.weaponAccent}
              options={heroCustomizationOptions.weaponAccents}
              onChange={(weaponAccent) => updateAppearance({ weaponAccent })}
            />
          </div>
          <GameButton variant="secondary" onClick={() => updateAppearance({ accentColor: selectedHero.accent as HeroAppearance["accentColor"] })}>
            <Palette size={17} /> Restore Hero Accent
          </GameButton>
        </section>
      ) : null}
    </div>
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

function CosmeticSelect<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: T;
  options: readonly { id: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <article className="cosmetic-control">
      <label>
        <span>{label}</span>
        <select value={value} onChange={(event) => onChange(event.target.value as T)}>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </article>
  );
}

function ColorCosmetic<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: T;
  options: readonly { id: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <article className="cosmetic-control cosmetic-color-control">
      <span>{label}</span>
      <div className="cosmetic-swatch-row">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={option.id === value ? "active" : ""}
            style={{ "--swatch-color": option.id } as CSSProperties}
            aria-label={`${label}: ${option.label}`}
            aria-pressed={option.id === value}
            onClick={() => onChange(option.id)}
          >
            <span aria-hidden="true" />
          </button>
        ))}
      </div>
      <strong>{options.find((option) => option.id === value)?.label ?? value}</strong>
    </article>
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

function totalStats(base: Record<string, number>, equipment: EquipmentItem[]): Record<string, number> {
  const totals = { ...base };
  for (const item of equipment) {
    for (const [stat, value] of Object.entries(item.stats)) {
      totals[stat] = (totals[stat] ?? 0) + value;
    }
  }
  return totals;
}
