import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("Reown AppKit Solana boundary", () => {
  it("uses the maintained AppKit packages and configures Solana mainnet only", () => {
    const packageJson = read("package.json");
    const config = read("src/lib/reown.ts");

    expect(packageJson).toContain('"@reown/appkit": "1.8.21"');
    expect(packageJson).toContain('"@reown/appkit-adapter-solana": "1.8.21"');
    expect(config).toContain("adapters: [new SolanaAdapter()]");
    expect(config).toContain("networks: [solana]");
    expect(config).not.toContain("solanaDevnet");
    expect(config).not.toContain("solanaTestnet");
    expect(config).not.toContain("mainnet,");
  });

  it("disables unrelated wallet products and documents required browser config", () => {
    const config = read("src/lib/reown.ts");
    const envExample = read(".env.example");

    expect(config).toContain("email: false");
    expect(config).toContain("socials: []");
    expect(config).toContain("swaps: false");
    expect(config).toContain("onramp: false");
    expect(envExample).toContain("VITE_REOWN_PROJECT_ID=");
    expect(envExample).toContain("VITE_APP_URL=");
  });

  it("contains no frontend transaction, approval, seed phrase, or private-key request path", () => {
    const onboarding = read("src/components/WalletOnboardingModal.tsx");
    const reown = read("src/lib/reown.ts");
    const source = `${onboarding}\n${reown}`;

    expect(source).not.toContain(".sendTransaction(");
    expect(source).not.toContain(".signTransaction(");
    expect(source).not.toContain("approveTransaction");
    expect(source).not.toContain("seedPhrase");
    expect(source).not.toContain("privateKey");
    expect(onboarding).toContain("signReownWalletMessage");
  });

  it("passes OKX's required UTF-8 encoding hint without changing other wallets", async () => {
    const { signReownWalletMessage } = await import("./reown");
    const signMessage = vi.fn().mockResolvedValue(new Uint8Array(64));
    const provider = { signMessage };
    const message = new TextEncoder().encode("SolTower wallet login");

    await signReownWalletMessage(provider as never, "OKX Wallet", message);
    expect(signMessage).toHaveBeenLastCalledWith(message, "utf8");

    await signReownWalletMessage(provider as never, "Phantom", message);
    expect(signMessage).toHaveBeenLastCalledWith(message);
  }, 15000);

  it("uses the matching official OKX injected provider so Reown cannot discard the UTF-8 hint", async () => {
    const { signReownWalletMessage } = await import("./reown");
    const address = "11111111111111111111111111111111";
    const reownSignMessage = vi.fn();
    const okxSignMessage = vi.fn().mockResolvedValue(new Uint8Array(64));
    const message = new TextEncoder().encode("SolTower wallet login");
    vi.stubGlobal("okxwallet", {
      solana: {
        publicKey: { toString: () => address },
        signMessage: okxSignMessage
      }
    });

    await signReownWalletMessage(
      { signMessage: reownSignMessage } as never,
      "OKX Wallet",
      message,
      address
    );

    expect(okxSignMessage).toHaveBeenCalledWith(message, "utf8");
    expect(reownSignMessage).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  }, 15000);
});
