const activeWalletStorageKey = "soltower.activeWallet";

export const devMockWallet = {
  name: "DEV Mock Wallet",
  publicKey: "DevMockMarky111111111111111111111111111111111",
  signature: "DEV_MOCK_SIGNATURE"
} as const;

export function markDevWalletSession(): void {
  sessionStorage.setItem(activeWalletStorageKey, "dev-mock");
}

export async function disconnectActiveWallet(): Promise<void> {
  sessionStorage.removeItem(activeWalletStorageKey);
}

export function shortenAddress(address: string | null | undefined): string {
  if (!address) {
    return "No wallet";
  }
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
