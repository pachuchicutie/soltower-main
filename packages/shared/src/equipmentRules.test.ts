import { describe, expect, it } from "vitest";
import { equipmentSlots } from "./types";
import { shopEquipment, starterEquipment } from "./content";

describe("core equipment rules", () => {
  it("ships one starter item for every protected equipment slot", () => {
    expect(new Set(starterEquipment.map((item) => item.slot))).toEqual(new Set(equipmentSlots));
  });

  it("keeps starter equipment bound and non-tradeable by definition", () => {
    for (const item of starterEquipment) {
      expect(item.bound, item.name).toBe(true);
      expect(item.priceGold, item.name).toBe(0);
    }
  });

  it("does not define shop equipment outside protected core slots", () => {
    for (const item of shopEquipment) {
      expect(equipmentSlots).toContain(item.slot);
    }
  });
});
