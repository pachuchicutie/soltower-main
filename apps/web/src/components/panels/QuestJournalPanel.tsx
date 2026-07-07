import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, CalendarDays, CheckCircle2, Clock3, Trophy } from "lucide-react";
import { uiAssetManifest } from "@soltower/shared";
import { playUiSound } from "../../lib/audio";
import { apiGet, apiPost, idempotencyKey } from "../../lib/api";
import {
  CurrencyChip,
  EmptyState,
  GameButton,
  GameCard,
  LoadingState,
  ModalTabs
} from "../ui/GameUi";

type QuestTab = "daily" | "weekly" | "achievements";
type QuestStatus = "ACTIVE" | "COMPLETE" | "CLAIMED" | "LOCKED";

interface QuestEntry {
  assignmentId: string;
  definitionId: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  rewardEarnedGold: number;
  rewardXp: number;
  status: QuestStatus;
  resetAt?: string;
  graceUntil?: string;
}

interface AchievementEntry {
  achievementId: string;
  title: string;
  description: string;
  status: QuestStatus;
  unlockedAt: string | null;
  claimedAt: string | null;
}

interface QuestJournalResponse {
  serverTime: string;
  dailyResetAt: string;
  weeklyResetAt: string;
  daily: QuestEntry[];
  weekly: QuestEntry[];
  achievements: AchievementEntry[];
  unavailableWeekly: Array<{ id: string; title: string; reason: string }>;
}

const tabs: Array<{ id: QuestTab; label: string; iconSrc: string }> = [
  { id: "daily", label: "Daily", iconSrc: uiAssetManifest.icons.quests },
  { id: "weekly", label: "Weekly", iconSrc: uiAssetManifest.icons.timer },
  { id: "achievements", label: "Achievements", iconSrc: uiAssetManifest.icons.achievement }
];

export function QuestJournalPanel() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<QuestTab>("daily");
  const quests = useQuery({
    queryKey: ["quests"],
    queryFn: () => apiGet<QuestJournalResponse>("/api/quests")
  });
  const serverNow = useSyncedServerTime(quests.data?.serverTime);
  const claim = useMutation({
    mutationFn: (body: { assignmentId?: string; achievementId?: string }) =>
      apiPost("/api/quests/claim", {
        ...body,
        idempotencyKey: idempotencyKey("quest-claim")
      }),
    onSuccess: async () => {
      playUiSound("questClaim");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["quests"] }),
        queryClient.invalidateQueries({ queryKey: ["me"] })
      ]);
    }
  });

  if (quests.isLoading) {
    return <LoadingState>Loading Quest Journal...</LoadingState>;
  }

  const data = quests.data;
  return (
    <div className="quest-journal">
      <ModalTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} label="Quest Journal tabs" />

      <GameCard className="quest-reset-row">
        <span>
          <Clock3 size={16} /> Server UTC {formatUtc(serverNow)}
        </span>
        {activeTab === "daily" ? (
          <span>Daily reset in {formatCountdown(data?.dailyResetAt, serverNow)}</span>
        ) : null}
        {activeTab === "weekly" ? (
          <span>Weekly reset in {formatCountdown(data?.weeklyResetAt, serverNow)}</span>
        ) : null}
      </GameCard>

      {activeTab === "daily" ? (
        <QuestList
          quests={data?.daily ?? []}
          empty="No daily quests assigned yet."
          icon={<CalendarDays size={19} />}
          onClaim={(assignmentId) => claim.mutate({ assignmentId })}
          claiming={claim.isPending}
        />
      ) : null}

      {activeTab === "weekly" ? (
        <>
          <QuestList
            quests={data?.weekly ?? []}
            empty="No weekly quests are currently eligible."
            icon={<Trophy size={19} />}
            onClaim={(assignmentId) => claim.mutate({ assignmentId })}
            claiming={claim.isPending}
          />
          {data?.unavailableWeekly?.length ? (
            <div className="quest-unavailable-list">
              {data.unavailableWeekly.map((quest) => (
                <GameCard key={quest.id}>
                  <strong>{quest.title}</strong>
                  <span>{quest.reason}</span>
                </GameCard>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {activeTab === "achievements" ? (
        <section className="quest-card-grid" aria-label="Achievements">
          {(data?.achievements ?? []).map((achievement) => (
            <GameCard
              key={achievement.achievementId}
              className={`quest-card quest-card--${achievement.status.toLowerCase()}`}
            >
              <Award size={20} aria-hidden="true" />
              <div>
                <strong>{achievement.title}</strong>
                <p>{achievement.description}</p>
                <span>{achievement.status === "LOCKED" ? "Locked" : achievement.status}</span>
              </div>
              <GameButton
                variant={achievement.status === "COMPLETE" ? "primary" : "secondary"}
                disabled={achievement.status !== "COMPLETE" || claim.isPending}
                onClick={() => claim.mutate({ achievementId: achievement.achievementId })}
              >
                {achievement.status === "CLAIMED" ? "Claimed" : "Claim"}
              </GameButton>
            </GameCard>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function QuestList({
  quests,
  empty,
  icon,
  onClaim,
  claiming
}: {
  quests: QuestEntry[];
  empty: string;
  icon: JSX.Element;
  onClaim: (assignmentId: string) => void;
  claiming: boolean;
}) {
  if (!quests.length) {
    return <EmptyState title={empty} iconSrc={uiAssetManifest.icons.quests} />;
  }

  return (
    <section className="quest-card-grid" aria-label="Quest assignments">
      {quests.map((quest) => {
        const percent = Math.min(100, Math.round((quest.progress / Math.max(quest.target, 1)) * 100));
        return (
          <GameCard
            key={quest.assignmentId}
            className={`quest-card quest-card--${quest.status.toLowerCase()}`}
          >
            {icon}
            <div>
              <strong>{quest.title}</strong>
              <p>{quest.description}</p>
              <div className="quest-progress" aria-label={`${quest.progress} of ${quest.target}`}>
                <span style={{ width: `${percent}%` }} />
              </div>
              <div className="quest-reward-line">
                <small>{quest.progress}/{quest.target}</small>
                <CurrencyChip
                  iconSrc={uiAssetManifest.currencies.earnedGold}
                  label="Earned Gold"
                  value={quest.rewardEarnedGold}
                  tone="gold"
                />
                <CurrencyChip iconSrc={uiAssetManifest.icons.achievement} label="XP" value={quest.rewardXp} tone="blue" />
              </div>
            </div>
            {quest.status === "CLAIMED" ? (
              <span className="quest-claimed-badge">
                <CheckCircle2 size={16} /> Claimed
              </span>
            ) : (
              <GameButton
                variant={quest.status === "COMPLETE" ? "primary" : "secondary"}
                disabled={quest.status !== "COMPLETE" || claiming}
                onClick={() => onClaim(quest.assignmentId)}
              >
                Claim
              </GameButton>
            )}
          </GameCard>
        );
      })}
    </section>
  );
}

function useSyncedServerTime(serverTime?: string): Date {
  const [clientNow, setClientNow] = useState(() => Date.now());
  const offsetMs = useMemo(() => {
    if (!serverTime) {
      return 0;
    }
    return new Date(serverTime).getTime() - Date.now();
  }, [serverTime]);

  useEffect(() => {
    const id = window.setInterval(() => setClientNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return new Date(clientNow + offsetMs);
}

function formatUtc(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 19);
}

function formatCountdown(targetIso: string | undefined, now: Date): string {
  if (!targetIso) {
    return "unavailable";
  }
  const remaining = Math.max(0, new Date(targetIso).getTime() - now.getTime());
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  return `${hours}h ${minutes}m ${seconds}s`;
}
