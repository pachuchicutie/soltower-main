import bs58 from "bs58";
import { WalletAuthError } from "./api";

export interface WalletVerificationPayload {
  publicKeyBase58: string;
  currentWalletPublicKey: string;
  challengeId: string;
  signatureBase64: string;
  requestId: string;
  provider: string;
}

export function createWalletAuthRequestId(): string {
  return crypto.randomUUID();
}

export function normalizeWalletSignature(value: unknown): string {
  return bytesToBase64(normalizeWalletSignatureBytes(value));
}

export function normalizeWalletSignatureBytes(value: unknown): Uint8Array {
  const bytes = signatureBytes(value);
  if (!bytes) {
    throw new WalletAuthError(
      "unsupported_provider_signature_shape",
      "Your wallet returned an unsupported signature format. Please reconnect and try again."
    );
  }
  if (bytes.byteLength !== 64) {
    throw new WalletAuthError(
      "invalid_signature_length",
      "Your wallet returned a malformed signature. Please reconnect and try again."
    );
  }
  return bytes;
}

export function validateWalletVerificationPayload(
  payload: WalletVerificationPayload,
  allowDevWallet = false
): WalletVerificationPayload {
  const required = [
    payload.publicKeyBase58,
    payload.currentWalletPublicKey,
    payload.challengeId,
    payload.signatureBase64,
    payload.requestId,
    payload.provider
  ];
  if (required.some((value) => typeof value !== "string" || value.trim().length === 0)) {
    throw new WalletAuthError(
      "missing_request_field",
      "The wallet sign-in request was incomplete. Please reconnect and try again."
    );
  }
  if (
    payload.publicKeyBase58 !== payload.currentWalletPublicKey ||
    !isSolanaPublicKey(payload.publicKeyBase58, allowDevWallet)
  ) {
    throw new WalletAuthError(
      "public_key_mismatch",
      "The connected wallet does not match this challenge. Please sign again."
    );
  }
  const signature = base64ToBytes(payload.signatureBase64);
  if (!signature) {
    throw new WalletAuthError(
      "invalid_signature_encoding",
      "Your wallet returned an unsupported signature format. Please reconnect and try again."
    );
  }
  if (signature.byteLength !== 64) {
    throw new WalletAuthError(
      "invalid_signature_length",
      "Your wallet returned a malformed signature. Please reconnect and try again."
    );
  }
  return payload;
}

export function decodeChallengeMessageBase64(value: string): Uint8Array {
  const bytes = base64ToBytes(value);
  if (!bytes || bytes.byteLength === 0) {
    throw new WalletAuthError(
      "message_bytes_mismatch",
      "The wallet sign-in challenge was malformed. Please request a new sign-in message."
    );
  }
  return bytes;
}

function signatureBytes(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (Array.isArray(value) && value.every((entry) => Number.isInteger(entry) && entry >= 0 && entry <= 255)) {
    return Uint8Array.from(value);
  }
  if (value && typeof value === "object" && "signature" in value) {
    return signatureBytes((value as { signature: unknown }).signature);
  }
  if (typeof value !== "string") {
    return null;
  }
  try {
    const base58Bytes = bs58.decode(value);
    if (base58Bytes.byteLength === 64) {
      return base58Bytes;
    }
  } catch {
    // Some providers return canonical base64 instead of base58.
  }
  return base64ToBytes(value);
}

function isSolanaPublicKey(value: string, allowDevWallet = false): boolean {
  if (allowDevWallet && value.startsWith("DevMock")) {
    return true;
  }
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(value)) {
    return false;
  }
  try {
    return bs58.decode(value).byteLength === 32;
  } catch {
    return false;
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) {
    return null;
  }
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return bytesToBase64(bytes) === value ? bytes : null;
  } catch {
    return null;
  }
}
