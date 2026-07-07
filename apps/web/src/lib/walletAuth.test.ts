// @vitest-environment jsdom

import bs58 from "bs58";
import { describe, expect, it } from "vitest";
import { readFunctionErrorResponse, WalletAuthError } from "./api";
import {
  decodeChallengeMessageBase64,
  normalizeWalletSignature,
  normalizeWalletSignatureBytes,
  validateWalletVerificationPayload
} from "./walletAuth";

const publicKey = bs58.encode(Uint8Array.from({ length: 32 }, (_, index) => index + 1));
const signature = Uint8Array.from({ length: 64 }, (_, index) => index);

describe("wallet auth browser boundary", () => {
  it("normalizes supported provider signatures to canonical bytes and base64 once", () => {
    const fromBytes = normalizeWalletSignature(signature);
    const fromBase58 = normalizeWalletSignature(bs58.encode(signature));
    const fromArrayBuffer = normalizeWalletSignature(signature.buffer.slice(0));
    const paddedSignatureBuffer = new Uint8Array(80);
    paddedSignatureBuffer.set(signature, 8);
    const typedArrayView = new Uint8Array(paddedSignatureBuffer.buffer, 8, 64);
    const fromTypedArrayView = normalizeWalletSignature(typedArrayView);
    const fromObjectSignature = normalizeWalletSignature({ signature });
    expect(fromBase58).toBe(fromBytes);
    expect(fromArrayBuffer).toBe(fromBytes);
    expect(fromTypedArrayView).toBe(fromBytes);
    expect(fromObjectSignature).toBe(fromBytes);
    expect(atob(fromBytes)).toHaveLength(64);
    expect(normalizeWalletSignatureBytes({ signature })).toEqual(signature);
  });

  it("validates required request fields, public keys, and signature length", () => {
    expect(() => validateWalletVerificationPayload({
      publicKeyBase58: "",
      currentWalletPublicKey: "",
      challengeId: "",
      signatureBase64: "",
      requestId: "",
      provider: ""
    })).toThrowError(expect.objectContaining({ code: "missing_request_field" }));

    expect(() => normalizeWalletSignature("not-a-signature")).toThrowError(
      expect.objectContaining({ code: "unsupported_provider_signature_shape" })
    );

    expect(() => normalizeWalletSignature(new Uint8Array(12))).toThrowError(
      expect.objectContaining({ code: "invalid_signature_length" })
    );

    expect(validateWalletVerificationPayload({
      publicKeyBase58: publicKey,
      currentWalletPublicKey: publicKey,
      challengeId: "00000000-0000-4000-8000-000000000001",
      signatureBase64: normalizeWalletSignature(signature),
      requestId: "request-123",
      provider: "Test Wallet"
    })).toBeTruthy();
  });

  it("decodes exact server message bytes without rebuilding the challenge text", () => {
    const message = "SolTower wallet login\nWallet: exact";
    const messageBase64 = btoa(message);
    const decoded = decodeChallengeMessageBase64(messageBase64);
    expect(new TextDecoder().decode(decoded)).toBe(message);
    expect(() => decodeChallengeMessageBase64("not-base64")).toThrowError(
      expect.objectContaining({ code: "message_bytes_mismatch" })
    );
  });

  it("reads structured Edge Function error responses without dropping the code", async () => {
    await expect(readFunctionErrorResponse(new Response(JSON.stringify({
      ok: false,
      code: "public_key_mismatch",
      message: "The connected wallet changed. Please sign again."
    })))).resolves.toEqual({
      code: "public_key_mismatch",
      message: "The connected wallet changed. Please sign again."
    });
  });

  it("uses a typed wallet auth error without carrying signature data", () => {
    const error = new WalletAuthError("invalid_signature", "Signature verification failed.");
    expect(error.code).toBe("invalid_signature");
    expect(JSON.stringify(error)).not.toContain("signatureBase64");
  });
});
