import { useEffect, useState } from "react";
import { createAppKit } from "@reown/appkit/react";
import { solana } from "@reown/appkit/networks";
import {
  SolanaAdapter,
  type Provider
} from "@reown/appkit-adapter-solana/react";
import { normalizeWalletSignatureBytes } from "./walletAuth";

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID?.trim() ?? "";
const appUrl =
  import.meta.env.VITE_APP_URL?.trim() ||
  (typeof window === "undefined" ? "https://playsoltower.fun" : window.location.origin);

export const isReownConfigured = projectId.length > 0;

export const reownAppKit = isReownConfigured
  ? createAppKit({
      adapters: [new SolanaAdapter()],
      networks: [solana],
      defaultNetwork: solana,
      defaultAccountTypes: { solana: "eoa" },
      projectId,
      metadata: {
        name: "SolTower",
        description: "Cozy Co-op Tower Defense Adventure",
        url: appUrl,
        icons: [`${appUrl.replace(/\/$/, "")}/soltower-mark.svg`]
      },
      enableNetworkSwitch: false,
      enableWalletGuide: false,
      enableMobileFullScreen: false,
      allWallets: "SHOW",
      features: {
        analytics: false,
        email: false,
        socials: [],
        swaps: false,
        onramp: false
      },
      themeMode: "dark",
      themeVariables: {
        "--apkt-accent": "#f3c969",
        "--apkt-color-mix": "#101a2a",
        "--apkt-color-mix-strength": 24,
        "--apkt-border-radius-master": "2px",
        "--apkt-font-family": "Inter, sans-serif"
      }
    })
  : null;

interface ReownWalletState {
  address: string | null;
  isConnected: boolean;
  provider: Provider | null;
  status: string;
  walletIcon: string | null;
  walletName: string;
}

const disconnectedState: ReownWalletState = {
  address: null,
  isConnected: false,
  provider: null,
  status: "disconnected",
  walletIcon: null,
  walletName: "Solana Wallet"
};

export function useReownWallet(): ReownWalletState {
  const [state, setState] = useState<ReownWalletState>(() => readWalletState());

  useEffect(() => {
    if (!reownAppKit) {
      return;
    }
    const update = () => setState(readWalletState());
    const unsubscribeAccount = reownAppKit.subscribeAccount(update, "solana");
    const unsubscribeWallet = reownAppKit.subscribeWalletInfo(update, "solana");
    const unsubscribeConnections = reownAppKit.subscribeConnections(update);
    update();
    return () => {
      unsubscribeAccount();
      unsubscribeWallet();
      unsubscribeConnections();
    };
  }, []);

  return state;
}

export async function openReownWalletPicker(): Promise<void> {
  if (!reownAppKit) {
    throw new Error("VITE_REOWN_PROJECT_ID is not configured");
  }
  await reownAppKit.open({ view: "Connect", namespace: "solana" });
}

export async function disconnectReownWallet(): Promise<void> {
  await reownAppKit?.disconnect("solana");
}

export async function signReownWalletMessage(
  provider: Provider,
  walletName: string,
  message: Uint8Array,
  expectedPublicKey?: string
): Promise<unknown> {
  return createReownWalletAdapter(provider, walletName, expectedPublicKey).signMessageBytes(message);
}

export interface NormalizedWalletProviderAdapter {
  providerId: string;
  publicKeyBase58: string | null;
  signMessageBytes(messageBytes: Uint8Array): Promise<Uint8Array>;
}

export function createReownWalletAdapter(
  provider: Provider,
  walletName: string,
  expectedPublicKey?: string
): NormalizedWalletProviderAdapter {
  return {
    providerId: walletName,
    publicKeyBase58: expectedPublicKey ?? null,
    async signMessageBytes(messageBytes: Uint8Array): Promise<Uint8Array> {
      const signature = await signProviderMessage(provider, walletName, messageBytes, expectedPublicKey);
      return normalizeWalletSignatureBytes(signature);
    }
  };
}

async function signProviderMessage(
  provider: Provider,
  walletName: string,
  message: Uint8Array,
  expectedPublicKey?: string
): Promise<unknown> {
  if (/okx/i.test(walletName)) {
    const injected = (
      globalThis as typeof globalThis & {
        okxwallet?: {
          solana?: {
            publicKey?: { toString: () => string } | string;
            signMessage?: (value: Uint8Array, encoding: "utf8") => Promise<unknown>;
          };
        };
      }
    ).okxwallet?.solana;
    const injectedPublicKey =
      typeof injected?.publicKey === "string"
        ? injected.publicKey
        : injected?.publicKey?.toString();
    if (
      injected?.signMessage &&
      expectedPublicKey &&
      (!injectedPublicKey || injectedPublicKey === expectedPublicKey)
    ) {
      return injected.signMessage(message, "utf8");
    }
    const okxSignMessage = provider.signMessage as unknown as (
      value: Uint8Array,
      encoding: "utf8"
    ) => Promise<unknown>;
    return okxSignMessage.call(provider, message, "utf8");
  }
  return provider.signMessage(message);
}

function readWalletState(): ReownWalletState {
  if (!reownAppKit) {
    return disconnectedState;
  }
  const account = reownAppKit.getAccount("solana");
  const info = reownAppKit.getWalletInfo("solana");
  if (!account) {
    return {
      ...disconnectedState,
      provider: (reownAppKit.getWalletProvider() as Provider | undefined) ?? null,
      walletIcon: info?.icon ?? null,
      walletName: info?.name ?? "Solana Wallet"
    };
  }
  return {
    address: account.address ?? null,
    isConnected: account.isConnected,
    provider: (reownAppKit.getWalletProvider() as Provider | undefined) ?? null,
    status: account.status ?? "disconnected",
    walletIcon: info?.icon ?? null,
    walletName: info?.name ?? "Solana Wallet"
  };
}
