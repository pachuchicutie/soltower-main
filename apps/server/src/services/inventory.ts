import { shopEquipment, type EquipmentSlot } from "@soltower/shared";
import { type DevStore, type PlayerEquipmentRecord, makeId } from "../data/store";
import { applyLedgerMutation, getPlayerOrThrow } from "./economy";

export function getInventory(store: DevStore, playerId: string): {
  equipment: Array<PlayerEquipmentRecord & { name: string; rarity: string; slot: EquipmentSlot }>;
  consumables: Array<{ id: string; definitionId: string; name: string; quantity: number; equipped: boolean }>;
} {
  const equipment = Array.from(store.playerEquipment.values())
    .filter((entry) => entry.playerId === playerId)
    .map((entry) => {
      const definition = store.equipmentDefinitions.get(entry.definitionId);
      if (!definition) {
        throw new Error("Equipment definition missing");
      }
      return { ...entry, name: definition.name, rarity: definition.rarity, slot: definition.slot };
    });
  const consumables = Array.from(store.playerConsumables.values())
    .filter((entry) => entry.playerId === playerId)
    .map((entry) => ({
      id: entry.id,
      definitionId: entry.definitionId,
      name: entry.definitionId
        .split("-")
        .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
        .join(" "),
      quantity: entry.quantity,
      equipped: entry.equipped
    }));
  return { equipment, consumables };
}

export function equipItem(store: DevStore, playerId: string, equipmentId: string): PlayerEquipmentRecord {
  const item = store.playerEquipment.get(equipmentId);
  if (!item || item.playerId !== playerId) {
    throw new Error("Equipment not found");
  }
  const definition = store.equipmentDefinitions.get(item.definitionId);
  if (!definition) {
    throw new Error("Equipment definition missing");
  }
  Array.from(store.playerEquipment.values())
    .filter((entry) => entry.playerId === playerId && entry.equippedSlot === definition.slot)
    .forEach((entry) => {
      entry.equippedSlot = null;
    });
  item.equippedSlot = definition.slot;
  return item;
}

export function buyBoundShopItem(
  store: DevStore,
  playerId: string,
  definitionId: string,
  idempotencyKey: string
): PlayerEquipmentRecord {
  const definition = shopEquipment.find((entry) => entry.id === definitionId);
  if (!definition) {
    throw new Error("Shop item not found");
  }
  const player = getPlayerOrThrow(store, playerId);
  const balanceType = player.balances.LOCKED_GOLD >= definition.priceGold ? "LOCKED_GOLD" : "EARNED_GOLD";
  applyLedgerMutation(store, {
    playerId,
    balanceType,
    sourceType: "EQUIPMENT_PURCHASE",
    amount: definition.priceGold,
    direction: "DEBIT",
    reason: "Bound Shop equipment purchase",
    idempotencyKey,
    referenceEntityType: "EquipmentDefinition",
    referenceEntityId: definition.id
  });
  const item: PlayerEquipmentRecord = {
    id: makeId("equip"),
    playerId,
    definitionId,
    equippedSlot: null,
    bound: true,
    level: 1
  };
  store.playerEquipment.set(item.id, item);
  return item;
}
