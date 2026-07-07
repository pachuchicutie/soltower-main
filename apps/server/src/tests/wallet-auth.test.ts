import { describe, expect, it } from "vitest";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { createDevStore } from "../data/store";
import { getPlayerOrThrow } from "../services/economy";
import { authenticateWallet, createWalletNonce } from "../services/walletAuth";

function makeSignedLogin(store = createDevStore(), displayName = "WalletHero") {
  const keypair = nacl.sign.keyPair();
  const publicKey = bs58.encode(keypair.publicKey);
  const nonce = createWalletNonce(store, publicKey);
  const signature = bs58.encode(nacl.sign.detached(new TextEncoder().encode(nonce.message), keypair.secretKey));
  return { store, publicKey, nonce, signature, displayName, secretKey: keypair.secretKey };
}

describe("wallet authentication", () => {
  it("expires nonces", () => {
    const login = makeSignedLogin();
    login.nonce.expiresAt = new Date(Date.now() - 1000).toISOString();
    expect(() =>
      authenticateWallet(login.store, {
        publicKey: login.publicKey,
        nonce: login.nonce.nonce,
        message: login.nonce.message,
        signature: login.signature,
        displayName: login.displayName,
        walletName: "Test Wallet"
      })
    ).toThrow(/expired/);
  });

  it("rejects reused nonces", () => {
    const login = makeSignedLogin();
    authenticateWallet(login.store, {
      publicKey: login.publicKey,
      nonce: login.nonce.nonce,
      message: login.nonce.message,
      signature: login.signature,
      displayName: login.displayName,
      walletName: "Test Wallet"
    });
    expect(() =>
      authenticateWallet(login.store, {
        publicKey: login.publicKey,
        nonce: login.nonce.nonce,
        message: login.nonce.message,
        signature: login.signature,
        displayName: login.displayName,
        walletName: "Test Wallet"
      })
    ).toThrow(/already been used/);
  });

  it("rejects invalid signatures", () => {
    const login = makeSignedLogin();
    expect(() =>
      authenticateWallet(login.store, {
        publicKey: login.publicKey,
        nonce: login.nonce.nonce,
        message: login.nonce.message,
        signature: bs58.encode(new Uint8Array(64).fill(1)),
        displayName: login.displayName,
        walletName: "Test Wallet"
      })
    ).toThrow(/Invalid wallet signature/);
  });

  it("creates and retrieves the correct unique wallet profile", () => {
    const login = makeSignedLogin();
    const first = authenticateWallet(login.store, {
      publicKey: login.publicKey,
      nonce: login.nonce.nonce,
      message: login.nonce.message,
      signature: login.signature,
      displayName: login.displayName,
      walletName: "Backpack"
    });
    expect(first.isNewPlayer).toBe(true);
    const player = getPlayerOrThrow(login.store, first.playerId);
    expect(player.walletPublicKey).toBe(login.publicKey);
    expect(player.displayName).toBe(login.displayName);

    const nonce2 = createWalletNonce(login.store, login.publicKey);
    const keypair2 = nacl.sign.keyPair();
    const wrongSignature = bs58.encode(nacl.sign.detached(new TextEncoder().encode(nonce2.message), keypair2.secretKey));
    expect(() =>
      authenticateWallet(login.store, {
        publicKey: login.publicKey,
        nonce: nonce2.nonce,
        message: nonce2.message,
        signature: wrongSignature,
        displayName: "Different",
        walletName: "Backpack"
      })
    ).toThrow(/Invalid wallet signature/);
  });

  it("grants exactly 50 Locked Gold once to first-time wallet players", () => {
    const login = makeSignedLogin();
    const first = authenticateWallet(login.store, {
      publicKey: login.publicKey,
      nonce: login.nonce.nonce,
      message: login.nonce.message,
      signature: login.signature,
      displayName: login.displayName,
      walletName: "Phantom"
    });
    const player = getPlayerOrThrow(login.store, first.playerId);
    expect(player.balances.LOCKED_GOLD).toBe(50);
    expect(login.store.ledger.filter((entry) => entry.playerId === player.id && entry.sourceType === "STARTER_LOCKED_GOLD")).toHaveLength(1);

    const nonce2 = createWalletNonce(login.store, login.publicKey);
    const signature2 = bs58.encode(nacl.sign.detached(new TextEncoder().encode(nonce2.message), login.secretKey));
    const returning = authenticateWallet(login.store, {
      publicKey: login.publicKey,
      nonce: nonce2.nonce,
      message: nonce2.message,
      signature: signature2,
      displayName: "AnotherName",
      walletName: "Phantom"
    });
    expect(returning.isNewPlayer).toBe(false);
    expect(player.balances.LOCKED_GOLD).toBe(50);
    expect(login.store.ledger.filter((entry) => entry.playerId === player.id && entry.sourceType === "STARTER_LOCKED_GOLD")).toHaveLength(1);
  });

  it("does not create a player just by requesting a nonce", () => {
    const store = createDevStore({ devMode: false });
    const before = store.players.size;
    const keypair = nacl.sign.keyPair();
    createWalletNonce(store, bs58.encode(keypair.publicKey));
    expect(store.players.size).toBe(before);
  });

  it("allows the explicit DEV mock wallet only in DEV_MODE", () => {
    const store = createDevStore();
    const nonce = createWalletNonce(store, "DevMockMarky111111111111111111111111111111111");
    const result = authenticateWallet(store, {
      publicKey: "DevMockMarky111111111111111111111111111111111",
      nonce: nonce.nonce,
      message: nonce.message,
      signature: "DEV_MOCK_SIGNATURE",
      walletName: "DEV Mock Wallet"
    });
    expect(result.playerId).toBe("player-marky");
    expect(result.isNewPlayer).toBe(false);
  });
});
