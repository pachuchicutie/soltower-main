import { describe, expect, it } from "vitest";
import {
  decodeBase64Signature,
  missingWalletVerificationFields,
  walletVerificationFailure
} from "../functions/_shared/walletVerification";

const future = "2099-01-01T00:00:00.000Z";
const request = {
  requestId: "request-123",
  submittedWalletPublicKey: "wallet-a",
  currentWalletPublicKey: "wallet-a",
  challengeRequestId: "request-123",
  challengeWalletPublicKey: "wallet-a",
  expiresAt: future,
  consumedAt: null,
  signatureEncodingValid: true,
  signatureByteLength: 64,
  publicKeyByteLength: 32,
  signatureValid: true,
  now: Date.parse("2026-06-30T00:00:00.000Z")
};

describe("wallet signature verification decisions", () => {
  it("classifies missing public key and challenge fields", () => {
    expect(missingWalletVerificationFields({
      publicKeyBase58: "",
      challengeId: "",
      signatureBase64: "signature",
      requestId: "request",
      provider: "provider"
    })).toEqual(["publicKeyBase58", "challengeId"]);
  });

  it("rejects invalid base64 signature encoding", () => {
    expect(decodeBase64Signature("not-base64***")).toBeNull();
    expect(walletVerificationFailure({
      ...request,
      signatureEncodingValid: false,
      signatureByteLength: 0,
      signatureValid: false
    })).toBe("invalid_signature_encoding");
  });

  it.each([
    ["stale_challenge", { challengeRequestId: "older-request" }],
    ["expired_nonce", { expiresAt: "2026-06-29T00:00:00.000Z" }],
    ["consumed_nonce", { consumedAt: "2026-06-30T00:00:00.000Z", challengeRequestId: "other-request" }],
    ["duplicate_submission", { consumedAt: "2026-06-30T00:00:00.000Z" }],
    ["wallet_changed", { currentWalletPublicKey: "wallet-b" }],
    ["public_key_mismatch", { challengeWalletPublicKey: "wallet-b" }],
    ["invalid_signature_length", { signatureByteLength: 12 }],
    ["invalid_public_key_length", { publicKeyByteLength: 12 }],
    ["invalid_signature", { signatureValid: false }]
  ] as const)("returns %s for the corresponding invalid attempt", (code, patch) => {
    expect(walletVerificationFailure({ ...request, ...patch })).toBe(code);
  });

  it("accepts a current, unconsumed, correctly signed challenge", () => {
    expect(walletVerificationFailure(request)).toBeNull();
  });
});
