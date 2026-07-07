import {
  createHash,
  createPrivateKey,
  createPublicKey,
  randomUUID,
  sign
} from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import bs58 from "bs58";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required");
}

const publicClient = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const publicStats = await invoke(publicClient, "get-player-bootstrap-data", {
  section: "public-stats"
});
assert(publicStats.devMode === true, "Hosted smoke profile creation is DEV_MODE-only");
assert(
  Number.isInteger(publicStats.demoPresenceCount),
  "Public world status must return backend-derived presence"
);

const inventory = await publicClient
  .from("inventory_items")
  .select("id", { count: "exact", head: true });
assert(!inventory.error && inventory.count === 0, "Spectator inventory access must return no rows");

const spectatorMutation = await publicClient.functions.invoke("create-market-listing", {
  body: {
    goldAmount: 100,
    pricePerGold: 1,
    idempotencyKey: "spectator-smoke-must-fail"
  }
});
assert(Boolean(spectatorMutation.error), "Spectator mutation must be rejected");

const authClient = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const auth = await authClient.auth.signInAnonymously();
assert(!auth.error && Boolean(auth.data.session), "Anonymous Supabase Auth session must succeed");

const seed = createHash("sha256")
  .update("soltower-hosted-onboarding-smoke-v1")
  .digest()
  .subarray(0, 32);
const privateDer = Buffer.concat([
  Buffer.from("302e020100300506032b657004220420", "hex"),
  seed
]);
const privateKey = createPrivateKey({
  key: privateDer,
  format: "der",
  type: "pkcs8"
});
const publicDer = createPublicKey(privateKey).export({
  format: "der",
  type: "spki"
});
const publicKey = bs58.encode(publicDer.subarray(publicDer.length - 32));
const displayName = `Smoke${publicKey.slice(0, 8)}`;

const requestId = randomUUID();
const nonce = await invoke(authClient, "create-wallet-nonce", {
  publicKeyBase58: publicKey,
  requestId,
  provider: "Hosted Smoke Wallet"
});
const invalid = await authClient.functions.invoke("verify-wallet-signature", {
  body: {
    publicKeyBase58: publicKey,
    currentWalletPublicKey: publicKey,
    challengeId: nonce.challengeId,
    signatureBase64: Buffer.from(new Uint8Array(64)).toString("base64"),
    requestId,
    provider: "Hosted Smoke Wallet"
  }
});
assert(Boolean(invalid.error), "Invalid wallet signature must fail");
const invalidDetail = await edgeErrorDetail(invalid.error);
assert(invalidDetail.code === "invalid_signature", "Invalid signature must return its structured failure code");

const challengeBytes = Buffer.from(nonce.messageBase64, "base64");
assert(challengeBytes.byteLength > 0, "Challenge message bytes must be returned as base64");
const signatureBase64 = sign(null, challengeBytes, privateKey).toString("base64");
const verified = await invoke(authClient, "verify-wallet-signature", {
  publicKeyBase58: publicKey,
  currentWalletPublicKey: publicKey,
  challengeId: nonce.challengeId,
  signatureBase64,
  requestId,
  provider: "Hosted Smoke Wallet"
});

let bootstrap = verified;
let createdProfile = false;
if (verified.requiresProfile) {
  const availability = await invoke(authClient, "get-player-bootstrap-data", {
    section: "display-name-availability",
    displayName
  });
  assert(availability.available === true, "Deterministic smoke name must be available");
  bootstrap = await invoke(authClient, "create-player-profile", {
    publicKey,
    nonce: nonce.nonce,
    displayName,
    walletName: "Hosted Smoke Wallet"
  });
  createdProfile = true;
}

assert(bootstrap.player?.balances?.LOCKED_GOLD === 50, "Starter Locked Gold must equal 50");
assert(bootstrap.selectedHeroId === "storm-archer", "Starter hero must be Storm Archer");
assert(bootstrap.unlockedMapCount === 1, "New smoke guardian must start with one map");

const idempotentProfile = await invoke(authClient, "create-player-profile", {
  publicKey,
  nonce: nonce.nonce,
  displayName,
  walletName: "Hosted Smoke Wallet"
});
assert(
  idempotentProfile.player.id === bootstrap.player.id,
  "Repeated profile creation must load the same player"
);
assert(
  idempotentProfile.player.balances.LOCKED_GOLD === 50,
  "Repeated profile creation must not duplicate starter Gold"
);

const ledger = await authClient
  .from("economy_ledger")
  .select("id", { count: "exact", head: true })
  .eq("source_type", "STARTER_LOCKED_GOLD");
assert(!ledger.error && ledger.count === 1, "Starter ledger must contain exactly one grant");

const replay = await authClient.functions.invoke("verify-wallet-signature", {
  body: {
    publicKeyBase58: publicKey,
    currentWalletPublicKey: publicKey,
    challengeId: nonce.challengeId,
    signatureBase64,
    requestId,
    provider: "Hosted Smoke Wallet"
  }
});
assert(Boolean(replay.error), "Consumed wallet nonce must not be reusable");
const replayDetail = await edgeErrorDetail(replay.error);
assert(replayDetail.code === "duplicate_submission", "Nonce replay must return duplicate_submission");

const loaded = await invoke(authClient, "get-player-bootstrap-data", { section: "me" });
assert(loaded.player.id === bootstrap.player.id, "Valid wallet must load the linked profile");

const balanceBeforeUpdate = await authClient
  .from("player_balances")
  .select("amount")
  .eq("player_id", bootstrap.player.id)
  .eq("balance_type", "EARNED_GOLD")
  .single();
assert(!balanceBeforeUpdate.error, "Player must be able to read own balance before RLS update check");
const directBalanceUpdate = await authClient
  .from("player_balances")
  .update({ amount: 999999 })
  .eq("player_id", bootstrap.player.id)
  .eq("balance_type", "EARNED_GOLD");
const balanceAfterUpdate = await authClient
  .from("player_balances")
  .select("amount")
  .eq("player_id", bootstrap.player.id)
  .eq("balance_type", "EARNED_GOLD")
  .single();
assert(!balanceAfterUpdate.error, "Player must be able to read own balance after RLS update check");
assert(
  Boolean(directBalanceUpdate.error) ||
    balanceAfterUpdate.data.amount === balanceBeforeUpdate.data.amount,
  "RLS must block direct player balance updates"
);

const questsBeforeRaid = await invoke(authClient, "get-player-quests", {});
assert(questsBeforeRaid.daily.length === 3, "Daily reset must assign exactly 3 eligible quests");
assert(
  !questsBeforeRaid.daily.some((quest) =>
    ["daily-party-up", "daily-skill-in-motion"].includes(quest.definitionId)
  ),
  "Daily quests must not include unsupported party or skill-event quests"
);
assert(
  !questsBeforeRaid.weekly.some((quest) => quest.definitionId === "weekly-full-crew"),
  "Weekly Full Crew must not be assigned before full-party validation exists"
);
assert(
  questsBeforeRaid.achievements.some(
    (achievement) => achievement.achievementId === "achievement-first-steps"
  ),
  "Achievement definitions must be readable through the safe Edge Function"
);

const questProgressBefore = await authClient
  .from("player_quest_assignments")
  .select("id, progress")
  .eq("player_id", bootstrap.player.id)
  .limit(1);
assert(!questProgressBefore.error, "Player must be able to read own quest assignment");
const directQuestProgress = await authClient
  .from("player_quest_assignments")
  .update({ progress: 99 })
  .eq("player_id", bootstrap.player.id);
const questProgressAfter = questProgressBefore.data[0]
  ? await authClient
      .from("player_quest_assignments")
      .select("progress")
      .eq("id", questProgressBefore.data[0].id)
      .single()
  : { error: null, data: null };
assert(!questProgressAfter.error, "Player must be able to reread own quest assignment");
assert(
  Boolean(directQuestProgress.error) ||
    !questProgressBefore.data[0] ||
    questProgressAfter.data.progress === questProgressBefore.data[0].progress,
  "RLS must block browser quest progress mutation"
);

await invoke(authClient, "start-prototype-raid", {
  mapId: "tower-1-1",
  idempotencyKey: "hosted-smoke-quest-raid-20260629000400"
});
const questsAfterRaid = await invoke(authClient, "get-player-quests", {});
const completeDaily = questsAfterRaid.daily.find((quest) =>
  ["COMPLETE", "CLAIMED"].includes(quest.status)
);
assert(Boolean(completeDaily), "Verified raid history must complete at least one eligible daily quest");
assert(
  questsAfterRaid.weekly.some((quest) => quest.progress > 0),
  "Verified raid history must progress eligible weekly quests"
);
const claim = await invoke(authClient, "claim-quest-reward", {
  assignmentId: completeDaily.assignmentId,
  idempotencyKey: `hosted-smoke-quest-claim:${completeDaily.assignmentId}`
});
assert(Boolean(claim.claim), "Completed quest claim must return a claim record");
const duplicateClaim = await invoke(authClient, "claim-quest-reward", {
  assignmentId: completeDaily.assignmentId,
  idempotencyKey: `hosted-smoke-quest-claim:${completeDaily.assignmentId}`
});
assert(
  duplicateClaim.idempotent === true || duplicateClaim.alreadyClaimed === true,
  "Repeated quest claim must be idempotent"
);
const questLedger = await authClient
  .from("economy_ledger")
  .select("id", { count: "exact", head: true })
  .eq("source_type", "QUEST_REWARD")
  .eq("reference_entity_id", completeDaily.assignmentId);
assert(!questLedger.error && questLedger.count === 1, "Quest reward must create one immutable ledger record");

const returningClient = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const returningAuth = await returningClient.auth.signInAnonymously();
assert(
  !returningAuth.error && Boolean(returningAuth.data.session),
  "Fresh returning Supabase Auth session must succeed"
);
const returningRequestId = randomUUID();
const returningNonce = await invoke(returningClient, "create-wallet-nonce", {
  publicKeyBase58: publicKey,
  requestId: returningRequestId,
  provider: "Hosted Smoke Wallet"
});
const returningSignatureBase64 = sign(
  null,
  Buffer.from(returningNonce.message),
  privateKey
).toString("base64");
const returning = await invoke(returningClient, "verify-wallet-signature", {
  publicKeyBase58: publicKey,
  currentWalletPublicKey: publicKey,
  nonce: returningNonce.nonce,
  message: returningNonce.message,
  signatureBase64: returningSignatureBase64,
  requestId: returningRequestId,
  provider: "Hosted Smoke Wallet"
});
assert(returning.isNewPlayer === false, "Linked wallet must use the returning-player flow");
assert(
  returning.player.id === bootstrap.player.id,
  "Fresh wallet session must reclaim the linked profile"
);
assert(
  returning.player.balances.LOCKED_GOLD === 50,
  "Returning wallet must not duplicate starter Gold"
);

console.info(
  JSON.stringify({
    publicWorldStatus: "passed",
    spectatorRls: "passed",
    invalidSignature: "passed",
    nonceReplay: "passed",
    profileFlow: createdProfile ? "created" : "returning",
    freshReturningSession: "passed",
    starterGrantIdempotency: "passed",
    bootstrap: "passed",
    directBalanceRls: "passed",
    questAssignment: "passed",
    questProgressFromRaid: "passed",
    questClaimIdempotency: "passed"
  })
);

async function invoke(client, name, body) {
  const result = await client.functions.invoke(name, { body });
  if (result.error) {
    throw result.error;
  }
  return result.data;
}

async function edgeErrorDetail(error) {
  if (error?.context instanceof Response) {
    return error.context.clone().json();
  }
  return { code: null, message: error?.message ?? "Unknown Edge Function error" };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
