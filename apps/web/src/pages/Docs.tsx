export function Docs() {
  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">SolTower Documentation</h1>
        
        <div className="prose prose-invert max-w-none">
          <h2>Getting Started</h2>
          <p>Welcome to SolTower! Connect your wallet to begin your adventure in SolBloom Village.</p>
          
          <h2>How to Play</h2>
          <ul>
            <li>Connect your Solana wallet</li>
            <li>Choose your hero</li>
            <li>Explore the town and interact with NPCs</li>
            <li>Defend the towers with friends</li>
          </ul>

          <h2>Launch Rewards</h2>
          <p>Wallets already on the launch list receive these rewards automatically after profile creation:</p>
          <ul>
            <li>1 Rare Weapon</li>
            <li>1 Rare Armor</li>
            <li>1 Rare Costume</li>
            <li>100 Locked Gold</li>
          </ul>

          <h2>Economy</h2>
          <p>All economy actions are server-authoritative. Gold and items are earned through gameplay.</p>

          <h2>Support</h2>
          <p>Join our Discord or Telegram for help.</p>
        </div>
      </div>
    </div>
  );
}
