import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Banknote,
  ClipboardList,
  Gavel,
  HeartPulse,
  LayoutDashboard,
  Megaphone,
  ScrollText,
  Shield,
  Swords,
  Terminal,
  UserCog,
  Users
} from "lucide-react";
import type { AdminRole, PublicPlayer } from "@soltower/shared";
import { AdminLogin } from "./components/AdminLogin";
import { DataTable } from "./components/DataTable";
import { apiGet, apiPost, idempotencyKey } from "./lib/api";
import { type AdminSection, useAdminUi } from "./store/adminUi";

interface AdminMe {
  admin: { id: string; email: string; role: AdminRole; displayName: string };
}

interface DashboardResponse {
  cards: Record<string, number>;
  charts: Record<string, Array<{ label: string; value: number }>>;
}

const navItems: Array<{ section: AdminSection; label: string; icon: JSX.Element }> = [
  { section: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { section: "players", label: "Players", icon: <Users size={18} /> },
  { section: "economy", label: "Economy", icon: <Banknote size={18} /> },
  { section: "market", label: "Market Board", icon: <ScrollText size={18} /> },
  { section: "blackjack", label: "Blackjack", icon: <Shield size={18} /> },
  { section: "raids", label: "Raids", icon: <Swords size={18} /> },
  { section: "content", label: "Content", icon: <ClipboardList size={18} /> },
  { section: "quests", label: "Quests & Events", icon: <Megaphone size={18} /> },
  { section: "chat", label: "Chat & Reports", icon: <Gavel size={18} /> },
  { section: "moderation", label: "Moderation", icon: <Gavel size={18} /> },
  { section: "announcements", label: "Announcements", icon: <Megaphone size={18} /> },
  { section: "audit", label: "Audit Logs", icon: <ScrollText size={18} /> },
  { section: "admins", label: "Admin Users", icon: <UserCog size={18} /> },
  { section: "system", label: "System Health", icon: <HeartPulse size={18} /> },
  { section: "devtools", label: "DEV Tools", icon: <Terminal size={18} /> }
];

export function App() {
  const queryClient = useQueryClient();
  const { section, setSection } = useAdminUi();
  const [loginError, setLoginError] = useState<string | null>(null);
  const me = useQuery({
    queryKey: ["admin-me"],
    queryFn: () => apiGet<AdminMe>("/api/admin/me"),
    retry: false
  });
  const login = useMutation({
    mutationFn: (values: { email: string; password: string }) => apiPost<AdminMe>("/api/admin/auth/login", values),
    onSuccess: async () => {
      setLoginError(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-me"] });
    },
    onError: (error) => {
      setLoginError(error instanceof Error ? error.message : "Login failed");
    }
  });

  if (me.isLoading) {
    return <div className="admin-loading">Loading admin console...</div>;
  }
  if (!me.data?.admin) {
    return (
      <AdminLogin
        loading={login.isPending}
        error={loginError}
        onLogin={(email, password) => login.mutateAsync({ email, password })}
      />
    );
  }

  return (
    <main className="admin-shell">
      <aside className="sidebar">
        <div className="admin-brand">
          <Activity />
          <div>
            <strong>SolTower</strong>
            <span>Admin Portal</span>
          </div>
        </div>
        <nav>
          {navItems.map((item) => (
            <button
              type="button"
              key={item.section}
              className={section === item.section ? "active" : ""}
              onClick={() => setSection(item.section)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>
      <section className="workspace">
        <header className="workspace-top">
          <div>
            <span>{me.data.admin.role}</span>
            <h1>{navItems.find((item) => item.section === section)?.label}</h1>
          </div>
          <div className="admin-session">
            {import.meta.env.VITE_APP_ENV !== "production" ? <span className="dev-mode-pill">DEV_MODE</span> : null}
            <strong>{me.data.admin.email}</strong>
          </div>
        </header>
        <AdminSectionView section={section} />
      </section>
    </main>
  );
}

function AdminSectionView({ section }: { section: AdminSection }) {
  if (section === "dashboard") {
    return <Dashboard />;
  }
  if (section === "players") {
    return <Players />;
  }
  if (section === "economy") {
    return <Economy />;
  }
  if (section === "market") {
    return <MarketAdmin />;
  }
  if (section === "blackjack") {
    return <BlackjackAdmin />;
  }
  if (section === "raids") {
    return <RaidsAdmin />;
  }
  if (section === "content") {
    return <ContentAdmin />;
  }
  if (section === "audit") {
    return <AuditLogs />;
  }
  if (section === "system") {
    return <SystemHealth />;
  }
  if (section === "devtools") {
    return <DevTools />;
  }
  return <OperationalPlaceholder section={section} />;
}

function Dashboard() {
  const dashboard = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => apiGet<DashboardResponse>("/api/admin/dashboard")
  });
  if (dashboard.isLoading) {
    return <div className="loading-card">Loading dashboard...</div>;
  }
  return (
    <div className="dashboard-grid">
      {Object.entries(dashboard.data?.cards ?? {}).map(([key, value]) => (
        <article className="metric" key={key}>
          <span>{labelize(key)}</span>
          <strong>{value}</strong>
        </article>
      ))}
      <section className="ops-panel wide">
        <h2>Database-backed Demo Charts</h2>
        <div className="chart-grid">
          {Object.entries(dashboard.data?.charts ?? {}).map(([key, rows]) => (
            <div className="chart-box" key={key}>
              <strong>{labelize(key)}</strong>
              {rows.slice(0, 8).map((row, index) => (
                <div className="bar-row" key={`${row.label}-${index}`}>
                  <span>{row.label}</span>
                  <i style={{ width: `${Math.min(100, row.value * 12)}%` }} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Players() {
  const players = useQuery({
    queryKey: ["admin-players"],
    queryFn: () => apiGet<{ players: PublicPlayer[] }>("/api/admin/players")
  });
  return (
    <DataTable
      rows={(players.data?.players ?? []) as unknown as Array<Record<string, unknown>>}
      empty="No players found."
      columns={[
        { key: "displayName", label: "Display Name" },
        { key: "walletPublicKey", label: "Wallet" },
        { key: "accountLevel", label: "Level" },
        { key: "power", label: "Power" },
        { key: "status", label: "Status" },
        { key: "presenceStatus", label: "Presence" },
        { key: "sessionStatus", label: "Session" },
        { key: "walletRiskFlag", label: "Wallet Risk" },
        { key: "marketFrozen", label: "Market Frozen" },
        { key: "blackjackFrozen", label: "Blackjack Frozen" },
        { key: "balances", label: "Balances" }
      ]}
    />
  );
}

function Economy() {
  const economy = useQuery({
    queryKey: ["admin-economy"],
    queryFn: () =>
      apiGet<{
        summary: Record<string, number>;
        ledger: Array<Record<string, unknown>>;
        configVersions: Array<Record<string, unknown>>;
      }>("/api/admin/economy")
  });
  return (
    <div className="stack">
      <section className="ops-panel">
        <h2>Gold Circulation</h2>
        <div className="metric-row">
          {Object.entries(economy.data?.summary ?? {}).map(([key, value]) => (
            <article className="metric" key={key}>
              <span>{labelize(key)}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>
      </section>
      <DataTable
        rows={economy.data?.ledger ?? []}
        empty="No ledger records yet."
        columns={[
          { key: "createdAt", label: "Time" },
          { key: "playerId", label: "Player" },
          { key: "balanceType", label: "Balance" },
          { key: "sourceType", label: "Source" },
          { key: "direction", label: "Direction" },
          { key: "amount", label: "Amount" },
          { key: "reason", label: "Reason" }
        ]}
      />
    </div>
  );
}

function MarketAdmin() {
  const market = useQuery({
    queryKey: ["admin-market"],
    queryFn: () =>
      apiGet<{
        listings: Array<Record<string, unknown>>;
        buyOrders: Array<Record<string, unknown>>;
        trades: Array<Record<string, unknown>>;
        escrow: Array<Record<string, unknown>>;
      }>("/api/admin/market")
  });
  return (
    <div className="stack">
      <DataTable
        rows={market.data?.listings ?? []}
        empty="No listings."
        columns={[
          { key: "id", label: "ID" },
          { key: "sellerPlayerId", label: "Seller" },
          { key: "goldAmount", label: "Gold" },
          { key: "totalPrice", label: "Total" },
          { key: "status", label: "Status" }
        ]}
      />
      <DataTable
        rows={market.data?.buyOrders ?? []}
        empty="No buy orders."
        columns={[
          { key: "id", label: "ID" },
          { key: "buyerPlayerId", label: "Buyer" },
          { key: "openGoldAmount", label: "Open Gold" },
          { key: "escrowRemaining", label: "Escrow" },
          { key: "status", label: "Status" }
        ]}
      />
    </div>
  );
}

function BlackjackAdmin() {
  const blackjack = useQuery({
    queryKey: ["admin-blackjack"],
    queryFn: () =>
      apiGet<{
        totalHands: number;
        hands: Array<Record<string, unknown>>;
        counters: Array<Record<string, unknown>>;
        outcomes: Record<string, number>;
      }>("/api/admin/blackjack")
  });
  return (
    <div className="stack">
      <section className="ops-panel">
        <h2>Outcomes</h2>
        <div className="metric-row">
          {Object.entries(blackjack.data?.outcomes ?? {}).map(([key, value]) => (
            <article className="metric" key={key}>
              <span>{key}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>
      </section>
      <DataTable
        rows={blackjack.data?.hands ?? []}
        empty="No Blackjack hands yet."
        columns={[
          { key: "id", label: "Hand" },
          { key: "playerId", label: "Player" },
          { key: "balanceType", label: "Gold Type" },
          { key: "totalWager", label: "Wager" },
          { key: "status", label: "Status" },
          { key: "shoeSeedHash", label: "Shuffle Hash" }
        ]}
      />
    </div>
  );
}

function RaidsAdmin() {
  const raids = useQuery({
    queryKey: ["admin-raids"],
    queryFn: () =>
      apiGet<{
        raids: Array<Record<string, unknown>>;
        lobbies: Array<Record<string, unknown>>;
        maps: Array<Record<string, unknown>>;
        heroPickRates: Array<Record<string, unknown>>;
      }>("/api/admin/raids")
  });
  return (
    <div className="stack">
      <DataTable
        rows={raids.data?.raids ?? []}
        empty="No raids completed."
        columns={[
          { key: "id", label: "Raid" },
          { key: "mapId", label: "Map" },
          { key: "success", label: "Success" },
          { key: "durationSeconds", label: "Duration" },
          { key: "createdAt", label: "Created" }
        ]}
      />
      <DataTable
        rows={raids.data?.maps ?? []}
        empty="No maps."
        columns={[
          { key: "id", label: "Map ID" },
          { key: "name", label: "Name" },
          { key: "recommendedPower", label: "Power" },
          { key: "baseGoldReward", label: "Gold Reward" }
        ]}
      />
    </div>
  );
}

function ContentAdmin() {
  const content = useQuery({
    queryKey: ["admin-content"],
    queryFn: () =>
      apiGet<{
        heroes: Array<Record<string, unknown>>;
        equipment: Array<Record<string, unknown>>;
        consumables: Array<Record<string, unknown>>;
        maps: Array<Record<string, unknown>>;
      }>("/api/admin/content")
  });
  return (
    <div className="stack">
      <DataTable
        rows={content.data?.heroes ?? []}
        empty="No heroes."
        columns={[
          { key: "id", label: "ID" },
          { key: "name", label: "Name" },
          { key: "role", label: "Role" },
          { key: "ultimate", label: "Ultimate" }
        ]}
      />
      <DataTable
        rows={content.data?.equipment ?? []}
        empty="No equipment."
        columns={[
          { key: "id", label: "ID" },
          { key: "name", label: "Name" },
          { key: "slot", label: "Slot" },
          { key: "rarity", label: "Rarity" },
          { key: "priceGold", label: "Price" }
        ]}
      />
    </div>
  );
}

function AuditLogs() {
  const audit = useQuery({
    queryKey: ["admin-audit"],
    queryFn: () => apiGet<{ audits: Array<Record<string, unknown>> }>("/api/admin/audit")
  });
  return (
    <DataTable
      rows={audit.data?.audits ?? []}
      empty="No audit records."
      columns={[
        { key: "createdAt", label: "Time" },
        { key: "actorRole", label: "Role" },
        { key: "actionType", label: "Action" },
        { key: "targetEntityType", label: "Target Type" },
        { key: "targetEntityId", label: "Target" },
        { key: "reason", label: "Reason" },
        { key: "correlationId", label: "Correlation" }
      ]}
    />
  );
}

function SystemHealth() {
  const system = useQuery({
    queryKey: ["admin-system"],
    queryFn: () => apiGet<Record<string, unknown>>("/api/admin/system")
  });
  return (
    <div className="dashboard-grid">
      {Object.entries(system.data ?? {}).map(([key, value]) => (
        <article className="metric" key={key}>
          <span>{labelize(key)}</span>
          <strong>{typeof value === "object" ? JSON.stringify(value) : String(value)}</strong>
        </article>
      ))}
    </div>
  );
}

function DevTools() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const grant = useMutation({
    mutationFn: () =>
      apiPost("/api/admin/devtools/adjust-balance", {
        playerId: "player-marky",
        balanceType: "TEST_TOKEN",
        amount: 25,
        reason: "DEV tool grant for local testing",
        idempotencyKey: idempotencyKey("admin-grant")
      }),
    onSuccess: async () => {
      setMessage("Granted 25 Test Token to Marky through ledger.");
      await queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "DEV tool failed")
  });
  const reseed = useMutation({
    mutationFn: () => apiPost("/api/admin/devtools/reseed", {}),
    onSuccess: () => setMessage("Reseed placeholder audited.")
  });
  return (
    <section className="ops-panel">
      <h2>DEV Tools</h2>
      <p>Visible and callable only in DEV_MODE. Actions still create audit records.</p>
      <div className="button-line">
        <button type="button" onClick={() => grant.mutate()}>
          Grant Test Token
        </button>
        <button type="button" onClick={() => reseed.mutate()}>
          Reseed Sample Data
        </button>
      </div>
      {message ? <span className="notice">{message}</span> : null}
    </section>
  );
}

function OperationalPlaceholder({ section }: { section: AdminSection }) {
  return (
    <section className="ops-panel">
      <h2>{labelize(section)}</h2>
      <p>
        This module is wired into the portal shell with backend role enforcement extension points. Draft, preview,
        publish, archive, filters, and audit behavior are represented in the current data model.
      </p>
      <div className="placeholder-grid">
        {["Draft", "Scheduled", "Active", "Archived"].map((state) => (
          <article className="metric" key={state}>
            <span>{state}</span>
            <strong>{state === "Active" ? 1 : 0}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

function labelize(value: string): string {
  return value.replace(/([A-Z])/g, " $1").replace(/[-_]/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}
