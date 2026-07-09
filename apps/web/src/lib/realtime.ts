import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import {
  townMovementBroadcastSchema,
  townRealtimePlayerSchema,
  type HeroAppearance,
  type HeroId,
  type TownMovementBroadcast,
  type TownPosition,
  type TownRealtimePlayer,
  type TownServerId
} from "@soltower/shared";
import { createBrowserSupabaseClient } from "./supabase";

/** Movement broadcast cadence — ~8 Hz keeps walk smooth without flooding Realtime. */
const MOVEMENT_SEND_INTERVAL_MS = 100;
/** Presence is only for discovery/heartbeats — never per-step (rate limits freeze remotes). */
const PRESENCE_TRACK_INTERVAL_MS = 2000;
/** Keepalive so idle avatars and presence metas do not expire mid-session. */
const PRESENCE_REFRESH_INTERVAL_MS = 4000;
/** Drop presence metas older than this when building the roster. */
const PRESENCE_VISIBLE_UNTIL_MS = PRESENCE_REFRESH_INTERVAL_MS * 4;
/** Reconnect backoff after channel errors. */
const RECONNECT_BASE_DELAY_MS = 750;
const RECONNECT_MAX_DELAY_MS = 8000;

export type TownRealtimeStatus = "connecting" | "connected" | "disconnected" | "error";

interface TownRealtimeSessionOptions {
  playerId: string;
  displayName: string;
  heroId: HeroId;
  appearance: HeroAppearance;
  townChannel: TownServerId;
  initialPosition: TownPosition;
  onPresence: (players: TownRealtimePlayer[]) => void;
  onMovement: (movement: TownMovementBroadcast) => void;
  onStatus?: (status: TownRealtimeStatus) => void;
}

export interface LocalTownMovement extends TownPosition {
  moving: boolean;
  running: boolean;
}

export class TownRealtimeSession {
  private readonly client: SupabaseClient;
  private readonly options: TownRealtimeSessionOptions;
  private readonly sessionId = crypto.randomUUID();
  private channel?: RealtimeChannel;
  private latestState: TownRealtimePlayer;
  private lastSentAt = 0;
  private lastPresenceTrackAt = Number.NEGATIVE_INFINITY;
  private sequence = 0;
  private pendingMovement?: LocalTownMovement;
  private movementTimer?: number;
  private presenceTimer?: number;
  private reconnectTimer?: number;
  private reconnectAttempt = 0;
  private disposed = false;

  constructor(options: TownRealtimeSessionOptions, client = createBrowserSupabaseClient()) {
    if (!client) {
      throw new Error("Supabase is not configured for realtime multiplayer.");
    }
    this.client = client;
    this.options = options;
    this.latestState = townRealtimePlayerSchema.parse({
      sessionId: this.sessionId,
      playerId: options.playerId,
      displayName: options.displayName,
      heroId: options.heroId,
      appearance: options.appearance,
      townChannel: options.townChannel,
      ...options.initialPosition,
      moving: false,
      running: false,
      sequence: 0,
      sentAt: Date.now()
    });
  }

  connect(): void {
    if (this.disposed) {
      return;
    }
    this.clearReconnectTimer();
    this.teardownChannel();
    this.options.onStatus?.("connecting");
    const topic = `town:${this.options.townChannel}`;
    for (const existingChannel of this.client.getChannels()) {
      const existingTopic = (existingChannel as { topic?: string }).topic;
      if (existingTopic === topic || existingTopic === `realtime:${topic}`) {
        void this.client.removeChannel(existingChannel);
      }
    }
    const channel = this.client.channel(topic, {
      config: {
        broadcast: { ack: false, self: false },
        presence: { key: this.sessionId }
      }
    });
    this.channel = channel;
    channel
      .on("presence", { event: "sync" }, () => this.syncPresence())
      .on("presence", { event: "join" }, () => this.syncPresence())
      .on("presence", { event: "leave" }, () => this.syncPresence())
      .on("broadcast", { event: "player_move" }, ({ payload }) => {
        const parsed = townMovementBroadcastSchema.safeParse(payload);
        if (!parsed.success || parsed.data.playerId === this.options.playerId) {
          return;
        }
        this.options.onMovement(parsed.data);
      })
      .subscribe((status) => {
        if (this.disposed) {
          return;
        }
        if (status === "SUBSCRIBED") {
          this.reconnectAttempt = 0;
          this.options.onStatus?.("connected");
          // Full presence meta once on join for roster discovery.
          this.trackLatestPresence(true);
          this.broadcastLatestState(true);
          this.startPresenceRefresh();
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          this.options.onStatus?.("error");
          this.scheduleReconnect();
          return;
        }
        if (status === "CLOSED") {
          this.options.onStatus?.("disconnected");
          if (!this.disposed) {
            this.scheduleReconnect();
          }
        }
      });
  }

  publishMovement(movement: LocalTownMovement): void {
    if (this.disposed) {
      return;
    }
    this.pendingMovement = movement;
    const elapsed = performance.now() - this.lastSentAt;
    if (elapsed >= MOVEMENT_SEND_INTERVAL_MS) {
      this.flushMovement();
      return;
    }
    if (this.movementTimer === undefined) {
      this.movementTimer = window.setTimeout(
        () => this.flushMovement(),
        MOVEMENT_SEND_INTERVAL_MS - elapsed
      );
    }
  }

  /** Push the latest appearance/name without tearing down the socket. */
  updateIdentity(patch: {
    displayName?: string;
    heroId?: HeroId;
    appearance?: HeroAppearance;
  }): void {
    this.latestState = townRealtimePlayerSchema.parse({
      ...this.latestState,
      displayName: patch.displayName ?? this.latestState.displayName,
      heroId: patch.heroId ?? this.latestState.heroId,
      appearance: patch.appearance ?? this.latestState.appearance,
      sentAt: Date.now()
    });
    this.trackLatestPresence(true);
    this.broadcastLatestState(true);
  }

  async disconnect(): Promise<void> {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.clearReconnectTimer();
    if (this.movementTimer !== undefined) {
      window.clearTimeout(this.movementTimer);
      this.movementTimer = undefined;
    }
    if (this.presenceTimer !== undefined) {
      window.clearInterval(this.presenceTimer);
      this.presenceTimer = undefined;
    }
    await this.teardownChannel();
    this.options.onPresence([]);
    this.options.onStatus?.("disconnected");
  }

  private async teardownChannel(): Promise<void> {
    const channel = this.channel;
    this.channel = undefined;
    if (this.presenceTimer !== undefined) {
      window.clearInterval(this.presenceTimer);
      this.presenceTimer = undefined;
    }
    if (!channel) {
      return;
    }
    await channel.untrack().catch(() => undefined);
    await this.client.removeChannel(channel).catch(() => undefined);
  }

  private scheduleReconnect(): void {
    if (this.disposed || this.reconnectTimer !== undefined) {
      return;
    }
    const delay = Math.min(
      RECONNECT_MAX_DELAY_MS,
      RECONNECT_BASE_DELAY_MS * 2 ** this.reconnectAttempt
    );
    this.reconnectAttempt += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = undefined;
      if (!this.disposed) {
        this.connect();
      }
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== undefined) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private flushMovement(): void {
    if (this.movementTimer !== undefined) {
      window.clearTimeout(this.movementTimer);
      this.movementTimer = undefined;
    }
    const movement = this.pendingMovement;
    this.pendingMovement = undefined;
    if (!movement || !this.channel) {
      return;
    }
    this.sequence += 1;
    this.lastSentAt = performance.now();
    this.latestState = townRealtimePlayerSchema.parse({
      ...this.latestState,
      ...movement,
      sequence: this.sequence,
      sentAt: Date.now()
    });
    // Movement always goes over broadcast (high frequency). Presence is throttled separately.
    this.broadcastLatestState();
    // Track presence on stop, first packet, or every PRESENCE_TRACK_INTERVAL_MS while moving.
    this.trackLatestPresence(!movement.moving || this.sequence === 1);
  }

  private syncPresence(): void {
    if (!this.channel) {
      return;
    }
    const freshSince = Date.now() - PRESENCE_VISIBLE_UNTIL_MS;
    const newestByPlayer = new Map<string, TownRealtimePlayer>();
    for (const presences of Object.values(this.channel.presenceState())) {
      for (const presence of presences) {
        const parsed = townRealtimePlayerSchema.safeParse(presence);
        if (
          !parsed.success ||
          parsed.data.playerId === this.options.playerId ||
          parsed.data.sentAt < freshSince
        ) {
          continue;
        }
        const current = newestByPlayer.get(parsed.data.playerId);
        if (!current || isNewerRealtimePlayer(parsed.data, current)) {
          newestByPlayer.set(parsed.data.playerId, parsed.data);
        }
      }
    }
    this.options.onPresence([...newestByPlayer.values()]);
  }

  private startPresenceRefresh(): void {
    if (this.presenceTimer !== undefined) {
      return;
    }
    this.presenceTimer = window.setInterval(() => {
      if (!this.channel || this.disposed) {
        return;
      }
      // Heartbeat keeps idle avatars visible and re-syncs position if broadcasts were dropped.
      this.latestState = townRealtimePlayerSchema.parse({
        ...this.latestState,
        sentAt: Date.now()
      });
      this.trackLatestPresence(true);
      this.broadcastLatestState(true);
    }, PRESENCE_REFRESH_INTERVAL_MS);
  }

  private trackLatestPresence(force = false): void {
    if (!this.channel) {
      return;
    }
    const now = performance.now();
    if (!force && now - this.lastPresenceTrackAt < PRESENCE_TRACK_INTERVAL_MS) {
      return;
    }
    this.lastPresenceTrackAt = now;
    void this.channel.track(this.latestState).catch(() => undefined);
  }

  private broadcastLatestState(_force = false): void {
    if (!this.channel) {
      return;
    }
    const payload = townMovementBroadcastSchema.parse(this.latestState);
    void this.channel
      .send({
        type: "broadcast",
        event: "player_move",
        payload
      })
      .catch(() => undefined);
  }
}

function isNewerRealtimePlayer(candidate: TownRealtimePlayer, current: TownRealtimePlayer): boolean {
  if (candidate.sessionId !== current.sessionId) {
    return candidate.sentAt >= current.sentAt;
  }
  if (candidate.sequence !== current.sequence) {
    return candidate.sequence > current.sequence;
  }
  return candidate.sentAt >= current.sentAt;
}
