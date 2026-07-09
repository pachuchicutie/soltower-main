const activeWalletStorageKey = "soltower.activeWallet";

export async function disconnectActiveWallet(): Promise<void> {
  sessionStorage.removeItem(activeWalletStorageKey);
}

export function shortenAddress(address: string | null | undefined): string {
  if (!address) {
    return "No wallet";
  }
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
