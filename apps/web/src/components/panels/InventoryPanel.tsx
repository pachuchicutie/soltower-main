import { useMemo, useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, Palette } from "lucide-react";
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
    giftable: boolean;
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
    tradeable: boolean;
    giftable: boolean;
    relistable: boolean;
    acquiredFrom: string;
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

interface GiftTarget {
  itemKind: "INVENTORY_ITEM" | "FULL_COSTUME";
  itemId: string;
  name: string;
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
  const [showEquippedItems, setShowEquippedItems] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [giftTarget, setGiftTarget] = useState<GiftTarget | null>(null);
  const [giftRecipientPlayerId, setGiftRecipientPlayerId] = useState("");
  const [giftError, setGiftError] = useState<string | null>(null);
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
    onMutate: () => {
      setActionError(null);
      setSuccessMessage(null);
    },
    onSuccess: async (result) => {
      setSuccessMessage(`${result.equippedItem.name} equipped. ${result.returnedItem.name} returned to Inventory.`);
      setChangingSlot(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["me"] })
      ]);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Could not equip this item.");
    }
  });
  const equipCostume = useMutation({
    mutationFn: (input: { heroId: string; costumeId: string | null }) =>
      apiPost<{ heroId: string; costumeId: string | null }>("/api/inventory/full-costume", input),
    onMutate: () => {
      setActionError(null);
      setSuccessMessage(null);
    },
    onSuccess: async (_result, variables) => {
      setSuccessMessage(variables.costumeId ? "Full Costume equipped." : "Default appearance restored.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["me"] })
      ]);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Could not equip this costume.");
    }
  });
  const giftItem = useMutation({
    mutationFn: (input: { target: GiftTarget; recipientPlayerId: string }) =>
      apiPost<{ transfer: unknown }>("/api/inventory/gift", {
        itemKind: input.target.itemKind,
        itemId: input.target.itemId,
        recipientPlayerId: input.recipientPlayerId,
        idempotencyKey: idempotencyKey("item-gift")
      }),
    onSuccess: async (_result, variables) => {
      setSuccessMessage(`${variables.target.name} sent to ${variables.recipientPlayerId}.`);
      setGiftTarget(null);
      setGiftRecipientPlayerId("");
      setGiftError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["me"] })
      ]);
    },
    onError: (error) => {
      setGiftError(error instanceof Error ? error.message : "Could not gift this item.");
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
  const beginGift = (target: GiftTarget) => {
    setGiftTarget(target);
    setGiftRecipientPlayerId("");
    setGiftError(null);
  };
  const equipEquipment = (item: EquipmentItem) => {
    if (item.equippedSlot) {
      return;
    }
    const equippedInSlot = equippedBySlot.get(item.slot);
    if (!equippedInSlot) {
      setChangingSlot(item.slot);
      setActionError(`${formatSlot(item.slot)} has no equipped item to replace.`);
      return;
    }
    swap.mutate({ equipmentId: item.id, slot: item.slot });
  };
  const sendGift = () => {
    const recipientPlayerId = giftRecipientPlayerId.trim();
    if (!giftTarget || !recipientPlayerId) {
      setGiftError("Enter the recipient player ID.");
      return;
    }
    giftItem.mutate({ target: giftTarget, recipientPlayerId });
  };

  return (
    <div className="inventory-panel">
      <ModalTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} label="Inventory tabs" />
      {giftTarget ? (
        <GameCard className="equipment-confirm-card">
          <strong>Gift / Trade {giftTarget.name}</strong>
          <p>Send this item to another player by player ID. Bound launch rewards are blocked server-side.</p>
          <input
            data-game-input="text"
            value={giftRecipientPlayerId}
            placeholder="Recipient player ID"
            aria-label="Recipient player ID"
            onChange={(event) => setGiftRecipientPlayerId(event.target.value)}
          />
          {giftError ? <span className="equipment-error tag">{giftError}</span> : null}
          <div className="button-row">
            <GameButton
              variant="ghost"
              onClick={() => {
                setGiftTarget(null);
                setGiftRecipientPlayerId("");
                setGiftError(null);
              }}
            >
              Cancel
            </GameButton>
            <GameButton onClick={sendGift} disabled={giftItem.isPending}>
              <Gift size={15} /> Send Gift
            </GameButton>
          </div>
        </GameCard>
      ) : null}

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
          {actionError ? <span className="equipment-error tag">{actionError}</span> : null}

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
                  }}
                >
                  Cancel
                </GameButton>
              </div>
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
                        onClick={() => equipEquipment(item)}
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
                {ownedEquipment.map((item) => {
                  const giftable = canGiftEquipment(item);
                  return (
                    <div
                      key={item.id}
                      className="inventory-item-row"
                      style={{ borderColor: rarityColors[item.rarity] }}
                    >
                      <span
                        className="inventory-item-icon-frame"
                        style={{ "--item-rarity-color": rarityColors[item.rarity] } as CSSProperties}
                      >
                        <AssetIcon src={itemAssetPath(item.definitionId)} alt={item.name} decorative={false} />
                        <AssetIcon src={rarityFrame(item.rarity)} className="inventory-rarity-frame" />
                      </span>
                      <span>
                        <strong>{item.name}</strong>
                        <small>{formatSlot(item.slot)} · Level {item.level} · {item.bound ? "Bound" : "Tradeable"}</small>
                        <small>{item.acquiredFrom === "PRE_REGISTRATION" ? "Launch reward · Not tradeable" : giftable ? "Giftable" : "Not giftable"}</small>
                      </span>
                      <div className="button-row inventory-row-actions">
                        <GameButton
                          variant="secondary"
                          disabled={Boolean(item.equippedSlot) || swap.isPending}
                          onClick={() => {
                            if (item.equippedSlot) {
                              return;
                            }
                            equipEquipment(item);
                          }}
                        >
                          {item.equippedSlot ? "Equipped" : "Equip"}
                        </GameButton>
                        {giftable ? (
                          <GameButton
                            variant="ghost"
                            onClick={() => beginGift({ itemKind: "INVENTORY_ITEM", itemId: item.id, name: item.name })}
                          >
                            <Gift size={14} /> Gift
                          </GameButton>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
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
          {successMessage ? <span className="equipment-success tag">{successMessage}</span> : null}
          {actionError ? <span className="equipment-error tag">{actionError}</span> : null}
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
                  const giftable = canGiftCostume(costume, equipped);
                  return (
                    <GameCard key={costume.costumeId} className="starlight-reward-card" style={{ borderColor: rarityColors[costume.rarity] }}>
                      <span className="game-eyebrow">{costume.rarity}</span>
                      <strong>{costume.name}</strong>
                      <small>{costume.bound ? "Bound" : "Tradeable"} · {equipped ? "Equipped" : "Owned"}</small>
                      <small>{costume.source === "pre_registration" ? "Launch reward · Not tradeable" : giftable ? "Giftable" : "Not giftable"}</small>
                      <p>{definition?.theme ?? "Manual costume details pending."}</p>
                      <span className="tag">Preview hidden until manual Hero assets are ready</span>
                      <div className="button-row">
                        <GameButton
                          disabled={equipped || equipCostume.isPending}
                          onClick={() => equipCostume.mutate({ heroId: selectedHero.id, costumeId: costume.costumeId })}
                        >
                          {equipped ? "Equipped" : "Equip Costume"}
                        </GameButton>
                        {giftable ? (
                          <GameButton
                            variant="ghost"
                            onClick={() => beginGift({ itemKind: "FULL_COSTUME", itemId: costume.costumeId, name: costume.name })}
                          >
                            <Gift size={14} /> Gift
                          </GameButton>
                        ) : null}
                      </div>
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

function canGiftEquipment(item: EquipmentItem): boolean {
  return !item.bound && !item.equippedSlot && item.acquiredFrom !== "PRE_REGISTRATION" && (item.giftable || item.tradeable);
}

function canGiftCostume(
  costume: NonNullable<InventoryResponse["cosmetics"]>[number],
  equipped: boolean
): boolean {
  return !costume.bound && !equipped && costume.source !== "pre_registration" && (costume.giftable || costume.tradeable);
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
