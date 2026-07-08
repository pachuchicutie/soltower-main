export function HowToPlay() {
  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">How to Play SolTower</h1>
        
        <div className="space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Connect Your Wallet</h2>
            <p>Click "Pre Register" and connect your Solana wallet to get started.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Pre-Register for Rewards</h2>
            <p>Secure your launch rewards:</p>
            <ul className="list-disc pl-6 mt-2">
              <li>1 Rare Weapon</li>
              <li>1 Rare Armor</li>
              <li>1 Rare Costume</li>
              <li>100 Gold</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Explore SolBloom Village</h2>
            <p>Once launched, move around the town, talk to NPCs, and prepare for tower defense.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Defend the Towers</h2>
            <p>Play with friends in co-op tower defense battles.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
