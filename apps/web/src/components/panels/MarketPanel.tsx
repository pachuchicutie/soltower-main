import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { calculateMarketTax, economyConfig, uiAssetManifest, type PlayerBootstrapData } from "@soltower/shared";
import { playUiSound } from "../../lib/audio";
import { apiGet, apiPost, idempotencyKey } from "../../lib/api";
import { createBrowserSupabaseClient } from "../../lib/supabase";
import {
  CurrencyChip,
  EmptyState,
  FeedList,
  GameButton,
  GameCard,
  ModalTabs,
  StatRow
} from "../ui/GameUi";

type MarketTab = "browse" | "sell" | "auction" | "orders" | "activity" | "feed";
type FeedFilter = "all" | "listings" | "sales" | "orders" | "fills";

interface Listing {
  id: string;
  sellerPlayerId: string;
  goldAmount: number;
  pricePerGold: number;
  totalPrice: number;
  status: string;
  createdAt?: string;
}

interface BuyOrder {
  id: string;
  buyerPlayerId: string;
  goldAmount: number;
  openGoldAmount: number;
  pricePerGold: number;
  escrowRemaining: number;
  status: string;
  createdAt?: string;
}

interface MarketTrade {
  id: string;
  buyerPlayerId: string;
  sellerPlayerId: string;
  goldAmount: number;
  grossTestToken: number;
  taxTestToken: number;
  sellerNet: number;
  createdAt?: string;
}

interface MarketListingsResponse {
  listings: Listing[];
  history: MarketTrade[];
}

interface BuyOrdersResponse {
  buyOrders: BuyOrder[];
}

const tabs: Array<{ id: MarketTab; label: string; iconSrc: string }> = [
  { id: "browse", label: "Browse", iconSrc: uiAssetManifest.icons.buy },
  { id: "sell", label: "Sell Gold", iconSrc: uiAssetManifest.icons.sell },
  { id: "auction", label: "Auction House", iconSrc: uiAssetManifest.icons.market },
  { id: "orders", label: "Buy Orders", iconSrc: uiAssetManifest.icons.market },
  { id: "activity", label: "My Activity", iconSrc: uiAssetManifest.icons.history },
  { id: "feed", label: "Live Feed", iconSrc: uiAssetManifest.icons.feed }
];

const feedFilters: Array<{ id: FeedFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "listings", label: "Listings" },
  { id: "sales", label: "Sales" },
  { id: "orders", label: "Buy Orders" },
  { id: "fills", label: "Fills" }
];

export function MarketPanel() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<MarketTab>("browse");
  const [feedFilter, setFeedFilter] = useState<FeedFilter>("all");
  const [sellGold, setSellGold] = useState<number>(economyConfig.marketMinimumGoldQuantity);
  const [sellPrice, setSellPrice] = useState(2);
  const [buyOrderGold, setBuyOrderGold] = useState<number>(economyConfig.marketMinimumGoldQuantity);
  const [buyOrderPrice, setBuyOrderPrice] = useState(2);
  const isDevMode = import.meta.env.VITE_APP_ENV === "development" || import.meta.env.MODE === "test";
  const towerLabel = isDevMode ? `${economyConfig.towerToken.symbol} (DEV)` : economyConfig.towerToken.symbol;
  const me = useQuery({ queryKey: ["me"], queryFn: () => apiGet<PlayerBootstrapData>("/api/player/me") });
  const listings = useQuery({
    queryKey: ["market-listings"],
    queryFn: () => apiGet<MarketListingsResponse>("/api/market/listings")
  });
  const orders = useQuery({
    queryKey: ["buy-orders"],
    queryFn: () => apiGet<BuyOrdersResponse>("/api/market/buy-orders")
  });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["market-listings"] }),
      queryClient.invalidateQueries({ queryKey: ["buy-orders"] }),
      queryClient.invalidateQueries({ queryKey: ["me"] })
    ]);
  };

  useEffect(() => {
    const client = createBrowserSupabaseClient();
    if (!client) {
      return undefined;
    }
    const channel = client
      .channel("market-board-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "market_listings" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "buy_orders" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "market_trades" }, () => void refresh())
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, []);

  const buyListing = useMutation({
    mutationFn: (id: string) => apiPost(`/api/market/listings/${id}/buy`, { idempotencyKey: idempotencyKey("buy") }),
    onSuccess: async () => {
      playUiSound("marketSaleCompleted");
      await refresh();
    }
  });
  const createListing = useMutation({
    mutationFn: () =>
      apiPost("/api/market/listings", {
        goldAmount: sellGold,
        pricePerGold: sellPrice,
        idempotencyKey: idempotencyKey("listing")
      }),
    onSuccess: async () => {
      playUiSound("marketListingCreated");
      setActiveTab("activity");
      await refresh();
    }
  });
  const createOrder = useMutation({
    mutationFn: () =>
      apiPost("/api/market/buy-orders", {
        goldAmount: buyOrderGold,
        pricePerGold: buyOrderPrice,
        idempotencyKey: idempotencyKey("order")
      }),
    onSuccess: async () => {
      playUiSound("marketListingCreated");
      await refresh();
    }
  });
  const fillOrder = useMutation({
    mutationFn: (order: BuyOrder) =>
      apiPost(`/api/market/buy-orders/${order.id}/fill`, {
        goldAmount: Math.min(economyConfig.marketMinimumGoldQuantity, order.openGoldAmount),
        idempotencyKey: idempotencyKey("fill")
      }),
    onSuccess: async () => {
      playUiSound("marketSaleCompleted");
      await refresh();
    }
  });

  const sellPreview = calculateMarketTax(sellGold * sellPrice);
  const orderEscrow = buyOrderGold * buyOrderPrice;
  const currentPlayerId = me.data?.player.id;
  const myListings = (listings.data?.listings ?? []).filter((listing) => listing.sellerPlayerId === currentPlayerId);
  const myOrders = (orders.data?.buyOrders ?? []).filter((order) => order.buyerPlayerId === currentPlayerId);
  const myPurchases = (listings.data?.history ?? []).filter((trade) => trade.buyerPlayerId === currentPlayerId);
  const mySales = (listings.data?.history ?? []).filter((trade) => trade.sellerPlayerId === currentPlayerId);
  const myHistory = (listings.data?.history ?? []).filter(
    (trade) => trade.buyerPlayerId === currentPlayerId || trade.sellerPlayerId === currentPlayerId
  );
  const sellerGate = getSellerGate(me.data, isDevMode, economyConfig.tokenGate.sellerMinimumTower);
  const auctionGate = getSellerGate(me.data, isDevMode, economyConfig.tokenGate.auctionSellerMinimumTower);
  const feedEntries = useMemo(
    () =>
      createFeedEntries({
        listings: listings.data?.listings ?? [],
        buyOrders: orders.data?.buyOrders ?? [],
        trades: listings.data?.history ?? [],
        towerLabel,
        filter: feedFilter
      }),
    [feedFilter, listings.data?.history, listings.data?.listings, orders.data?.buyOrders, towerLabel]
  );

  return (
    <div className="market-board-v2">
      <ModalTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} label="Market Board tabs" />

      {activeTab === "browse" ? (
        <section className="market-tab-panel" aria-label="Browse listings">
          <MarketNote towerLabel={towerLabel} />
          {(listings.data?.listings ?? []).length ? (
            <div className="market-card-list">
              {(listings.data?.listings ?? []).map((listing) => (
                <GameCard key={listing.id} className="market-card">
                  <CurrencyChip iconSrc={uiAssetManifest.currencies.earnedGold} label="Earned Gold" value={listing.goldAmount} tone="gold" />
                  <div>
                    <strong>{displayName(listing.sellerPlayerId)} listed {listing.goldAmount} Gold</strong>
                    <span>{listing.pricePerGold} {towerLabel} per Gold · total {listing.totalPrice} {towerLabel}</span>
                    <small>{formatTimestamp(listing.createdAt)}</small>
                  </div>
                  <GameButton
                    variant="primary"
                    disabled={buyListing.isPending || listing.sellerPlayerId === currentPlayerId}
                    onClick={() => buyListing.mutate(listing.id)}
                  >
                    Buy
                  </GameButton>
                </GameCard>
              ))}
            </div>
          ) : (
            <EmptyState title="No active listings" iconSrc={uiAssetManifest.icons.market}>
              Player-created Earned Gold listings will appear here.
            </EmptyState>
          )}
        </section>
      ) : null}

      {activeTab === "sell" ? (
        <section className="market-tab-panel market-form-panel" aria-label="Sell Gold">
          <MarketNote towerLabel={towerLabel} />
          <MarketSellerGateCard gate={sellerGate} towerLabel={towerLabel} kind="gold" />
          <GameCard>
            <label>
              Gold amount
              <input
                type="number"
                min={economyConfig.marketMinimumGoldQuantity}
                value={sellGold}
                onChange={(event) => setSellGold(Number(event.target.value))}
              />
            </label>
            <label>
              Price per Gold
              <input
                type="number"
                min={1}
                value={sellPrice}
                onChange={(event) => setSellPrice(Number(event.target.value))}
              />
            </label>
          </GameCard>
          <PreviewGrid
            rows={[
              ["Gross total", `${sellGold * sellPrice} ${towerLabel}`],
              ["Market tax", `${sellPreview.tax} ${towerLabel}`],
              ["Seller receives", `${sellPreview.sellerReceives} ${towerLabel}`]
            ]}
          />
          <GameButton
            variant="primary"
            disabled={createListing.isPending || !sellerGate.canSell}
            onClick={() => createListing.mutate()}
          >
            Create Listing
          </GameButton>
        </section>
      ) : null}

      {activeTab === "auction" ? (
        <section className="market-tab-panel" aria-label="Auction House">
          <MarketSellerGateCard gate={auctionGate} towerLabel={towerLabel} kind="auction" />
          <GameCard className="auction-gate-preview">
            <div>
              <strong>Eligible seller access</strong>
              <span>
                Legendary and auctionable gear listings require Level {economyConfig.tokenGate.sellerMinimumAccountLevel} plus{" "}
                {economyConfig.tokenGate.auctionSellerMinimumTower.toLocaleString()} {towerLabel}. Buying auction items does not require the seller gate.
              </span>
            </div>
            <a
              className="market-gate-link"
              href={economyConfig.towerToken.jupiterSwapUrl}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={16} aria-hidden="true" />
              Get {economyConfig.towerToken.symbol}
            </a>
          </GameCard>
          <EmptyState title="No auction listings yet" iconSrc={uiAssetManifest.icons.market}>
            Player-listed rare gear, relics, charms, and full costumes will appear here.
          </EmptyState>
        </section>
      ) : null}

      {activeTab === "orders" ? (
        <section className="market-tab-panel" aria-label="Buy Orders">
          <MarketSellerGateCard gate={sellerGate} towerLabel={towerLabel} kind="gold" compact />
          <div className="market-order-grid">
            <GameCard>
              <strong>Create Buy Order</strong>
              <label>
                Requested Gold
                <input
                  type="number"
                  min={economyConfig.marketMinimumGoldQuantity}
                  value={buyOrderGold}
                  onChange={(event) => setBuyOrderGold(Number(event.target.value))}
                />
              </label>
              <label>
                Offered price
                <input
                  type="number"
                  min={1}
                  value={buyOrderPrice}
                  onChange={(event) => setBuyOrderPrice(Number(event.target.value))}
                />
              </label>
              <PreviewGrid rows={[["Escrow required", `${orderEscrow} ${towerLabel}`]]} />
              <GameButton variant="primary" disabled={createOrder.isPending} onClick={() => createOrder.mutate()}>
                Create Buy Order
              </GameButton>
            </GameCard>
            <div className="market-card-list">
              {(orders.data?.buyOrders ?? []).length ? (
                (orders.data?.buyOrders ?? []).map((order) => (
                  <GameCard key={order.id} className="market-card">
                    <CurrencyChip iconSrc={uiAssetManifest.currencies.earnedGold} label="Requested" value={order.openGoldAmount} tone="gold" />
                    <div>
                      <strong>{displayName(order.buyerPlayerId)} wants {order.openGoldAmount} Gold</strong>
                      <span>{order.pricePerGold} {towerLabel} per Gold · escrow {order.escrowRemaining} {towerLabel}</span>
                      <small>{formatTimestamp(order.createdAt)}</small>
                    </div>
                    <GameButton
                      variant="secondary"
                      disabled={fillOrder.isPending || order.buyerPlayerId === currentPlayerId || !sellerGate.canSell}
                      onClick={() => fillOrder.mutate(order)}
                    >
                      Fulfill 100
                    </GameButton>
                  </GameCard>
                ))
              ) : (
                <EmptyState title="No buy orders" iconSrc={uiAssetManifest.icons.market}>
                  Public buy orders will appear here.
                </EmptyState>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "activity" ? (
        <section className="market-tab-panel my-activity-panel" aria-label="My Activity">
          <ActivitySection title="My Listings" empty="You have no active listings." listings={myListings} towerLabel={towerLabel} />
          <ActivitySection title="My Buy Orders" empty="You have no open buy orders." orders={myOrders} towerLabel={towerLabel} />
          <ActivitySection title="My Purchases" empty="You have no purchases yet." trades={myPurchases} towerLabel={towerLabel} mode="purchase" />
          <ActivitySection title="My Sales" empty="You have no sales yet." trades={mySales} towerLabel={towerLabel} mode="sale" />
          <ActivitySection title="My History" empty="You have no market activity yet." trades={myHistory} towerLabel={towerLabel} />
        </section>
      ) : null}

      {activeTab === "feed" ? (
        <section className="market-tab-panel" aria-label="Live Feed">
          <div className="segmented" role="tablist" aria-label="Live feed filters">
            {feedFilters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={feedFilter === filter.id ? "active" : ""}
                onClick={() => setFeedFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <FeedList
            entries={feedEntries}
            empty={
              <EmptyState title="No recent trades" iconSrc={uiAssetManifest.icons.feed}>
                Realtime refresh is subscribed for market listings, buy orders, and readable trade events.
              </EmptyState>
            }
          />
        </section>
      ) : null}
    </div>
  );
}

function MarketNote({ towerLabel }: { towerLabel: string }) {
  return (
    <GameCard className="market-note">
      <CurrencyChip iconSrc={uiAssetManifest.currencies.earnedGold} label="Earned Gold is tradeable in-game Gold." tone="gold" />
      <CurrencyChip iconSrc={uiAssetManifest.currencies.lockedGold} label="Locked Gold is non-tradeable." tone="gold" />
      <CurrencyChip iconSrc={uiAssetManifest.currencies.towerToken} label={`${towerLabel} is market buying power.`} tone="blue" />
      <span>{Math.round(economyConfig.marketSellerTaxRate * 100)}% market tax is previewed before every sale.</span>
    </GameCard>
  );
}

function getSellerGate(data: PlayerBootstrapData | undefined, isDevMode: boolean, minimumTower: number) {
  const player = data?.player;
  const level = player?.accountLevel ?? 0;
  const towerBalance = player?.balances.TEST_TOKEN ?? 0;
  const levelOk = level >= economyConfig.tokenGate.sellerMinimumAccountLevel;
  const tokenOk = isDevMode || towerBalance >= minimumTower;
  return {
    canSell: levelOk && tokenOk,
    level,
    towerBalance,
    minimumTower,
    levelOk,
    tokenOk,
    isDevMode
  };
}

function MarketSellerGateCard({
  gate,
  towerLabel,
  kind,
  compact = false
}: {
  gate: ReturnType<typeof getSellerGate>;
  towerLabel: string;
  kind: "gold" | "auction";
  compact?: boolean;
}) {
  const levelRequirement = `Level ${economyConfig.tokenGate.sellerMinimumAccountLevel}`;
  const tokenRequirement = `${gate.minimumTower.toLocaleString()} ${towerLabel}`;
  const actionLabel = kind === "auction" ? "Listing auction items" : "Selling Gold";
  const heading = compact ? "Seller requirements" : kind === "auction" ? "Auction seller requirements" : "Sell Gold requirements";
  return (
    <GameCard className={`market-gate-card ${gate.canSell ? "is-ready" : "is-locked"}`}>
      <div>
        <strong>{heading}</strong>
        <span>
          {actionLabel} requires {levelRequirement} and {tokenRequirement}. Buying is open without this seller gate.
        </span>
        {gate.isDevMode ? (
          <small>DEV_MODE: token balance is shown for planning only; wallet token checks are not enforced locally.</small>
        ) : null}
        <a
          className="market-gate-link"
          href={economyConfig.towerToken.jupiterSwapUrl}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink size={15} aria-hidden="true" />
          Get {economyConfig.towerToken.symbol} on Jupiter
        </a>
      </div>
      <div className="market-gate-status">
        <span className={gate.levelOk ? "is-ok" : "is-missing"}>
          {gate.levelOk ? "Ready" : `Need ${levelRequirement}`}
        </span>
        <span className={gate.tokenOk ? "is-ok" : "is-missing"}>
          {gate.tokenOk ? `${towerLabel} ready` : `Need ${tokenRequirement}`}
        </span>
      </div>
    </GameCard>
  );
}

function PreviewGrid({ rows }: { rows: Array<[string, string | number]> }) {
  return (
    <GameCard className="preview-box">
      {rows.map(([label, value]) => (
        <StatRow key={label} label={label} value={value} />
      ))}
    </GameCard>
  );
}

function ActivitySection({
  title,
  empty,
  listings = [],
  orders = [],
  trades = [],
  towerLabel,
  mode
}: {
  title: string;
  empty: string;
  listings?: Listing[];
  orders?: BuyOrder[];
  trades?: MarketTrade[];
  towerLabel: string;
  mode?: "purchase" | "sale";
}) {
  const hasRows = listings.length > 0 || orders.length > 0 || trades.length > 0;
  return (
    <GameCard className="activity-section">
      <strong>{title}</strong>
      {hasRows ? (
        <div className="activity-list">
          {listings.map((listing) => (
            <span key={listing.id}>
              Active · {listing.goldAmount} Gold · {listing.totalPrice} {towerLabel}
            </span>
          ))}
          {orders.map((order) => (
            <span key={order.id}>
              {order.status} · {order.openGoldAmount} Gold open · escrow {order.escrowRemaining} {towerLabel}
            </span>
          ))}
          {trades.map((trade) => (
            <span key={trade.id}>
              {mode === "purchase" ? "Bought" : mode === "sale" ? "Sold" : "Trade"} · {trade.goldAmount} Gold · gross {trade.grossTestToken} {towerLabel} · tax {trade.taxTestToken}
            </span>
          ))}
        </div>
      ) : (
        <small>{empty}</small>
      )}
    </GameCard>
  );
}

function createFeedEntries({
  listings,
  buyOrders,
  trades,
  towerLabel,
  filter
}: {
  listings: Listing[];
  buyOrders: BuyOrder[];
  trades: MarketTrade[];
  towerLabel: string;
  filter: FeedFilter;
}) {
  const entries = [
    ...listings.map((listing) => ({
      id: `listing-${listing.id}`,
      type: "listings" as FeedFilter,
      iconSrc: uiAssetManifest.icons.sell,
      title: `${displayName(listing.sellerPlayerId)} listed ${listing.goldAmount} Gold`,
      detail: `${listing.totalPrice} ${towerLabel} total at ${listing.pricePerGold} each`,
      timestamp: formatTimestamp(listing.createdAt),
      sortTime: listing.createdAt ?? ""
    })),
    ...buyOrders.map((order) => ({
      id: `order-${order.id}`,
      type: "orders" as FeedFilter,
      iconSrc: uiAssetManifest.icons.market,
      title: `${displayName(order.buyerPlayerId)} created a buy order`,
      detail: `${order.openGoldAmount} Gold at ${order.pricePerGold} ${towerLabel} each`,
      timestamp: formatTimestamp(order.createdAt),
      sortTime: order.createdAt ?? ""
    })),
    ...trades.map((trade) => ({
      id: `sale-${trade.id}`,
      type: "sales" as FeedFilter,
      iconSrc: uiAssetManifest.icons.buy,
      title: `${displayName(trade.buyerPlayerId)} bought ${trade.goldAmount} Gold`,
      detail: `From ${displayName(trade.sellerPlayerId)} for ${trade.grossTestToken} ${towerLabel}`,
      timestamp: formatTimestamp(trade.createdAt),
      sortTime: trade.createdAt ?? ""
    }))
  ];
  return entries
    .filter((entry) => filter === "all" || entry.type === filter)
    .sort((a, b) => b.sortTime.localeCompare(a.sortTime))
    .map(({ sortTime: _sortTime, type: _type, ...entry }) => entry);
}

function displayName(playerId: string): string {
  return playerId.replace(/^player-/, "").replace(/^./, (letter) => letter.toUpperCase());
}

function formatTimestamp(value?: string): string {
  if (!value) {
    return "Just now";
  }
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
