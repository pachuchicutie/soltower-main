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

const MOVEMENT_SEND_INTERVAL_MS = 125;
const PRESENCE_REFRESH_INTERVAL_MS = 5000;
const PRESENCE_VISIBLE_UNTIL_MS = PRESENCE_REFRESH_INTERVAL_MS * 3;

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
  private sequence = 0;
  private pendingMovement?: LocalTownMovement;
  private movementTimer?: number;
  private presenceTimer?: number;
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
    if (this.channel || this.disposed) {
      return;
    }
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
          this.options.onStatus?.("connected");
          void channel.track(this.latestState);
          this.startPresenceRefresh();
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          this.options.onStatus?.("error");
          return;
        }
        if (status === "CLOSED") {
          this.options.onStatus?.("disconnected");
        }
      });
    this.channel = channel;
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

  async disconnect(): Promise<void> {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (this.movementTimer !== undefined) {
      window.clearTimeout(this.movementTimer);
    }
    if (this.presenceTimer !== undefined) {
      window.clearInterval(this.presenceTimer);
    }
    const channel = this.channel;
    this.channel = undefined;
    if (channel) {
      await channel.untrack().catch(() => undefined);
      await this.client.removeChannel(channel);
    }
    this.options.onPresence([]);
    this.options.onStatus?.("disconnected");
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
    const payload = townMovementBroadcastSchema.parse(this.latestState);
    void this.channel.send({
      type: "broadcast",
      event: "player_move",
      payload
    });
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
        if (!current || parsed.data.sentAt > current.sentAt) {
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
      if (!this.channel) {
        return;
      }
      this.latestState = {
        ...this.latestState,
        sentAt: Date.now()
      };
      void this.channel.track(this.latestState);
    }, PRESENCE_REFRESH_INTERVAL_MS);
  }
}
