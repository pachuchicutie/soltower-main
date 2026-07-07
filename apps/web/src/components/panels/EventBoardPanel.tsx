import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock3, Coins, Crown, Search, ShieldCheck, Sparkles, Swords, Trophy, UsersRound } from "lucide-react";
import { apiGet } from "../../lib/api";
import { HeroAppearancePreview } from "../ui/HeroAppearancePreview";

type LeaderboardPeriod = "daily" | "weekly" | "all-time";
type LeaderboardMetric = "clears" | "bosses" | "earnedGold" | "fastestSeconds";

interface LeaderboardEntry {
  playerId: string;
  displayName: string;
  heroId: string;
  accountLevel: number;
  power: number;
  clears: number;
  bosses: number;
  earnedGold: number;
  xp: number;
  fastestSeconds: number;
  latestClearAt: string;
}

interface LeaderboardResponse {
  period: LeaderboardPeriod;
  generatedAt: string;
  entries: LeaderboardEntry[];
}

const periodOptions: Array<{ id: LeaderboardPeriod; label: string }> = [
  { id: "daily", label: "Today" },
  { id: "weekly", label: "Last 7 Days" },
  { id: "all-time", label: "All Time" }
];

const metricOptions: Array<{ id: LeaderboardMetric; label: string }> = [
  { id: "clears", label: "Clears" },
  { id: "bosses", label: "Bosses" },
  { id: "earnedGold", label: "Gold" },
  { id: "fastestSeconds", label: "Fastest" }
];

export function EventBoardPanel() {
  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");
  const [metric, setMetric] = useState<LeaderboardMetric>("clears");
  const [heroFilter, setHeroFilter] = useState("all");
  const [minimumClears, setMinimumClears] = useState("0");
  const [search, setSearch] = useState("");
  const leaderboard = useQuery({
    queryKey: ["raid-leaderboard", period],
    queryFn: () =>
      apiGet<LeaderboardResponse>(
        `/api/events/leaderboard?period=${period}`
      ),
    staleTime: 30_000,
    refetchInterval: 60_000
  });

  const allEntries = leaderboard.data?.entries ?? [];
  const heroOptions = useMemo(() => {
    const heroes = new Map<string, string>();
    for (const entry of allEntries) {
      heroes.set(entry.heroId, formatHeroName(entry.heroId));
    }
    return [...heroes.entries()].sort((left, right) => left[1].localeCompare(right[1]));
  }, [allEntries]);

  const entries = useMemo(() => {
    const searchText = search.trim().toLocaleLowerCase();
    const minimum = Number(minimumClears);
    const next = allEntries.filter((entry) => {
      if (heroFilter !== "all" && entry.heroId !== heroFilter) return false;
      if (minimum > 0 && entry.clears < minimum) return false;
      if (searchText && !entry.displayName.toLocaleLowerCase().includes(searchText)) return false;
      return true;
    });
    next.sort((left, right) => {
      if (metric === "fastestSeconds") {
        const leftValue = left.fastestSeconds || Number.MAX_SAFE_INTEGER;
        const rightValue = right.fastestSeconds || Number.MAX_SAFE_INTEGER;
        return leftValue - rightValue || right.clears - left.clears;
      }
      return right[metric] - left[metric] || right.clears - left.clears;
    });
    return next.slice(0, 50);
  }, [allEntries, heroFilter, metric, minimumClears, search]);

  const summary = useMemo(() => {
    return allEntries.reduce(
      (total, entry) => ({
        guardians: total.guardians + 1,
        clears: total.clears + entry.clears,
        gold: total.gold + entry.earnedGold,
        best: entry.fastestSeconds && (!total.best || entry.fastestSeconds < total.best) ? entry.fastestSeconds : total.best
      }),
      { guardians: 0, clears: 0, gold: 0, best: 0 }
    );
  }, [allEntries]);

  return (
    <div className="event-board-panel">
      <section className="event-season-banner">
        <div>
          <span className="game-eyebrow">SOLHEART SEASON</span>
          <h3>Village Defenders</h3>
          <p>Rankings are calculated from completed server-recorded raids.</p>
        </div>
        <div className="event-season-status-grid" aria-label="Leaderboard summary">
          <SummaryChip icon={<UsersRound size={20} />} label="Ranked Guardians" value={summary.guardians.toString()} />
          <SummaryChip icon={<Swords size={20} />} label="Verified Clears" value={summary.clears.toString()} />
          <SummaryChip icon={<Coins size={20} />} label="Gold Awarded" value={summary.gold.toString()} />
          <SummaryChip icon={<Clock3 size={20} />} label="Best Clear" value={formatDuration(summary.best)} />
        </div>
      </section>

      <section className="event-leaderboard">
        <header>
          <div>
            <span className="game-eyebrow">LEADERBOARD</span>
            <h3>Top Guardians</h3>
          </div>
          <Trophy size={26} />
        </header>

        <div className="event-filter-row">
          <div className="event-filter-group">
            <span><CalendarDays size={15} /> Season Window</span>
            <div className="segmented" role="tablist" aria-label="Leaderboard period">
              {periodOptions.map((option) => (
                <button
                  type="button"
                  className={period === option.id ? "active" : ""}
                  aria-selected={period === option.id}
                  onClick={() => setPeriod(option.id)}
                  key={option.id}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="event-filter-group">
            <span><Sparkles size={15} /> Rank By</span>
            <div className="segmented event-metric-tabs" role="tablist" aria-label="Leaderboard metric">
              {metricOptions.map((option) => (
                <button
                  type="button"
                  className={metric === option.id ? "active" : ""}
                  aria-selected={metric === option.id}
                  onClick={() => setMetric(option.id)}
                  key={option.id}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <label className="event-filter-select">
            <span>Hero</span>
            <select value={heroFilter} onChange={(event) => setHeroFilter(event.target.value)}>
              <option value="all">All heroes</option>
              {heroOptions.map(([heroId, label]) => (
                <option value={heroId} key={heroId}>{label}</option>
              ))}
            </select>
          </label>
          <label className="event-filter-select">
            <span>Minimum</span>
            <select value={minimumClears} onChange={(event) => setMinimumClears(event.target.value)}>
              <option value="0">Any clears</option>
              <option value="2">2+ clears</option>
              <option value="5">5+ clears</option>
              <option value="10">10+ clears</option>
            </select>
          </label>
          <label className="event-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find guardian..."
              aria-label="Find guardian"
            />
          </label>
        </div>

        {leaderboard.isLoading ? (
          <div className="event-leaderboard-empty">
            <ShieldCheck size={34} />
            <strong>Loading verified raid records</strong>
            <span>Checking the server ledger for ranked clears.</span>
          </div>
        ) : leaderboard.isError ? (
          <div className="event-leaderboard-empty event-leaderboard-error">
            <ShieldCheck size={34} />
            <strong>Leaderboard unavailable</strong>
            <span>Raid records could not be loaded. Try opening the board again.</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="event-leaderboard-empty">
            <Trophy size={34} />
            <strong>No leaderboard yet</strong>
            <span>No verified raid clears match these filters. Clear a raid to claim the first rank.</span>
          </div>
        ) : (
          <div className="event-leaderboard-table" data-testid="event-leaderboard-table">
            <div className="event-leaderboard-head">
              <span>Rank</span>
              <span>Guardian</span>
              <span>Clears</span>
              <span>Bosses</span>
              <span>Gold</span>
              <span>Best</span>
            </div>
            {entries.map((entry, index) => (
              <article className={index < 3 ? `rank-${index + 1}` : ""} key={entry.playerId}>
                <span className="event-rank">
                  {index === 0 ? <Crown size={17} /> : null}
                  {index + 1}
                </span>
                <span className="event-guardian">
                  <HeroAppearancePreview heroId={entry.heroId} />
                  <span>
                    <strong>{entry.displayName}</strong>
                    <small>Level {entry.accountLevel} · {entry.power} power</small>
                  </span>
                </span>
                <span><Swords size={14} /> {entry.clears}</span>
                <span><Trophy size={14} /> {entry.bosses}</span>
                <span><Coins size={14} /> {entry.earnedGold}</span>
                <span><Clock3 size={14} /> {formatDuration(entry.fastestSeconds)}</span>
              </article>
            ))}
          </div>
        )}
        <footer className="event-board-footnote">
          <ShieldCheck size={15} />
          <span>
            Only server-recorded successful raids are ranked.
            {leaderboard.data?.generatedAt ? ` Updated ${formatUpdatedAt(leaderboard.data.generatedAt)}.` : ""}
          </span>
        </footer>
      </section>
    </div>
  );
}

function SummaryChip({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <span className="event-summary-chip">
      {icon}
      <span>
        <strong>{value}</strong>
        <small>{label}</small>
      </span>
    </span>
  );
}

function formatDuration(seconds: number): string {
  if (!seconds) return "--";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function formatHeroName(heroId: string): string {
  return heroId
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "just now";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
