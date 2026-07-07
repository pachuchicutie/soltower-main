import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crown,
  LogOut,
  Lock,
  Play,
  Shield,
  ShieldCheck,
  Sparkles,
  UserX,
  Users
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getPaginatedRaidStages,
  getRaidChapterClearCount,
  getRaidStageUnlockState,
  heroDefinitions,
  raidChapters,
  raidEnemyAssets,
  type RaidChapterDefinition,
  type RaidStageDefinition
} from "@soltower/game-engine";
import {
  raidRealtimeEventSchema,
  type RaidRealtimeEvent
} from "@soltower/shared";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { apiGet, apiPost, idempotencyKey } from "../../lib/api";
import { playUiSound } from "../../lib/audio";
import { createBrowserSupabaseClient } from "../../lib/supabase";
import { HeroAppearancePreview } from "../ui/HeroAppearancePreview";
import { RaidBattleOverlay } from "./RaidBattleOverlay";

interface LobbyMember {
  playerId?: string;
  displayName: string;
  heroId: string;
  accountLevel?: number;
  power?: number;
  ready: boolean;
  host: boolean;
}

interface Lobby {
  id: string;
  mapId: string;
  lobbyType: string;
  recommendedPower: number;
  createdAt?: string;
  neededHeroIds?: string[];
  members: LobbyMember[];
}

interface LobbyResponse {
  lobbies: Lobby[];
}

interface PlayerMeResponse {
  player?: {
    id: string;
    displayName: string;
    accountLevel: number;
    power: number;
    unlockedMaps: string[];
  };
  selectedHeroId?: string;
  profile?: {
    selectedHero?: string;
  };
}

const heroNameById = new Map<string, string>(heroDefinitions.map((hero) => [hero.id, hero.name]));
const selectableRecruitHeroIds = heroDefinitions.map((hero) => hero.id);
const lobbyPageSize = 3;
type LobbySortMode = "recent" | "near-full" | "needs-my-hero";
interface ActiveRaid {
  lobby: Lobby;
  stage: RaidStageDefinition;
  startsAt: number;
}

export function RaidPanel() {
  const queryClient = useQueryClient();
  const [chapterIndex, setChapterIndex] = useState(0);
  const [stagePage, setStagePage] = useState(0);
  const [selectedStageId, setSelectedStageId] = useState(raidChapters[0].stages[0].id);
  const [wavesOpen, setWavesOpen] = useState(false);
  const [neededHeroIds, setNeededHeroIds] = useState<string[]>([]);
  const [lobbySortMode, setLobbySortMode] = useState<LobbySortMode>("recent");
  const [lobbyPage, setLobbyPage] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [activeRaid, setActiveRaid] = useState<ActiveRaid | null>(null);
  const raidChannelRef = useRef<RealtimeChannel | null>(null);
  const stagePageSize = useResponsiveStagePageSize();

  const me = useQuery({ queryKey: ["me"], queryFn: () => apiGet<PlayerMeResponse>("/api/player/me") });
  const lobbies = useQuery({
    queryKey: ["lobbies"],
    queryFn: () => apiGet<LobbyResponse>("/api/lobbies"),
    refetchInterval: 3000
  });

  const accountLevel = me.data?.player?.accountLevel ?? 1;
  const completedStageIds = useMemo(() => me.data?.player?.unlockedMaps ?? [], [me.data?.player?.unlockedMaps]);
  const selectedHeroId = me.data?.selectedHeroId ?? me.data?.profile?.selectedHero ?? "storm-archer";
  const currentPlayerId = me.data?.player?.id;
  const currentChapter = raidChapters[chapterIndex];
  const stagePageCount = Math.max(1, Math.ceil(currentChapter.stages.length / stagePageSize));
  const visibleStages = getPaginatedRaidStages(currentChapter.stages, stagePage, stagePageSize);
  const selectedStage = currentChapter.stages.find((stage) => stage.id === selectedStageId) ?? visibleStages[0] ?? currentChapter.stages[0];
  const selectedUnlock = getRaidStageUnlockState(selectedStage, accountLevel, completedStageIds);
  const validOpenLobbies = useMemo(() => (lobbies.data?.lobbies ?? []).filter(isRenderableLobby), [lobbies.data?.lobbies]);
  const openLobbiesForStage = validOpenLobbies.filter((lobby) => lobby.mapId === selectedStage.id);
  const sortedLobbiesForStage = useMemo(
    () => sortLobbies(openLobbiesForStage, lobbySortMode, selectedHeroId),
    [lobbySortMode, openLobbiesForStage, selectedHeroId]
  );
  const lobbyPageCount = Math.max(1, Math.ceil(sortedLobbiesForStage.length / lobbyPageSize));
  const visibleLobbiesForStage = sortedLobbiesForStage.slice(lobbyPage * lobbyPageSize, lobbyPage * lobbyPageSize + lobbyPageSize);
  const currentOpenLobby = currentPlayerId
    ? validOpenLobbies.find((lobby) => lobby.members.some((member) => member.playerId === currentPlayerId))
    : undefined;
  const currentOpenLobbyRef = useRef<Lobby | undefined>(currentOpenLobby);
  currentOpenLobbyRef.current = currentOpenLobby;
  const quickJoinLobby = currentOpenLobby
    ? undefined
    : openLobbiesForStage.find((lobby) => lobby.lobbyType !== "PRIVATE" && lobby.members.length < 4);
  const myHostedLobby = openLobbiesForStage.find((lobby) => lobby.members.some((member) => member.host && member.playerId === currentPlayerId));

  useEffect(() => {
    const client = createBrowserSupabaseClient();
    const lobbyId = currentOpenLobbyRef.current?.id;
    if (!client || !lobbyId) {
      raidChannelRef.current = null;
      return undefined;
    }
    const channel = client
      .channel(`raid:${lobbyId}`, {
        config: { broadcast: { ack: false, self: false } }
      })
      .on("broadcast", { event: "raid_event" }, ({ payload }) => {
        const parsed = raidRealtimeEventSchema.safeParse(payload);
        if (!parsed.success || parsed.data.kind !== "raid_start") {
          return;
        }
        const event = parsed.data;
        const lobby = currentOpenLobbyRef.current;
        const stage = raidChapters
          .flatMap((chapter) => chapter.stages)
          .find((entry) => entry.id === event.stageId);
        if (!lobby || !stage || event.lobbyId !== lobby.id) {
          return;
        }
        setActiveRaid({
          lobby,
          stage,
          startsAt: event.startsAt
        });
      })
      .subscribe();
    raidChannelRef.current = channel;
    return () => {
      raidChannelRef.current = null;
      void client.removeChannel(channel);
    };
  }, [currentOpenLobby?.id]);

  const create = useMutation({
    mutationFn: (lobbyType: "PUBLIC" | "PRIVATE") =>
      apiPost<{ lobby: Lobby }>("/api/lobbies", {
        mapId: selectedStage.id,
        lobbyType,
        recommendedPower: selectedStage.recommendedPower,
        heroId: selectedHeroId,
        neededHeroIds
      }),
    onSuccess: async () => {
      playUiSound("interactionOpen");
      setNeededHeroIds([]);
      await queryClient.invalidateQueries({ queryKey: ["lobbies"] });
    }
  });

  const quickJoin = useMutation({
    mutationFn: (lobbyId: string) => apiPost<{ lobby: Lobby }>(`/api/lobbies/${lobbyId}/join`, {}),
    onSuccess: async () => {
      playUiSound("interactionOpen");
      await queryClient.invalidateQueries({ queryKey: ["lobbies"] });
    }
  });

  const leaveLobby = useMutation({
    mutationFn: (lobbyId: string) => apiPost<{ ok: true }>(`/api/lobbies/${lobbyId}/leave`, {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["lobbies"] });
    }
  });

  const setReadyState = useMutation({
    mutationFn: ({ lobbyId, ready }: { lobbyId: string; ready: boolean }) =>
      apiPost<{ lobby: Lobby }>(`/api/lobbies/${lobbyId}/ready`, { ready }),
    onSuccess: async () => {
      playUiSound("success");
      await queryClient.invalidateQueries({ queryKey: ["lobbies"] });
    }
  });

  const kickMember = useMutation({
    mutationFn: ({ lobbyId, playerId }: { lobbyId: string; playerId: string }) =>
      apiPost<{ lobby: Lobby }>(`/api/lobbies/${lobbyId}/kick`, { playerId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["lobbies"] });
    }
  });

  const startRun = useMutation({
    mutationFn: (lobby: Lobby) =>
      apiPost("/api/raids/prototype/run", {
        lobbyId: lobby.id,
        mapId: lobby.mapId,
        idempotencyKey: idempotencyKey("raid")
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["me"] }),
        queryClient.invalidateQueries({ queryKey: ["lobbies"] })
      ]);
    },
    onError: () => {
      playUiSound("raidLose");
    }
  });

  useEffect(() => {
    setStagePage((page) => Math.min(page, stagePageCount - 1));
  }, [stagePageCount]);

  useEffect(() => {
    setLobbyPage((page) => Math.min(page, lobbyPageCount - 1));
  }, [lobbyPageCount, selectedStage.id, lobbySortMode]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const changeChapter = (direction: -1 | 1) => {
    const nextIndex = Math.min(Math.max(chapterIndex + direction, 0), raidChapters.length - 1);
    const nextChapter = raidChapters[nextIndex];
    setChapterIndex(nextIndex);
    setStagePage(0);
    setSelectedStageId(nextChapter.stages[0].id);
    setWavesOpen(false);
  };

  const changeStagePage = (direction: -1 | 1) => {
    const nextPage = Math.min(Math.max(stagePage + direction, 0), stagePageCount - 1);
    setStagePage(nextPage);
    const nextStage = getPaginatedRaidStages(currentChapter.stages, nextPage, stagePageSize)[0];
    if (nextStage) {
      setSelectedStageId(nextStage.id);
      setWavesOpen(false);
    }
  };

  const actionDisabledReason = selectedUnlock.unlocked ? null : selectedUnlock.reason ?? "Stage is locked.";

  const beginRaid = (lobby: Lobby) => {
    const stage = raidChapters
      .flatMap((chapter) => chapter.stages)
      .find((entry) => entry.id === lobby.mapId);
    if (!stage) {
      return;
    }
    const startsAt = Date.now() + 5000;
    setActiveRaid({
      lobby,
      stage,
      startsAt
    });
    const event: RaidRealtimeEvent = {
      kind: "raid_start",
      runId: crypto.randomUUID(),
      lobbyId: lobby.id,
      stageId: stage.id,
      startsAt,
      sentAt: Date.now()
    };
    void raidChannelRef.current?.send({
      type: "broadcast",
      event: "raid_event",
      payload: raidRealtimeEventSchema.parse(event)
    });
  };

  return (
    <div className="raid-board-v2" data-testid="raid-board">
      {activeRaid ? (
        <RaidBattleOverlay
          stage={activeRaid.stage}
          members={activeRaid.lobby.members.map((member, index) => ({
            playerId: member.playerId ?? `party-member-${index}`,
            displayName: member.displayName,
            heroId: member.heroId,
            power: member.power ?? activeRaid.lobby.recommendedPower
          }))}
          startsAt={activeRaid.startsAt}
          settling={startRun.isPending}
          settlementError={
            startRun.isError
              ? startRun.error instanceof Error
                ? startRun.error.message
                : "The server could not settle this raid."
              : null
          }
          onVictory={() => {
            if (!startRun.isPending && !startRun.isSuccess) {
              startRun.mutate(activeRaid.lobby);
            }
          }}
          onExit={() => {
            setActiveRaid(null);
            startRun.reset();
          }}
        />
      ) : null}
      <ChapterSelector
        chapter={currentChapter}
        chapterIndex={chapterIndex}
        accountLevel={accountLevel}
        completedStageIds={completedStageIds}
        onPrevious={() => changeChapter(-1)}
        onNext={() => changeChapter(1)}
      />

      <section className="raid-stage-selector" aria-label="Stage selector">
        <button
          className="raid-page-arrow"
          type="button"
          aria-label="Previous stage page"
          disabled={stagePage === 0}
          onClick={() => changeStagePage(-1)}
        >
          <ChevronLeft size={22} />
        </button>
        <div
          className="raid-stage-grid"
          data-testid="raid-stage-grid"
          style={{ "--raid-stage-columns": Math.max(1, visibleStages.length) } as CSSProperties}
        >
          {visibleStages.map((stage) => {
            const unlock = getRaidStageUnlockState(stage, accountLevel, completedStageIds);
            const selected = stage.id === selectedStage.id;
            return (
              <button
                className={`raid-stage-card${selected ? " selected" : ""}${unlock.unlocked ? "" : " locked"}`}
                type="button"
                key={stage.id}
                onClick={() => {
                  setSelectedStageId(stage.id);
                  setWavesOpen(false);
                }}
                aria-pressed={selected}
              >
                <img src={stage.thumbnailPath} alt={`${stage.stageNumber} ${stage.name} preview`} />
                <span className="raid-stage-card-topline">
                  <strong>{stage.stageNumber}</strong>
                  {stage.isBossStage ? (
                    <span className="raid-boss-badge">
                      <Crown size={13} /> Boss
                    </span>
                  ) : null}
                </span>
                <span className="raid-stage-name">{stage.name}</span>
                <span className="raid-stage-meta">Level {stage.recommendedAccountLevel}</span>
                <span className="raid-stage-status">
                  {unlock.completed ? (
                    <>
                      <Check size={13} /> Cleared
                    </>
                  ) : unlock.unlocked ? (
                    <>
                      <Sparkles size={13} /> Open
                    </>
                  ) : (
                    <>
                      <Lock size={13} /> Locked
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <button
          className="raid-page-arrow"
          type="button"
          aria-label="Next stage page"
          disabled={stagePage >= stagePageCount - 1}
          onClick={() => changeStagePage(1)}
        >
          <ChevronRight size={22} />
        </button>
      </section>
      <div className="raid-page-indicator" aria-label="Stage page">
        {stagePage + 1} / {stagePageCount}
      </div>

      <section className="raid-selected-stage" data-testid="raid-selected-stage">
        <div className="raid-selected-art">
          <img src={selectedStage.largePreviewPath} alt={`${selectedStage.stageNumber} ${selectedStage.name} large preview`} />
          {selectedStage.isBossStage && selectedStage.bossKey ? (
            <div className="raid-boss-portrait" data-testid="raid-boss-portrait">
              <img src={raidEnemyAssets[selectedStage.bossKey].assetPath} alt={`${selectedStage.bossName} boss portrait`} />
              <span>
                <Crown size={14} /> Boss
              </span>
            </div>
          ) : null}
        </div>
        <div className="raid-selected-copy">
          <span className="raid-eyebrow">{selectedStage.chapterName}</span>
          <h3>
            {selectedStage.stageNumber} {selectedStage.name}
          </h3>
          <div className="raid-stage-facts">
            <span>Level {selectedStage.recommendedAccountLevel}</span>
            <span>
              <Users size={14} /> {selectedStage.partySize}
            </span>
            <span>{selectedStage.estimatedDuration}</span>
          </div>
          <p>{selectedStage.objective}</p>
          <strong className={selectedUnlock.unlocked ? "raid-unlocked" : "raid-locked"}>
            {selectedUnlock.unlocked ? "Unlocked for your account" : selectedUnlock.reason}
          </strong>
          <button className="raid-wave-toggle" type="button" onClick={() => setWavesOpen((open) => !open)} aria-expanded={wavesOpen}>
            <Shield size={16} /> {wavesOpen ? "Hide Waves & Enemies" : "Show Waves & Enemies"}
          </button>
          {wavesOpen ? (
            <div className="raid-wave-list" data-testid="raid-wave-list">
              {selectedStage.waves.map((wave) => (
                <div className={`raid-wave-row${wave.boss ? " boss" : ""}`} key={`${selectedStage.id}-${wave.wave}`}>
                  <span className="raid-wave-number">{wave.wave}</span>
                  <img src={raidEnemyAssets[wave.enemyKey].assetPath} alt={`${wave.enemy} portrait`} />
                  <strong>{wave.enemy}</strong>
                  <span>x{wave.count}</span>
                  <em>{wave.modifier}</em>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <aside className="raid-selected-rewards">
          <h4>Rewards</h4>
          <div className="raid-reward-grid">
            {selectedStage.rewardPreview.map((reward) => (
              <span className="raid-reward-chip" key={`${selectedStage.id}-${reward.key}`}>
                <img src={reward.assetPath} alt={`${reward.label} icon`} />
                <span>
                  <strong>{reward.amount}</strong>
                  {reward.label}
                </span>
              </span>
            ))}
          </div>
          <h4>Enemies</h4>
          <div className="raid-enemy-preview" data-testid="raid-enemy-preview">
            {selectedStage.enemyKeys.map((enemyKey) => (
              <span key={enemyKey} className={enemyKey === selectedStage.bossKey ? "boss" : ""}>
                <img src={raidEnemyAssets[enemyKey].assetPath} alt={`${raidEnemyAssets[enemyKey].label} portrait`} />
                {raidEnemyAssets[enemyKey].label}
              </span>
            ))}
          </div>
        </aside>
        <div className="raid-recruitment-builder" aria-label="Party recruitment preferences">
          <div>
            <span className="raid-eyebrow">PARTY NEEDS</span>
            <strong>Highlight heroes you want to recruit</strong>
          </div>
          <div className="raid-needed-selector">
            {selectableRecruitHeroIds.map((heroId) => {
              const selected = neededHeroIds.includes(heroId);
              return (
                <button
                  type="button"
                  key={heroId}
                  className={selected ? "selected" : ""}
                  aria-pressed={selected}
                  onClick={() => setNeededHeroIds((current) => toggleNeededHero(current, heroId))}
                >
                  {heroNameById.get(heroId) ?? heroId}
                </button>
              );
            })}
          </div>
        </div>
        <div className="raid-actions">
          <button
            type="button"
            disabled={!selectedUnlock.unlocked || Boolean(currentOpenLobby) || create.isPending}
            onClick={() => create.mutate("PUBLIC")}
            title={currentOpenLobby ? "You are already in a party." : actionDisabledReason ?? undefined}
          >
            Create Public Lobby
          </button>
          <button
            type="button"
            disabled={!selectedUnlock.unlocked || Boolean(currentOpenLobby) || create.isPending}
            onClick={() => create.mutate("PRIVATE")}
            title={currentOpenLobby ? "You are already in a party." : actionDisabledReason ?? undefined}
          >
            Create Private Lobby
          </button>
          <button
            type="button"
            disabled={!selectedUnlock.unlocked || !quickJoinLobby || quickJoin.isPending}
            onClick={() => quickJoinLobby && quickJoin.mutate(quickJoinLobby.id)}
            title={
              !selectedUnlock.unlocked
                ? actionDisabledReason ?? undefined
                : currentOpenLobby
                  ? "You are already in a party."
                  : quickJoinLobby
                    ? undefined
                    : "No public lobby is open for this stage."
            }
          >
            Quick Join
          </button>
        </div>
        {!selectedUnlock.unlocked ? <p className="raid-action-note">{selectedUnlock.reason}</p> : null}
      </section>

      <section className="raid-lobby-board" aria-label="Open raid lobbies">
        <div className="raid-lobby-toolbar">
          <div>
            <span className="raid-eyebrow">LOBBIES</span>
            <h3>Open Parties</h3>
            <p>Parties recruit for 1 hour. Expired parties are removed before anyone can join.</p>
          </div>
          <div className="raid-lobby-sort" role="group" aria-label="Sort open parties">
            <button type="button" className={lobbySortMode === "recent" ? "active" : ""} onClick={() => changeLobbySort("recent")}>
              Most recent
            </button>
            <button type="button" className={lobbySortMode === "near-full" ? "active" : ""} onClick={() => changeLobbySort("near-full")}>
              Near full
            </button>
            <button
              type="button"
              className={lobbySortMode === "needs-my-hero" ? "active" : ""}
              onClick={() => changeLobbySort("needs-my-hero")}
            >
              Needs my hero
            </button>
          </div>
        </div>
        <div className="raid-lobby-list">
          {visibleLobbiesForStage.length > 0 ? (
            visibleLobbiesForStage.map((lobby) => (
              <LobbyCard
                key={lobby.id}
                lobby={lobby}
                stage={selectedStage}
                now={now}
                currentPlayerId={currentPlayerId}
                currentOpenLobbyId={currentOpenLobby?.id}
                canJoin={selectedUnlock.unlocked}
                onJoin={() => quickJoin.mutate(lobby.id)}
                onLeave={() => leaveLobby.mutate(lobby.id)}
                onReady={(ready) => setReadyState.mutate({ lobbyId: lobby.id, ready })}
                onKick={(playerId) => kickMember.mutate({ lobbyId: lobby.id, playerId })}
                onStart={() => {
                  beginRaid(lobby);
                }}
                joining={quickJoin.isPending}
                leaving={leaveLobby.isPending}
                readying={setReadyState.isPending}
                kicking={kickMember.isPending}
                starting={startRun.isPending}
              />
            ))
          ) : (
            <div className="raid-empty-state">
              <img src="/assets/soltower/environment/props/campfire.png" alt="" className="raid-empty-illustration" />
              <span>No open parties yet.</span>
              <small>Create a lobby and lead the first defense.</small>
            </div>
          )}
        </div>
        {sortedLobbiesForStage.length > lobbyPageSize ? (
          <div className="raid-lobby-pager" aria-label="Open parties page">
            <button type="button" disabled={lobbyPage === 0} onClick={() => setLobbyPage((page) => Math.max(0, page - 1))}>
              <ChevronLeft size={16} /> Newer
            </button>
            <span>
              Page {lobbyPage + 1} / {lobbyPageCount}
            </span>
            <button
              type="button"
              disabled={lobbyPage >= lobbyPageCount - 1}
              onClick={() => setLobbyPage((page) => Math.min(lobbyPageCount - 1, page + 1))}
            >
              Older <ChevronRight size={16} />
            </button>
          </div>
        ) : null}
        {myHostedLobby && startRun.data ? <span className="tag">Run result recorded through the server ledger.</span> : null}
      </section>
    </div>
  );

  function changeLobbySort(mode: LobbySortMode) {
    setLobbySortMode(mode);
    setLobbyPage(0);
  }
}

function ChapterSelector({
  chapter,
  chapterIndex,
  accountLevel,
  completedStageIds,
  onPrevious,
  onNext
}: {
  chapter: RaidChapterDefinition;
  chapterIndex: number;
  accountLevel: number;
  completedStageIds: string[];
  onPrevious: () => void;
  onNext: () => void;
}) {
  const cleared = getRaidChapterClearCount(chapter, completedStageIds);
  const locked = chapter.status !== "ACTIVE" || accountLevel < chapter.minAccountLevel;
  return (
    <section className={`raid-chapter-card${locked ? " locked" : ""}`}>
      <button type="button" className="raid-chapter-arrow" aria-label="Previous chapter" disabled={chapterIndex === 0} onClick={onPrevious}>
        <ChevronLeft size={20} />
      </button>
      <img src={chapter.bannerPath} alt={`${chapter.title} chapter banner`} />
      <div className="raid-chapter-copy">
        <span className="raid-eyebrow">RAIDS</span>
        <h3>{chapter.title}</h3>
        <p>{chapter.levelRange}</p>
        <strong>{cleared} / {chapter.stages.length} stages cleared</strong>
        {locked ? (
          <em>
            <Lock size={14} /> {chapter.unlockRequirement}
          </em>
        ) : null}
      </div>
      <button
        type="button"
        className="raid-chapter-arrow"
        aria-label="Next chapter"
        disabled={chapterIndex >= raidChapters.length - 1}
        onClick={onNext}
      >
        <ChevronRight size={20} />
      </button>
    </section>
  );
}

function LobbyCard({
  lobby,
  stage,
  now,
  currentPlayerId,
  currentOpenLobbyId,
  canJoin,
  onJoin,
  onLeave,
  onReady,
  onKick,
  onStart,
  joining,
  leaving,
  readying,
  kicking,
  starting
}: {
  lobby: Lobby;
  stage: RaidStageDefinition;
  now: number;
  currentPlayerId?: string;
  currentOpenLobbyId?: string;
  canJoin: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onReady: (ready: boolean) => void;
  onKick: (playerId: string) => void;
  onStart: () => void;
  joining: boolean;
  leaving: boolean;
  readying: boolean;
  kicking: boolean;
  starting: boolean;
}) {
  const host = lobby.members.find((member) => member.host);
  const isHost = lobby.members.some((member) => member.host && member.playerId === currentPlayerId);
  const currentMember = lobby.members.find((member) => member.playerId === currentPlayerId);
  const alreadyJoined = lobby.members.some((member) => member.playerId === currentPlayerId);
  const inAnotherLobby = Boolean(currentOpenLobbyId && currentOpenLobbyId !== lobby.id);
  const nonHostMembersReady = lobby.members.every((member) => member.host || member.ready);
  const canStart = isHost && lobby.members.length >= 1 && nonHostMembersReady;
  const lobbyType = lobby.lobbyType === "PRIVATE" ? "Private" : "Public";
  const hostName = safeGuardianName(host?.displayName);
  const remainingNeededHeroIds = getRemainingNeededHeroIds(lobby);
  return (
    <article className="raid-lobby-card">
      <img className="raid-lobby-stage-art" src={stage.thumbnailPath} alt={`${stage.stageNumber} ${stage.name} lobby preview`} />
      <div className="raid-lobby-main">
        <div className="raid-lobby-heading">
          <span className="raid-eyebrow">OPEN PARTY</span>
          <strong>
            {stage.stageNumber} {stage.name}
          </strong>
          <small>{stage.chapterName}</small>
        </div>
        <div className="raid-lobby-meta">
          <span className="raid-lobby-pill">{lobbyType}</span>
          <span className="raid-lobby-pill">
            <Users size={14} /> {lobby.members.length} / 4 slots
          </span>
          <span className="raid-lobby-pill">Power {lobby.recommendedPower}</span>
          <span className="raid-lobby-pill raid-lobby-expiry">Recruiting {formatLobbyTimeRemaining(lobby.createdAt, now)}</span>
        </div>
        <span className="raid-lobby-host">
          <Crown size={14} /> Host: {host ? hostName : "Recruiting"}
        </span>
        <div className="raid-needed-heroes" aria-label="Needed heroes">
          {remainingNeededHeroIds.length ? (
            remainingNeededHeroIds.map((heroId) => <span key={`${lobby.id}-need-${heroId}`}>Need {heroNameById.get(heroId) ?? heroId}</span>)
          ) : lobby.neededHeroIds?.length ? (
            <span>Requested roles filled</span>
          ) : (
            <span>Open to any hero</span>
          )}
        </div>
        {lobby.lobbyType === "PRIVATE" ? (
          <button className="raid-copy-button" type="button" onClick={() => copyInviteCode(lobby.id)}>
            <Copy size={14} /> Copy invite {shortLobbyCode(lobby.id)}
          </button>
        ) : null}
      </div>
      <div className="raid-member-list">
        {lobby.members.map((member) => {
          const displayName = safeGuardianName(member.displayName);
          const heroName = heroNameById.get(member.heroId) ?? "Guardian";
          return (
            <article className={`raid-member-card${member.host ? " host" : ""}`} key={`${lobby.id}-${member.playerId ?? displayName}`}>
              <HeroAppearancePreview heroId={member.heroId} className="mini-hero-avatar" label={`${displayName} ${heroName}`} />
              <span className="raid-member-copy">
                <strong>{displayName}</strong>
                <small>
                  {heroName} · Level {member.accountLevel ?? "-"}
                </small>
                <em>{member.power ? `${member.power} power` : "Power pending"}</em>
              </span>
              <span className={`raid-ready-pill${member.host || member.ready ? " ready" : ""}`}>
                {member.host ? "Host" : member.ready ? "Ready" : "Not ready"}
              </span>
              {isHost && !member.host && member.playerId ? (
                <button
                  className="raid-kick-button"
                  type="button"
                  aria-label={`Kick ${displayName}`}
                  disabled={kicking}
                  onClick={() => onKick(member.playerId!)}
                >
                  <UserX size={14} />
                </button>
              ) : null}
            </article>
          );
        })}
      </div>
      <div className="raid-lobby-actions">
        {alreadyJoined ? (
          <>
            {!isHost ? (
              <button type="button" disabled={readying} onClick={() => onReady(!currentMember?.ready)}>
                <ShieldCheck size={15} /> {currentMember?.ready ? "Unready" : "Ready"}
              </button>
            ) : null}
            <button
              type="button"
              className={isHost ? "raid-disband-button" : undefined}
              disabled={leaving}
              onClick={onLeave}
              title={isHost ? "Close this party for everyone." : "Leave this party."}
            >
              <LogOut size={15} /> {isHost ? "Disband Party" : "Leave Party"}
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={!canJoin || inAnotherLobby || lobby.members.length >= 4 || joining}
            onClick={onJoin}
            title={inAnotherLobby ? "Leave or disband your current party before joining another." : undefined}
          >
            <Users size={15} /> Join Party
          </button>
        )}
        <button
          type="button"
          disabled={!canStart || starting}
          onClick={onStart}
          title={!isHost ? "Only the host can start this raid." : nonHostMembersReady ? undefined : "All non-host party members must be ready."}
        >
          <Play size={15} /> Start Raid
        </button>
      </div>
    </article>
  );
}

function safeGuardianName(value?: string): string {
  if (!value || /^player[-_]/i.test(value)) {
    return "Unknown Guardian";
  }
  return value;
}

function isRenderableLobby(lobby: Lobby): boolean {
  return lobby.members.length > 0 && lobby.members.some((member) => member.host);
}

function toggleNeededHero(current: string[], heroId: string): string[] {
  if (current.includes(heroId)) {
    return current.filter((id) => id !== heroId);
  }
  return [...current, heroId].slice(0, 3);
}

function sortLobbies(lobbies: Lobby[], mode: LobbySortMode, selectedHeroId: string): Lobby[] {
  return [...lobbies].sort((left, right) => {
    if (mode === "near-full") {
      const memberDifference = right.members.length - left.members.length;
      if (memberDifference !== 0) return memberDifference;
    }
    if (mode === "needs-my-hero") {
      const leftNeedsHero = getRemainingNeededHeroIds(left).includes(selectedHeroId) ? 1 : 0;
      const rightNeedsHero = getRemainingNeededHeroIds(right).includes(selectedHeroId) ? 1 : 0;
      if (rightNeedsHero !== leftNeedsHero) return rightNeedsHero - leftNeedsHero;
    }
    return lobbyCreatedAtMs(right) - lobbyCreatedAtMs(left);
  });
}

function lobbyCreatedAtMs(lobby: Lobby): number {
  const createdAt = Date.parse(lobby.createdAt ?? "");
  return Number.isFinite(createdAt) ? createdAt : 0;
}

function getRemainingNeededHeroIds(lobby: Lobby): string[] {
  const joinedHeroIds = new Set(lobby.members.map((member) => member.heroId));
  return (lobby.neededHeroIds ?? []).filter((heroId) => !joinedHeroIds.has(heroId));
}

function formatLobbyTimeRemaining(createdAt: string | undefined, now: number): string {
  const createdAtMs = Date.parse(createdAt ?? "");
  if (!Number.isFinite(createdAtMs)) {
    return "less than 1h";
  }
  const remainingSeconds = Math.max(0, Math.ceil((createdAtMs + 60 * 60 * 1000 - now) / 1000));
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  if (minutes <= 0) {
    return `${seconds}s left`;
  }
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s left`;
}

function shortLobbyCode(lobbyId: string): string {
  return lobbyId.slice(0, 8).toUpperCase();
}

function copyInviteCode(lobbyId: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    void navigator.clipboard.writeText(lobbyId);
  }
}

function useResponsiveStagePageSize(): number {
  const [pageSize, setPageSize] = useState(() => responsiveStagePageSize());

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }
    const mobile = window.matchMedia("(max-width: 560px)");
    const compact = window.matchMedia("(max-width: 860px)");
    const update = () => setPageSize(responsiveStagePageSize());
    update();
    mobile.addEventListener("change", update);
    compact.addEventListener("change", update);
    return () => {
      mobile.removeEventListener("change", update);
      compact.removeEventListener("change", update);
    };
  }, []);

  return pageSize;
}

function responsiveStagePageSize(): number {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return 5;
  }
  if (window.matchMedia("(max-width: 560px)").matches) {
    return 1;
  }
  if (window.matchMedia("(max-width: 860px)").matches) {
    return 3;
  }
  return 5;
}
