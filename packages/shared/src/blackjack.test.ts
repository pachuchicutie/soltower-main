import { describe, expect, it } from "vitest";
import { blackjackDealSchema } from "./schemas";

describe("Blackjack deal validation", () => {
  it("allows an explicit zero-wager practice hand", () => {
    expect(
      blackjackDealSchema.parse({
        balanceType: "EARNED_GOLD",
        bet: 0,
        practice: true,
        idempotencyKey: "practice-hand-1"
      })
    ).toMatchObject({ bet: 0, practice: true });
  });

  it("rejects zero-wager economy hands and nonzero practice hands", () => {
    expect(
      blackjackDealSchema.safeParse({
        balanceType: "EARNED_GOLD",
        bet: 0,
        practice: false,
        idempotencyKey: "economy-hand-1"
      }).success
    ).toBe(false);
    expect(
      blackjackDealSchema.safeParse({
        balanceType: "LOCKED_GOLD",
        bet: 5,
        practice: true,
        idempotencyKey: "practice-hand-2"
      }).success
    ).toBe(false);
  });
});
