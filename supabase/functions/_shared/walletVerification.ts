export type WalletAuthFailureCode =
  | "stale_challenge"
  | "expired_nonce"
  | "consumed_nonce"
  | "wallet_changed"
  | "public_key_mismatch"
  | "message_bytes_mismatch"
  | "invalid_signature_encoding"
  | "invalid_signature_length"
  | "invalid_public_key_length"
  | "invalid_signature"
  | "unsupported_provider_signature_shape"
  | "ed25519_verifier_error"
  | "missing_request_field"
  | "duplicate_submission"
  | "unknown_verification_error";

export const walletAuthFailureMessages: Record<WalletAuthFailureCode, string> = {
  stale_challenge: "That sign-in challenge is no longer current. Please sign again.",
  expired_nonce: "That sign-in request expired. Please sign a new message.",
  consumed_nonce: "That sign-in request was already used. Please sign again.",
  wallet_changed: "The connected wallet changed. Please reconnect and sign again.",
  public_key_mismatch: "The connected wallet does not match this challenge. Please sign again.",
  message_bytes_mismatch: "The sign-in challenge bytes did not match. Please sign again.",
  invalid_signature_encoding: "Your wallet returned an unsupported signature format. Please reconnect and try again.",
  invalid_signature_length: "Your wallet returned a malformed signature. Please reconnect and try again.",
  invalid_public_key_length: "The connected wallet public key is malformed. Please reconnect and try again.",
  invalid_signature: "We could not verify that wallet signature. Please reconnect and try again.",
  unsupported_provider_signature_shape: "Your wallet returned an unsupported signature format. Please reconnect and try again.",
  ed25519_verifier_error: "We could not verify that signature. Please reconnect your wallet and try again.",
  missing_request_field: "The wallet sign-in request was incomplete. Please reconnect and try again.",
  duplicate_submission: "That signature was already submitted. Please request a new sign-in message.",
  unknown_verification_error: "We could not verify that signature. Please reconnect your wallet and try again."
};

const requiredVerificationFields = [
  "publicKeyBase58",
  "challengeId",
  "signatureBase64",
  "requestId",
  "provider"
] as const;

export function missingWalletVerificationFields(
  body: Record<string, unknown>
): string[] {
  return requiredVerificationFields.filter((field) => {
    const value = body[field];
    return typeof value !== "string" || value.trim().length === 0;
  });
}

interface WalletVerificationDecisionInput {
  requestId: string;
  submittedWalletPublicKey: string;
  currentWalletPublicKey?: string;
  challengeRequestId: string;
  challengeWalletPublicKey: string;
  expiresAt: string;
  consumedAt: string | null;
  signatureEncodingValid: boolean;
  signatureByteLength: number;
  publicKeyByteLength: number;
  signatureValid: boolean;
  now: number;
}

export function walletVerificationFailure(
  input: WalletVerificationDecisionInput
): WalletAuthFailureCode | null {
  if (input.consumedAt) {
    return input.challengeRequestId === input.requestId
      ? "duplicate_submission"
      : "consumed_nonce";
  }
  if (input.challengeRequestId !== input.requestId) {
    return "stale_challenge";
  }
  const expiresAt = Date.parse(input.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt < input.now) {
    return "expired_nonce";
  }
  if (
    input.currentWalletPublicKey &&
    input.currentWalletPublicKey !== input.submittedWalletPublicKey
  ) {
    return "wallet_changed";
  }
  if (input.challengeWalletPublicKey !== input.submittedWalletPublicKey) {
    return "public_key_mismatch";
  }
  if (!input.signatureEncodingValid) {
    return "invalid_signature_encoding";
  }
  if (input.signatureByteLength !== 64) {
    return "invalid_signature_length";
  }
  if (input.publicKeyByteLength !== 32) {
    return "invalid_public_key_length";
  }
  if (!input.signatureValid) {
    return "invalid_signature";
  }
  return null;
}

export function decodeBase64Signature(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) {
    return null;
  }
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const canonical = btoa(String.fromCharCode(...bytes));
    return canonical === value ? bytes : null;
  } catch {
    return null;
  }
}
