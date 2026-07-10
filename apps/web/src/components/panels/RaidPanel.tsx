import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Bell,
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
  applyAccountXp,
  raidRealtimeEventSchema,
  type RaidRealtimeEvent
} from "@soltower/shared";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { apiGet, apiPost, idempotencyKey } from "../../lib/api";
import { playUiSound } from "../../lib/audio";
import { createBrowserSupabaseClient } from "../../lib/supabase";
import { HeroAppearancePreview } from "../ui/HeroAppearancePreview";
import { RaidBattleOverlay, type RaidBattleMember } from "./RaidBattleOverlay";

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

interface PartyNudgeToast {
  id: string;
  message: string;
  tone: "ready" | "start" | "info";
  createdAt: number;
}

const PARTY_NUDGE_COOLDOWN_MS = 10_000;

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
  const [lobbyActionError, setLobbyActionError] = useState<string | null>(null);
  const [partyNudgeToasts, setPartyNudgeToasts] = useState<PartyNudgeToast[]>([]);
  const [nudgeCooldownUntil, setNudgeCooldownUntil] = useState(0);
  const raidChannelRef = useRef<RealtimeChannel | null>(null);
  const meDisplayNameRef = useRef("Guardian");
  const stagePageSize = useResponsiveStagePageSize();

  const me = useQuery({ queryKey: ["me"], queryFn: () => apiGet<PlayerMeResponse>("/api/player/me") });
  const lobbies = useQuery({
    queryKey: ["lobbies"],
    queryFn: () => apiGet<LobbyResponse>("/api/lobbies"),
    // Short stale window so Ready/Leave can paint from cache; poll less aggressively.
    staleTime: 4_000,
    refetchOnMount: "always",
    refetchInterval: 8_000,
    retry: 1,
    enabled: Boolean(me.data?.player?.id)
  });

  const accountLevel = me.data?.player?.accountLevel ?? 1;
  const completedStageIds = useMemo(() => me.data?.player?.unlockedMaps ?? [], [me.data?.player?.unlockedMaps]);
  const selectedHeroId = me.data?.selectedHeroId ?? me.data?.profile?.selectedHero ?? "storm-archer";
  const currentPlayerId = me.data?.player?.id;
  const currentDisplayName = me.data?.player?.displayName ?? "Guardian";
  meDisplayNameRef.current = currentDisplayName;
  const nudgeCooldownRemainingMs = Math.max(0, nudgeCooldownUntil - now);
  const nudgeOnCooldown = nudgeCooldownRemainingMs > 0;
  const currentChapter = raidChapters[chapterIndex];
  const stagePageCount = Math.max(1, Math.ceil(currentChapter.stages.length / stagePageSize));
  const visibleStages = getPaginatedRaidStages(currentChapter.stages, stagePage, stagePageSize);
  const selectedStage = currentChapter.stages.find((stage) => stage.id === selectedStageId) ?? visibleStages[0] ?? currentChapter.stages[0];
  const selectedUnlock = getRaidStageUnlockState(selectedStage, accountLevel, completedStageIds);
  const stageById = useMemo(() => {
    const map = new Map<string, RaidStageDefinition>();
    for (const chapter of raidChapters) {
      for (const stage of chapter.stages) {
        map.set(stage.id, stage);
      }
    }
    return map;
  }, []);
  const validOpenLobbies = useMemo(
    () => (lobbies.data?.lobbies ?? []).filter(isRenderableLobby),
    [lobbies.data?.lobbies]
  );
  const currentOpenLobby = currentPlayerId
    ? validOpenLobbies.find((lobby) => lobby.members.some((member) => member.playerId === currentPlayerId))
    : undefined;
  // Always list every open party. Your party is forced to the top, then selected-stage parties.
  const sortedOpenLobbies = useMemo(() => {
    const myLobbies: Lobby[] = [];
    const rest: Lobby[] = [];
    for (const lobby of validOpenLobbies) {
      const isMine =
        Boolean(currentPlayerId) &&
        lobby.members.some((member) => member.playerId === currentPlayerId);
      if (isMine) {
        myLobbies.push(lobby);
      } else {
        rest.push(lobby);
      }
    }
    myLobbies.sort((left, right) => {
      const leftHost = left.members.some((member) => member.host && member.playerId === currentPlayerId)
        ? 0
        : 1;
      const rightHost = right.members.some((member) => member.host && member.playerId === currentPlayerId)
        ? 0
        : 1;
      return leftHost - rightHost;
    });
    const selected = rest.filter((lobby) => lobby.mapId === selectedStage.id);
    const others = rest.filter((lobby) => lobby.mapId !== selectedStage.id);
    return [
      ...myLobbies,
      ...sortLobbies(selected, lobbySortMode, selectedHeroId),
      ...sortLobbies(others, lobbySortMode, selectedHeroId)
    ];
  }, [currentPlayerId, lobbySortMode, selectedHeroId, selectedStage.id, validOpenLobbies]);
  const openLobbiesForStage = useMemo(
    () => validOpenLobbies.filter((lobby) => lobby.mapId === selectedStage.id),
    [selectedStage.id, validOpenLobbies]
  );
  const lobbyPageCount = Math.max(1, Math.ceil(sortedOpenLobbies.length / lobbyPageSize));
  const visibleOpenLobbies = sortedOpenLobbies.slice(
    lobbyPage * lobbyPageSize,
    lobbyPage * lobbyPageSize + lobbyPageSize
  );
  const currentOpenLobbyRef = useRef<Lobby | undefined>(currentOpenLobby);
  currentOpenLobbyRef.current = currentOpenLobby;
  const alreadyInParty = Boolean(currentOpenLobby);
  const quickJoinLobby = alreadyInParty
    ? undefined
    : openLobbiesForStage.find((lobby) => lobby.lobbyType !== "PRIVATE" && lobby.members.length < 4) ??
      validOpenLobbies.find((lobby) => lobby.lobbyType !== "PRIVATE" && lobby.members.length < 4);
  const myHostedLobby = validOpenLobbies.find((lobby) =>
    lobby.members.some((member) => member.host && member.playerId === currentPlayerId)
  );
  const activeRaidMembers = activeRaid ? getRaidBattleMembers(activeRaid.lobby, currentPlayerId) : [];
  const otherStagePartyCount = Math.max(0, validOpenLobbies.length - openLobbiesForStage.length);

  const pushPartyNudgeToast = (message: string, tone: PartyNudgeToast["tone"]) => {
    const toast: PartyNudgeToast = {
      id: crypto.randomUUID(),
      message,
      tone,
      createdAt: Date.now()
    };
    setPartyNudgeToasts((current) => [...current.slice(-4), toast]);
    window.setTimeout(() => {
      setPartyNudgeToasts((current) => current.filter((entry) => entry.id !== toast.id));
    }, 5_500);
  };

  useEffect(() => {
    const client = createBrowserSupabaseClient();
    const lobbyId = currentOpenLobbyRef.current?.id;
    if (!client || !lobbyId) {
      raidChannelRef.current = null;
      return undefined;
    }
    const channel = client
      .channel(`raid:${lobbyId}`, {
        config: { broadcast: { ack: false, self: true } }
      })
      .on("broadcast", { event: "raid_event" }, ({ payload }) => {
        const parsed = raidRealtimeEventSchema.safeParse(payload);
        if (!parsed.success) {
          return;
        }
        if (parsed.data.kind === "party_nudge") {
          const event = parsed.data;
          const lobby = currentOpenLobbyRef.current;
          if (!lobby || event.lobbyId !== lobby.id) {
            return;
          }
          // Sender already sees a local "sent" confirmation — skip echo for them.
          if (event.fromPlayerId === currentPlayerId) {
            return;
          }
          const iAmHost = lobby.members.some(
            (member) => member.host && member.playerId === currentPlayerId
          );
          // Please Ready → members. Please Start → host only.
          if (event.nudge === "please_ready" && iAmHost) {
            return;
          }
          if (event.nudge === "please_start" && !iAmHost) {
            return;
          }
          playUiSound("interactionOpen", { throttleMs: 400 });
          if (event.nudge === "please_ready") {
            pushPartyNudgeToast(
              `${event.fromDisplayName} (host): Please ready up for the raid!`,
              "ready"
            );
          } else {
            pushPartyNudgeToast(
              `${event.fromDisplayName}: Please start the raid!`,
              "start"
            );
          }
          return;
        }
        if (parsed.data.kind !== "raid_start") {
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
        // Party left open recruitment the moment the host started — drop it for members too.
        queryClient.setQueryData<LobbyResponse>(["lobbies"], (previous) => {
          if (!previous?.lobbies) {
            return previous;
          }
          return {
            ...previous,
            lobbies: previous.lobbies.filter((entry) => entry.id !== event.lobbyId)
          };
        });
        void queryClient.invalidateQueries({ queryKey: ["lobbies"] });
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
  }, [currentOpenLobby?.id, currentPlayerId, queryClient]);

  const sendPartyNudge = (lobby: Lobby, nudge: "please_ready" | "please_start") => {
    if (!currentPlayerId) {
      return;
    }
    const nowMs = Date.now();
    if (nowMs < nudgeCooldownUntil) {
      pushPartyNudgeToast(
        `Wait ${Math.ceil((nudgeCooldownUntil - nowMs) / 1000)}s before sending another alert.`,
        "info"
      );
      return;
    }
    if (!raidChannelRef.current) {
      pushPartyNudgeToast("Party channel is still connecting — try again in a moment.", "info");
      return;
    }
    const event: RaidRealtimeEvent = {
      kind: "party_nudge",
      lobbyId: lobby.id,
      fromPlayerId: currentPlayerId,
      fromDisplayName: meDisplayNameRef.current.slice(0, 24) || "Guardian",
      nudge,
      sentAt: nowMs
    };
    void raidChannelRef.current
      .send({
        type: "broadcast",
        event: "raid_event",
        payload: raidRealtimeEventSchema.parse(event)
      })
      .then(() => {
        setNudgeCooldownUntil(nowMs + PARTY_NUDGE_COOLDOWN_MS);
        playUiSound("interactionOpen", { throttleMs: 300 });
        if (nudge === "please_ready") {
          pushPartyNudgeToast(
            "Sent! Members got a “Please Ready” alert.",
            "info"
          );
        } else {
          pushPartyNudgeToast(
            "Sent! Host got a “Please Start” alert.",
            "info"
          );
        }
      })
      .catch(() => {
        pushPartyNudgeToast("Could not send party alert. Try again.", "info");
      });
  };

  const create = useMutation({
    mutationFn: (lobbyType: "PUBLIC" | "PRIVATE") => {
      if (alreadyInParty) {
        return Promise.reject(new Error("You are already in a party. Leave or disband it first."));
      }
      return apiPost<{ lobby: Lobby }>("/api/lobbies", {
        mapId: selectedStage.id,
        lobbyType,
        recommendedPower: selectedStage.recommendedPower,
        heroId: selectedHeroId,
        neededHeroIds
      });
    },
    onSuccess: async (data) => {
      playUiSound("interactionOpen");
      setNeededHeroIds([]);
      setLobbyActionError(null);
      // Put the new party in cache immediately so create stays blocked and the card is first.
      if (data.lobby) {
        queryClient.setQueryData<LobbyResponse>(["lobbies"], (previous) => {
          const existing = previous?.lobbies ?? [];
          const without = existing.filter((entry) => entry.id !== data.lobby.id);
          return { lobbies: [data.lobby, ...without] };
        });
      }
      softRefreshLobbies();
    },
    onError: (error) => {
      setLobbyActionError(error instanceof Error ? error.message : "Could not create party.");
    }
  });

  const patchLobbyInCache = (lobby: Lobby) => {
    queryClient.setQueryData<LobbyResponse>(["lobbies"], (previous) => {
      const existing = previous?.lobbies ?? [];
      const without = existing.filter((entry) => entry.id !== lobby.id);
      return { lobbies: [lobby, ...without] };
    });
  };

  const removeLobbyFromCache = (lobbyId: string) => {
    queryClient.setQueryData<LobbyResponse>(["lobbies"], (previous) => {
      if (!previous?.lobbies) {
        return previous;
      }
      return { ...previous, lobbies: previous.lobbies.filter((entry) => entry.id !== lobbyId) };
    });
  };

  const softRefreshLobbies = () => {
    // Background only — never block the Ready/Leave button on a full list reload.
    void queryClient.invalidateQueries({ queryKey: ["lobbies"] });
  };

  const quickJoin = useMutation({
    mutationFn: (lobbyId: string) => apiPost<{ lobby: Lobby }>(`/api/lobbies/${lobbyId}/join`, {}),
    onSuccess: (data) => {
      playUiSound("interactionOpen");
      if (data.lobby) {
        patchLobbyInCache(data.lobby);
      }
      softRefreshLobbies();
    }
  });

  const leaveLobby = useMutation({
    mutationFn: (lobbyId: string) => apiPost<{ ok: true; disbanded?: boolean }>(`/api/lobbies/${lobbyId}/leave`, {}),
    onMutate: async (lobbyId) => {
      // Instant UI: drop membership / party card before the network returns.
      const previous = queryClient.getQueryData<LobbyResponse>(["lobbies"]);
      if (!previous?.lobbies || !currentPlayerId) {
        return { previous };
      }
      const nextLobbies = previous.lobbies
        .map((lobby) => {
          if (lobby.id !== lobbyId) {
            return lobby;
          }
          const meMember = lobby.members.find((member) => member.playerId === currentPlayerId);
          if (meMember?.host) {
            return null;
          }
          return {
            ...lobby,
            members: lobby.members.filter((member) => member.playerId !== currentPlayerId)
          };
        })
        .filter((lobby): lobby is Lobby => Boolean(lobby && lobby.members.length > 0));
      queryClient.setQueryData<LobbyResponse>(["lobbies"], { lobbies: nextLobbies });
      return { previous };
    },
    onError: (_error, _lobbyId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["lobbies"], context.previous);
      }
    },
    onSuccess: (data, lobbyId) => {
      if (data.disbanded) {
        removeLobbyFromCache(lobbyId);
      }
      softRefreshLobbies();
    }
  });

  const setReadyState = useMutation({
    mutationFn: ({ lobbyId, ready }: { lobbyId: string; ready: boolean }) =>
      apiPost<{ lobby: Lobby }>(`/api/lobbies/${lobbyId}/ready`, { ready }),
    onMutate: async ({ lobbyId, ready }) => {
      const previous = queryClient.getQueryData<LobbyResponse>(["lobbies"]);
      if (!previous?.lobbies || !currentPlayerId) {
        return { previous };
      }
      queryClient.setQueryData<LobbyResponse>(["lobbies"], {
        lobbies: previous.lobbies.map((lobby) => {
          if (lobby.id !== lobbyId) {
            return lobby;
          }
          return {
            ...lobby,
            members: lobby.members.map((member) =>
              member.playerId === currentPlayerId ? { ...member, ready } : member
            )
          };
        })
      });
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["lobbies"], context.previous);
      }
    },
    onSuccess: (data) => {
      playUiSound("success");
      if (data.lobby) {
        patchLobbyInCache(data.lobby);
      }
      softRefreshLobbies();
    }
  });

  const kickMember = useMutation({
    mutationFn: ({ lobbyId, playerId }: { lobbyId: string; playerId: string }) =>
      apiPost<{ lobby: Lobby }>(`/api/lobbies/${lobbyId}/kick`, { playerId }),
    onSuccess: (data) => {
      if (data.lobby) {
        patchLobbyInCache(data.lobby);
      }
      softRefreshLobbies();
    }
  });

  const startRun = useMutation({
    mutationFn: (lobby: Lobby) =>
      apiPost<{
        raid?: {
          rewardEarnedGold?: number;
          rewardXp?: number;
          mapId?: string;
        };
      }>("/api/raids/prototype/run", {
        lobbyId: lobby.id,
        mapId: lobby.mapId,
        phase: "settle",
        idempotencyKey: idempotencyKey("raid")
      }),
    onSuccess: (data) => {
      playUiSound("success");
      // End "Securing server rewards" as soon as settle returns — refresh HUD in the background.
      if (data.raid) {
        queryClient.setQueryData(["me"], (previous: unknown) => {
          if (!previous || typeof previous !== "object") {
            return previous;
          }
          const prev = previous as {
            player?: { xp?: number; balances?: { EARNED_GOLD?: number }; accountLevel?: number };
            profile?: { xp?: number; balances?: { EARNED_GOLD?: number }; accountLevel?: number };
          };
          const rewardXp = typeof data.raid?.rewardXp === "number" ? data.raid.rewardXp : 0;
          const rewardGold =
            typeof data.raid?.rewardEarnedGold === "number" ? data.raid.rewardEarnedGold : 0;
          if (!prev.player) {
            return previous;
          }
          // Apply the shared XP curve so Level ticks up immediately (not just the XP bar).
          const progressed = applyAccountXp(
            prev.player.accountLevel ?? 1,
            prev.player.xp ?? 0,
            rewardXp
          );
          const nextGold = (prev.player.balances?.EARNED_GOLD ?? 0) + rewardGold;
          return {
            ...prev,
            player: {
              ...prev.player,
              accountLevel: progressed.accountLevel,
              xp: progressed.xp,
              balances: {
                ...prev.player.balances,
                EARNED_GOLD: nextGold
              }
            },
            profile: prev.profile
              ? {
                  ...prev.profile,
                  accountLevel: progressed.accountLevel,
                  xp: progressed.xp,
                  balances: {
                    ...prev.profile.balances,
                    EARNED_GOLD: nextGold
                  }
                }
              : prev.profile
          };
        });
      }
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      void queryClient.invalidateQueries({ queryKey: ["lobbies"] });
      void queryClient.invalidateQueries({ queryKey: ["quests"] });
    },
    onError: (error) => {
      playUiSound("raidLose");
      setLobbyActionError(
        error instanceof Error
          ? error.message
          : "Could not secure raid rewards. Try Return and claim again if needed."
      );
    }
  });

  /** Locks the party server-side so it disappears from Open Parties as soon as the run begins. */
  const beginLobbyRaid = useMutation({
    mutationFn: (lobby: Lobby) =>
      apiPost<{ started: boolean }>("/api/raids/prototype/begin", {
        lobbyId: lobby.id,
        mapId: lobby.mapId,
        phase: "begin",
        idempotencyKey: idempotencyKey("raid-begin")
      }),
    onSuccess: (_data, lobby) => {
      // Drop immediately from the local open list (don't wait for refetch).
      removeLobbyFromCache(lobby.id);
      softRefreshLobbies();
      beginRaid(lobby);
    },
    onError: (error) => {
      playUiSound("raidLose");
      setLobbyActionError(error instanceof Error ? error.message : "Could not start the raid party.");
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
      {partyNudgeToasts.length > 0 ? (
        <div className="raid-party-toast-stack" aria-live="polite" aria-atomic="false">
          {partyNudgeToasts.map((toast) => (
            <div key={toast.id} className={`raid-party-toast raid-party-toast-${toast.tone}`} role="status">
              <Bell size={16} aria-hidden="true" />
              <span>{toast.message}</span>
            </div>
          ))}
        </div>
      ) : null}
      {activeRaid ? (
        <RaidBattleOverlay
          stage={activeRaid.stage}
          members={activeRaidMembers}
          startsAt={activeRaid.startsAt}
          settling={startRun.isPending}
          settlementRewards={
            startRun.data?.raid
              ? {
                  rewardEarnedGold: startRun.data.raid.rewardEarnedGold,
                  rewardXp: startRun.data.raid.rewardXp
                }
              : null
          }
          settlementError={
            startRun.isError
              ? startRun.error instanceof Error
                ? startRun.error.message
                : "The server could not settle this raid."
              : null
          }
          onVictory={() => {
            // Skip if already settling/succeeded; allow retry when last settle failed.
            if (startRun.isPending || startRun.isSuccess) {
              return;
            }
            startRun.mutate(activeRaid.lobby);
          }}
          onExit={() => {
            setActiveRaid(null);
            setLobbyActionError(null);
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
            disabled={!selectedUnlock.unlocked || alreadyInParty || create.isPending}
            onClick={() => {
              setLobbyActionError(null);
              create.mutate("PUBLIC");
            }}
            title={
              alreadyInParty
                ? "You already have a party. Leave or disband it before creating another."
                : actionDisabledReason ?? undefined
            }
          >
            Create Public Lobby
          </button>
          <button
            type="button"
            disabled={!selectedUnlock.unlocked || alreadyInParty || create.isPending}
            onClick={() => {
              setLobbyActionError(null);
              create.mutate("PRIVATE");
            }}
            title={
              alreadyInParty
                ? "You already have a party. Leave or disband it before creating another."
                : actionDisabledReason ?? undefined
            }
          >
            Create Private Lobby
          </button>
          <button
            type="button"
            disabled={!selectedUnlock.unlocked || !quickJoinLobby || alreadyInParty || quickJoin.isPending}
            onClick={() => quickJoinLobby && quickJoin.mutate(quickJoinLobby.id)}
            title={
              !selectedUnlock.unlocked
                ? actionDisabledReason ?? undefined
                : alreadyInParty
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
        {alreadyInParty ? (
          <p className="raid-action-note" data-testid="already-in-party-note">
            {myHostedLobby
              ? "You are hosting a party — create is locked until you disband or start the raid."
              : "You are already in a party — leave it before creating or joining another."}
          </p>
        ) : null}
      </section>

      <section className="raid-lobby-board" aria-label="Open raid lobbies">
        <div className="raid-lobby-toolbar">
          <div>
            <span className="raid-eyebrow">LOBBIES</span>
            <h3>Open Parties</h3>
            <p>
              {validOpenLobbies.length > 0
                ? `${validOpenLobbies.length} open ${validOpenLobbies.length === 1 ? "party" : "parties"} live now${
                    otherStagePartyCount > 0
                      ? ` · ${openLobbiesForStage.length} on this stage, ${otherStagePartyCount} on other stages`
                      : " · parties recruit for 1 hour"
                  }.`
                : "Parties recruit for 1 hour. Expired parties are removed before anyone can join."}
            </p>
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
          {lobbies.isLoading || (lobbies.isFetching && !lobbies.data) ? (
            <div className="raid-empty-state">
              <span>Loading open parties...</span>
              <small>Fetching live recruitment from SolBloom.</small>
            </div>
          ) : lobbies.isError ? (
            <div className="raid-empty-state">
              <span>Could not load parties.</span>
              <small>{lobbies.error instanceof Error ? lobbies.error.message : "Retrying shortly."}</small>
              <button type="button" className="raid-copy-button" onClick={() => void lobbies.refetch()}>
                Retry
              </button>
            </div>
          ) : visibleOpenLobbies.length > 0 ? (
            visibleOpenLobbies.map((lobby) => {
              const lobbyStage = stageById.get(lobby.mapId) ?? selectedStage;
              const onSelectedStage = lobby.mapId === selectedStage.id;
              return (
                <LobbyCard
                  key={lobby.id}
                  lobby={lobby}
                  stage={lobbyStage}
                  now={now}
                  currentPlayerId={currentPlayerId}
                  currentOpenLobbyId={currentOpenLobby?.id}
                  canJoin={
                    onSelectedStage
                      ? selectedUnlock.unlocked
                      : getRaidStageUnlockState(lobbyStage, accountLevel, completedStageIds).unlocked
                  }
                  onJoin={() => {
                    if (alreadyInParty) {
                      setLobbyActionError("You are already in a party. Leave or disband it first.");
                      return;
                    }
                    quickJoin.mutate(lobby.id);
                  }}
                  onLeave={() => leaveLobby.mutate(lobby.id)}
                  onReady={(ready) => setReadyState.mutate({ lobbyId: lobby.id, ready })}
                  onKick={(playerId) => kickMember.mutate({ lobbyId: lobby.id, playerId })}
                  onStart={() => {
                    setLobbyActionError(null);
                    beginLobbyRaid.mutate(lobby);
                  }}
                  onNudgeReady={() => sendPartyNudge(lobby, "please_ready")}
                  onNudgeStart={() => sendPartyNudge(lobby, "please_start")}
                  nudgeOnCooldown={nudgeOnCooldown}
                  nudgeCooldownSeconds={Math.ceil(nudgeCooldownRemainingMs / 1000)}
                  joining={quickJoin.isPending}
                  leaving={leaveLobby.isPending}
                  readying={setReadyState.isPending}
                  kicking={kickMember.isPending}
                  starting={beginLobbyRaid.isPending || startRun.isPending}
                />
              );
            })
          ) : (
            <div className="raid-empty-state">
              <img src="/assets/soltower/environment/props/campfire.png" alt="" className="raid-empty-illustration" />
              <span>No open parties yet.</span>
              <small>Create a lobby and lead the first defense. Parties from every stage appear here automatically.</small>
            </div>
          )}
        </div>
        {lobbyActionError ? <p className="raid-action-note">{lobbyActionError}</p> : null}
        {sortedOpenLobbies.length > lobbyPageSize ? (
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
  onNudgeReady,
  onNudgeStart,
  nudgeOnCooldown,
  nudgeCooldownSeconds,
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
  onNudgeReady: () => void;
  onNudgeStart: () => void;
  nudgeOnCooldown: boolean;
  nudgeCooldownSeconds: number;
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
  const someoneNotReady = lobby.members.some((member) => !member.host && !member.ready);
  const canStart = isHost && lobby.members.length >= 1 && nonHostMembersReady;
  // Host only: ping members to ready. Members only: ping host to start.
  const canNudgeReady = alreadyJoined && isHost && someoneNotReady;
  const canNudgeStart = alreadyJoined && !isHost;
  const lobbyType = lobby.lobbyType === "PRIVATE" ? "Private" : "Public";
  const hostName = safeGuardianName(host?.displayName, host?.playerId);
  const remainingNeededHeroIds = getRemainingNeededHeroIds(lobby);
  const ownershipLabel = isHost ? "Your Party · Hosting" : alreadyJoined ? "Your Party · Joined" : null;
  return (
    <article
      className={`raid-lobby-card${alreadyJoined ? " is-yours" : ""}${isHost ? " is-hosting" : ""}`}
      data-testid={alreadyJoined ? "my-raid-lobby-card" : undefined}
      aria-label={
        ownershipLabel
          ? `${ownershipLabel}: ${stage.stageNumber} ${stage.name}`
          : `${stage.stageNumber} ${stage.name} open party`
      }
    >
      <img className="raid-lobby-stage-art" src={stage.thumbnailPath} alt={`${stage.stageNumber} ${stage.name} lobby preview`} />
      <div className="raid-lobby-main">
        <div className="raid-lobby-heading">
          <span className="raid-eyebrow">{alreadyJoined ? (isHost ? "YOUR PARTY" : "JOINED PARTY") : "OPEN PARTY"}</span>
          <strong>
            {stage.stageNumber} {stage.name}
          </strong>
          <small>{stage.chapterName}</small>
        </div>
        <div className="raid-lobby-meta">
          {ownershipLabel ? (
            <span className="raid-lobby-pill raid-lobby-yours-pill">
              <Crown size={14} /> {isHost ? "You host this" : "You're in this"}
            </span>
          ) : null}
          <span className="raid-lobby-pill">{lobbyType}</span>
          <span className="raid-lobby-pill">
            <Users size={14} /> {lobby.members.length} / 4 slots
          </span>
          <span className="raid-lobby-pill">Power {lobby.recommendedPower}</span>
          <span className="raid-lobby-pill raid-lobby-expiry">Recruiting {formatLobbyTimeRemaining(lobby.createdAt, now)}</span>
        </div>
        <span className="raid-lobby-host">
          <Crown size={14} /> Host: {host ? hostName : "Recruiting"}
          {isHost ? " (you)" : ""}
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
          const displayName = safeGuardianName(member.displayName, member.playerId);
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
            {canNudgeReady ? (
              <button
                type="button"
                className="raid-nudge-button"
                disabled={nudgeOnCooldown}
                onClick={onNudgeReady}
                title={
                  nudgeOnCooldown
                    ? `Wait ${nudgeCooldownSeconds}s before sending another alert.`
                    : "Host only — send a ready-up alert to all members."
                }
              >
                <Bell size={15} />{" "}
                {nudgeOnCooldown ? `Ready ping (${nudgeCooldownSeconds}s)` : "Please Ready"}
              </button>
            ) : null}
            {canNudgeStart ? (
              <button
                type="button"
                className="raid-nudge-button"
                disabled={nudgeOnCooldown}
                onClick={onNudgeStart}
                title={
                  nudgeOnCooldown
                    ? `Wait ${nudgeCooldownSeconds}s before sending another alert.`
                    : "Members only — ask the host to start the raid."
                }
              >
                <Bell size={15} />{" "}
                {nudgeOnCooldown ? `Start ping (${nudgeCooldownSeconds}s)` : "Please Start"}
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

function safeGuardianName(value?: string, playerId?: string): string {
  if (value && !/^player[-_]/i.test(value)) {
    return value;
  }
  if (playerId && !/^player[-_]/i.test(playerId)) {
    return playerId;
  }
  return "Guardian";
}

function getRaidBattleMembers(lobby: Lobby, currentPlayerId?: string): RaidBattleMember[] {
  const membersByPlayerId = new Map<string, RaidBattleMember>();
  for (const member of lobby.members) {
    if (!member.playerId) {
      continue;
    }
    const displayName = safeGuardianName(member.displayName, member.playerId);
    const battleMember = {
      playerId: member.playerId,
      displayName,
      heroId: member.heroId,
      power: member.power ?? lobby.recommendedPower
    };
    const existing = membersByPlayerId.get(member.playerId);
    // Prefer the current local player entry / better labels if duplicates ever appear.
    if (!existing || member.playerId === currentPlayerId) {
      membersByPlayerId.set(member.playerId, battleMember);
    }
  }
  const battleMembers = Array.from(membersByPlayerId.values());
  if (battleMembers.length > 0) {
    return battleMembers.slice(0, 4);
  }
  const fallbackMember =
    lobby.members.find((member) => member.host && member.playerId) ??
    lobby.members.find((member) => member.playerId);
  if (!fallbackMember?.playerId) {
    return [];
  }
  return [
    {
      playerId: fallbackMember.playerId,
      displayName: safeGuardianName(fallbackMember.displayName, fallbackMember.playerId),
      heroId: fallbackMember.heroId,
      power: fallbackMember.power ?? lobby.recommendedPower
    }
  ];
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
