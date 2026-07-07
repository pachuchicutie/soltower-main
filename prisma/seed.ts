import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import {
  consumables,
  economyConfig,
  rolePermissions,
  seededPlayer,
  shopEquipment,
  starterEquipment
} from "@soltower/shared";
import { heroDefinitions, mapDefinitions } from "@soltower/game-engine";

process.env.DATABASE_URL ??= "file:./dev.db";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  await prisma.player.upsert({
    where: { id: seededPlayer.id },
    update: {},
    create: {
      id: seededPlayer.id,
      displayName: seededPlayer.displayName,
      walletPublicKey: seededPlayer.walletPublicKey,
      walletLinkedAt: new Date(seededPlayer.walletLinkedAt ?? new Date().toISOString()),
      accountLevel: seededPlayer.accountLevel,
      avatar: seededPlayer.avatar,
      power: seededPlayer.power
    }
  });

  await prisma.player.upsert({
    where: { id: economyConfig.treasuryPlayerId },
    update: {},
    create: {
      id: economyConfig.treasuryPlayerId,
      displayName: "DEV Treasury",
      walletPublicKey: null,
      walletLinkedAt: null,
      accountLevel: 99,
      avatar: "T",
      power: 0
    }
  });

  for (const [balanceType, amount] of Object.entries(seededPlayer.balances)) {
    await prisma.playerBalance.upsert({
      where: { playerId_balanceType: { playerId: seededPlayer.id, balanceType: balanceType as "EARNED_GOLD" | "LOCKED_GOLD" | "TEST_TOKEN" } },
      update: { amount },
      create: { playerId: seededPlayer.id, balanceType: balanceType as "EARNED_GOLD" | "LOCKED_GOLD" | "TEST_TOKEN", amount }
    });
  }

  for (const hero of heroDefinitions) {
    await prisma.hero.upsert({
      where: { id: hero.id },
      update: { name: hero.name, role: hero.role, ultimate: hero.ultimate, stats: hero.stats },
      create: { id: hero.id, name: hero.name, role: hero.role, ultimate: hero.ultimate, stats: hero.stats }
    });
  }

  for (const map of mapDefinitions) {
    await prisma.mapDefinition.upsert({
      where: { id: map.id },
      update: {
        name: map.name,
        chapter: map.chapter,
        recommendedPower: map.recommendedPower,
        baseGoldReward: map.baseGoldReward,
        baseXpReward: map.baseXpReward
      },
      create: {
        id: map.id,
        name: map.name,
        chapter: map.chapter,
        recommendedPower: map.recommendedPower,
        baseGoldReward: map.baseGoldReward,
        baseXpReward: map.baseXpReward
      }
    });
  }

  for (const mapId of seededPlayer.unlockedMaps) {
    await prisma.playerMapUnlock.upsert({
      where: { playerId_mapId: { playerId: seededPlayer.id, mapId } },
      update: {},
      create: { playerId: seededPlayer.id, mapId }
    });
  }

  for (const item of [...starterEquipment, ...shopEquipment]) {
    await prisma.equipmentDefinition.upsert({
      where: { id: item.id },
      update: {
        name: item.name,
        slot: item.slot,
        rarity: item.rarity,
        bound: item.bound,
        priceGold: item.priceGold,
        stats: item.stats
      },
      create: {
        id: item.id,
        name: item.name,
        slot: item.slot,
        rarity: item.rarity,
        bound: item.bound,
        priceGold: item.priceGold,
        stats: item.stats
      }
    });
  }

  for (const consumable of consumables) {
    await prisma.consumableDefinition.upsert({
      where: { id: consumable.id },
      update: consumable,
      create: consumable
    });
  }

  const passwordHash = await hash("ChangeMe123!", 12);
  const admins = [
    { email: "owner@soltower.local", role: "OWNER" as const, displayName: "Owner" },
    { email: "admin@soltower.local", role: "ADMIN" as const, displayName: "Admin" },
    { email: "moderator@soltower.local", role: "MODERATOR" as const, displayName: "Moderator" }
  ];

  for (const admin of admins) {
    await prisma.adminUser.upsert({
      where: { email: admin.email },
      update: { passwordHash, role: admin.role, displayName: admin.displayName },
      create: { ...admin, passwordHash }
    });
  }

  for (const [role, permissions] of Object.entries(rolePermissions)) {
    await prisma.adminRole.upsert({
      where: { name: role as "OWNER" | "ADMIN" | "ECONOMY_MANAGER" | "GAME_DESIGNER" | "MODERATOR" | "SUPPORT" },
      update: { permissions: [...permissions] },
      create: {
        name: role as "OWNER" | "ADMIN" | "ECONOMY_MANAGER" | "GAME_DESIGNER" | "MODERATOR" | "SUPPORT",
        description: `${role} development role`,
        permissions: [...permissions]
      }
    });
  }
}

await main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
