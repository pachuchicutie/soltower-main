# Wallet Auth Spec

Updated: 2026-06-30

## Goal

Wallet login proves ownership of a Solana public key without requesting transactions, approvals, seed phrases, private keys, deposits, withdrawals, or real Solana transfers.

## Challenge Contract

`create-wallet-nonce` is the source of truth for sign-in bytes.

- It creates one canonical login message.
- It encodes the message to UTF-8 bytes once.
- It stores `message_base64`, `message_sha256`, `request_id`, `provider`, wallet public key, nonce, issued time, expiry time, and consumed time metadata in the private nonce table.
- It returns `challengeId`, `messageBase64`, `messageSha256`, public key metadata, expiry, and request ID to the browser.

The browser must not rebuild the sign-in message. It decodes `messageBase64` to bytes and signs those exact bytes.

## Verification Payload

The browser sends only:

```json
{
  "challengeId": "uuid",
  "publicKeyBase58": "base58 wallet public key",
  "currentWalletPublicKey": "base58 wallet public key",
  "signatureBase64": "base64 64-byte signature",
  "requestId": "client request id",
  "provider": "wallet provider name"
}
```

It does not send the challenge message string for verification.

## Provider Adapter

The frontend normalizes every wallet provider into:

```ts
interface NormalizedWalletProviderAdapter {
  providerId: string;
  publicKeyBase58: string | null;
  signMessageBytes(messageBytes: Uint8Array): Promise<Uint8Array>;
}
```

Supported signature return shapes:

- `Uint8Array`
- `ArrayBuffer`
- typed-array views
- arrays of byte values
- objects with a `signature` byte value
- documented base58/base64 encoded signature strings

Unsupported shapes fail before the Edge Function with `unsupported_provider_signature_shape`. Signatures with decoded length other than 64 bytes fail with `invalid_signature_length`. The code never `TextEncoder`s a signature.

OKX Wallet uses the official injected Solana provider when it matches the expected public key, and signs with `signMessage(messageBytes, "utf8")`. Phantom, Solflare, Backpack, WalletConnect, and generic Reown providers keep their provider-specific signing behavior but pass through the same normalization boundary.

## Server Verification

`verify-wallet-signature`:

1. Loads the challenge by `challengeId` and authenticated Supabase user.
2. Decodes stored `message_base64`.
3. Decodes `signatureBase64` once.
4. Decodes `publicKeyBase58` once.
5. Validates signature length is 64 bytes.
6. Validates public key length is 32 bytes.
7. Confirms wallet, request ID, expiry, and consumed status.
8. Verifies `tweetnacl.sign.detached.verify(storedMessageBytes, signatureBytes, publicKeyBytes)`.
9. Consumes the nonce only after successful verification.
10. Returns profile bootstrap or first-time profile creation state.

Failed verification does not create a session, profile, or player state.

## Diagnostics

Development diagnostics may include provider name, challenge ID, shortened public keys, byte lengths, stored message hash, signature encoding, verifier name, and failure code.

Diagnostics must not log raw signatures, full challenge messages, auth headers, service-role keys, private keys, seed phrases, or access tokens.

