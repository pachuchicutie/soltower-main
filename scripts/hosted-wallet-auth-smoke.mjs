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

const authClient = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const auth = await authClient.auth.signInAnonymously();
assert(!auth.error && Boolean(auth.data.session), "Anonymous Supabase Auth session must succeed");

const seed = createHash("sha256")
  .update(`soltower-wallet-auth-smoke:${randomUUID()}`)
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

const requestId = randomUUID();
const challenge = await invoke(authClient, "create-wallet-nonce", {
  publicKeyBase58: publicKey,
  requestId,
  provider: "Hosted Wallet Smoke"
});

assert(typeof challenge.challengeId === "string", "Challenge ID must be returned");
assert(typeof challenge.messageBase64 === "string", "Challenge message bytes must be returned");
assert(!("message" in challenge), "Challenge response must not expose a message string contract");

const challengeBytes = Buffer.from(challenge.messageBase64, "base64");
assert(challengeBytes.byteLength > 0, "Challenge message bytes must decode");

const invalid = await authClient.functions.invoke("verify-wallet-signature", {
  body: {
    publicKeyBase58: publicKey,
    currentWalletPublicKey: publicKey,
    challengeId: challenge.challengeId,
    signatureBase64: Buffer.from(new Uint8Array(64)).toString("base64"),
    requestId,
    provider: "Hosted Wallet Smoke"
  }
});
assert(Boolean(invalid.error), "Invalid signature must fail");
const invalidDetail = await edgeErrorDetail(invalid.error);
assert(invalidDetail.code === "invalid_signature", "Invalid signature must preserve structured code");

const signatureBase64 = sign(null, challengeBytes, privateKey).toString("base64");
const verified = await invoke(authClient, "verify-wallet-signature", {
  publicKeyBase58: publicKey,
  currentWalletPublicKey: publicKey,
  challengeId: challenge.challengeId,
  signatureBase64,
  requestId,
  provider: "Hosted Wallet Smoke"
});
assert(
  verified.requiresProfile === true || verified.requiresProfile === false,
  "Valid signature must return a wallet verification result"
);

const replay = await authClient.functions.invoke("verify-wallet-signature", {
  body: {
    publicKeyBase58: publicKey,
    currentWalletPublicKey: publicKey,
    challengeId: challenge.challengeId,
    signatureBase64,
    requestId,
    provider: "Hosted Wallet Smoke"
  }
});
assert(Boolean(replay.error), "Consumed challenge must not be reusable");
const replayDetail = await edgeErrorDetail(replay.error);
assert(replayDetail.code === "duplicate_submission", "Challenge replay must return duplicate_submission");

console.info("Hosted wallet auth smoke passed.");

async function invoke(client, name, body) {
  const { data, error } = await client.functions.invoke(name, { body });
  if (error) {
    const detail = await edgeErrorDetail(error);
    throw new Error(`${name} failed: ${detail.code ?? "unknown"} ${detail.message}`);
  }
  return data;
}

async function edgeErrorDetail(error) {
  const response = error?.context;
  if (response instanceof Response) {
    try {
      return await response.clone().json();
    } catch {
      return { message: await response.clone().text() };
    }
  }
  return { message: error?.message ?? "Unknown Edge Function error" };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
