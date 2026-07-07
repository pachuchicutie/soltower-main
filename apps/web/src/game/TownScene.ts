import Phaser from "phaser";
import {
  defaultHeroAppearance,
  heroAnimationNames,
  heroAssetManifest,
  normalizeHeroAppearance,
  normalizeHeroId,
  npcDefinitions,
  type HeroAppearance,
  type HeroAnimationName,
  type HeroId,
  type TownMovementBroadcast,
  type TownPosition,
  type TownRealtimePlayer
} from "@soltower/shared";
import type { ModalKey } from "../store/ui";
import { playUiSound } from "../lib/audio";
import { isTextEntryActive, onClearMovementKeys, onMobileMovement, type MobileMovementDetail } from "../lib/gameInput";
import { loadUserSettings, saveUserSettings, type UserSettings } from "../lib/userSettings";
import {
  townAssetManifest,
  townLampObjects,
  townTerrainCollisionZones,
  townWorldObjects,
  type TownAssetKey,
  type TownRect,
  type TownWorldObject
} from "./config/townAssetManifest";

export interface NearbyInteraction {
  id: string;
  modal: ModalKey;
  label: string;
  prompt: string;
}

export interface TownSceneOptions {
  playerName: string;
  onNpc: (npcId: ModalKey) => void;
  mode?: "landing" | "spectate" | "game";
  selectedHeroId?: string;
  heroAppearance?: HeroAppearance;
  controlsEnabled?: boolean;
  onNearbyInteraction?: (interaction: NearbyInteraction | null) => void;
  chatBubbleId?: string;
  chatBubbleText?: string;
  initialPosition?: TownPosition;
  onPositionChange?: (position: TownPosition) => void;
  onRealtimePositionChange?: (
    position: TownPosition & { moving: boolean; running: boolean }
  ) => void;
}

interface InteractionTarget extends NearbyInteraction {
  x: number;
  y: number;
  radius: number;
  kind: "npc" | "landmark" | "prop";
  anchorId?: string;
}

interface CollisionBody {
  id: string;
  rect: Phaser.Geom.Rectangle;
}

interface RemotePlayerRuntime {
  sessionId: string;
  sequence: number;
  container: Phaser.GameObjects.Container;
  target: Phaser.Math.Vector2;
  lastReceivedAt: number;
  moving: boolean;
  running: boolean;
}

const WORLD_WIDTH = 1254;
const WORLD_HEIGHT = 1254;
const PLAZA_X = 627;
const PLAZA_Y = 650;
const WALK_SPEED = 190;
const RUN_SPEED = 292;
const HERO_FRAME_WIDTH = 64;
const HERO_FRAME_HEIGHT = 64;
const HERO_SCALE = 1;
const GAME_DEBUG = import.meta.env.VITE_GAME_DEBUG === "true";
const DESKTOP_GAME_ZOOM = 1.34;
const GAME_ZOOM_MIN = DESKTOP_GAME_ZOOM - 0.26;
const GAME_ZOOM_MAX = DESKTOP_GAME_ZOOM + 0.34;
const DEFAULT_INTERACTION_RANGE = 58;
const REMOTE_PLAYER_SNAP_DISTANCE = 240;
const REMOTE_PLAYER_IDLE_AFTER_MS = 320;
const PLAYER_COLLISION_BODY: TownRect = { offsetX: -12, offsetY: -10, width: 24, height: 21 };
const directionRows = { down: 0, left: 1, right: 2, up: 3 } as const;
const eightDirectionWalkRows = {
  "top-left": 0,
  left: 1,
  "bottom-left": 2,
  top: 3,
  "top-right": 4,
  right: 5,
  "bottom-right": 6,
  bottom: 7
} as const;
const stormArcherIdlePath = "/assets/soltower/heroes/storm-archer/idle.png?v=ref-idle-directions";
const stormArcherEightDirectionWalkPath = "/assets/soltower/heroes/storm-archer/walk-8dir.png?v=video-all-directions";
const tideMageEightDirectionWalkPath = "/assets/soltower/heroes/tide-mage/walk-8dir.png?v=video-all-directions";
const bombardierIdlePath = "/assets/soltower/heroes/bombardier/idle.png?v=walk-bottom-idle";
const bombardierEightDirectionWalkPath = "/assets/soltower/heroes/bombardier/walk-8dir.png?v=video-all-directions";
const coralAlchemistEightDirectionWalkPath = "/assets/soltower/heroes/coral-alchemist/walk-8dir.png?v=video-all-directions";
const eightDirectionWalkPaths: Partial<Record<HeroId, string>> = {
  "storm-archer": stormArcherEightDirectionWalkPath,
  "tide-mage": tideMageEightDirectionWalkPath,
  bombardier: bombardierEightDirectionWalkPath,
  "coral-alchemist": coralAlchemistEightDirectionWalkPath
};

type FacingDirection = keyof typeof directionRows;
type EightFacingDirection = keyof typeof eightDirectionWalkRows;
type HeroLayerName = "skin" | "outfit" | "cloak" | "hair" | "accent" | "weapon";

export class TownScene extends Phaser.Scene {
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys?: Record<"W" | "A" | "S" | "D" | "SHIFT", Phaser.Input.Keyboard.Key>;
  private player?: Phaser.GameObjects.Container;
  private target: Phaser.Math.Vector2 | null = null;
  private options: TownSceneOptions;
  private dragStart: Phaser.Math.Vector2 | null = null;
  private pinchDistance = 0;
  private reducedMotion = false;
  private interactionTargets: InteractionTarget[] = [];
  private currentInteraction: InteractionTarget | null = null;
  private interactionPrompt?: Phaser.GameObjects.Text;
  private interactionPromptKey?: Phaser.GameObjects.Text;
  private collisionBodies: CollisionBody[] = [];
  private lastFacing = new Phaser.Math.Vector2(0, 1);
  private lastFootstepAt = 0;
  private clearMovementUnsubscribe?: () => void;
  private mobileMovementUnsubscribe?: () => void;
  private mobileMovement: MobileMovementDetail = { active: false, x: 0, y: 0, running: false };
  private userSettings: UserSettings = loadUserSettings();
  private settingsListener?: (event: Event) => void;
  private playerChatBubble?: Phaser.GameObjects.Container;
  private playerChatBubbleBackground?: Phaser.GameObjects.Graphics;
  private playerChatBubbleText?: Phaser.GameObjects.Text;
  private activeChatBubbleId?: string;
  private lastPositionSaveAt = Number.NEGATIVE_INFINITY;
  private remotePlayers = new Map<string, RemotePlayerRuntime>();
  private localPlayerWasMoving = false;
  private localPlayerWasRunning = false;

  constructor(options: TownSceneOptions) {
    super("TownScene");
    this.options = options;
  }

  preload(): void {
    Object.entries(townAssetManifest).forEach(([name, definition]) => {
      if (isTownAssetLoadable(definition)) {
        this.load.image(environmentAssetKey(name as TownAssetKey), definition.path);
      }
    });
    heroAnimationNames.forEach((action) => {
      this.load.spritesheet(heroSpriteKey("fallback", action), `/assets/soltower/heroes/shared/fallback-${action}.png`, {
        frameWidth: HERO_FRAME_WIDTH,
        frameHeight: HERO_FRAME_HEIGHT
      });
    });
    Object.values(heroAssetManifest).forEach((entry) => {
      heroAnimationNames.forEach((action) => {
        this.load.spritesheet(heroSpriteKey(entry.heroId, action), heroWorldSheetPath(entry.heroId, action, entry.worldSpritePaths[action]), {
          frameWidth: HERO_FRAME_WIDTH,
          frameHeight: HERO_FRAME_HEIGHT
        });
        const layers = entry.customizationLayerCompatibility.worldLayers[action];
        this.load.spritesheet(heroLayerKey(entry.heroId, action, "skin"), layers.skin, {
          frameWidth: HERO_FRAME_WIDTH,
          frameHeight: HERO_FRAME_HEIGHT
        });
        this.load.spritesheet(heroLayerKey(entry.heroId, action, "accent"), layers.accent, {
          frameWidth: HERO_FRAME_WIDTH,
          frameHeight: HERO_FRAME_HEIGHT
        });
        this.load.spritesheet(heroLayerKey(entry.heroId, action, "weapon"), layers.weapon, {
          frameWidth: HERO_FRAME_WIDTH,
          frameHeight: HERO_FRAME_HEIGHT
        });
        Object.entries(layers.hair).forEach(([style, path]) => {
          this.load.spritesheet(heroLayerKey(entry.heroId, action, "hair", style), path, {
            frameWidth: HERO_FRAME_WIDTH,
            frameHeight: HERO_FRAME_HEIGHT
          });
        });
        Object.entries(layers.outfit).forEach(([variant, path]) => {
          this.load.spritesheet(heroLayerKey(entry.heroId, action, "outfit", variant), path, {
            frameWidth: HERO_FRAME_WIDTH,
            frameHeight: HERO_FRAME_HEIGHT
          });
        });
        Object.entries(layers.cloak).forEach(([cloak, path]) => {
          this.load.spritesheet(heroLayerKey(entry.heroId, action, "cloak", cloak), path, {
            frameWidth: HERO_FRAME_WIDTH,
            frameHeight: HERO_FRAME_HEIGHT
          });
        });
      });
    });
  }

  create(): void {
    this.reducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    this.cameras.main.setBackgroundColor("#07131d");
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.applyNearestNeighborTextures();
    this.createVillage();
    this.createLanterns();
    this.createNpcs();
    this.createDebugWorldOverlays();

    if (this.options.mode === "game") {
      const initialPosition = this.safeInitialPlayerPosition();
      this.lastFacing = new Phaser.Math.Vector2(initialPosition.facingX, initialPosition.facingY);
      if (this.lastFacing.lengthSq() === 0) {
        this.lastFacing.set(0, 1);
      } else {
        this.lastFacing.normalize();
      }
      this.player = this.createPlayer(
        initialPosition.x,
        initialPosition.y,
        this.options.playerName,
        normalizeHeroId(this.options.selectedHeroId),
        1,
        this.currentHeroAppearance()
      );
    }

    this.configureCamera(this.scale.width, this.scale.height);
    this.createInteractionPrompt();
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.keys = this.input.keyboard?.addKeys("W,A,S,D,SHIFT", false) as Record<
      "W" | "A" | "S" | "D" | "SHIFT",
      Phaser.Input.Keyboard.Key
    >;
    this.input.keyboard?.removeCapture("W,A,S,D,SHIFT,UP,DOWN,LEFT,RIGHT,SPACE");
    this.input.keyboard?.disableGlobalCapture();
    this.input.addPointer(1);
    this.bindPointerControls();
    this.syncPlayerChatBubble();

    const onResize = (gameSize: Phaser.Structs.Size) => {
      this.configureCamera(gameSize.width, gameSize.height);
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.clearMovementUnsubscribe = onClearMovementKeys(() => this.clearMovement());
    this.mobileMovementUnsubscribe = onMobileMovement((movement) => {
      this.mobileMovement = movement;
      if (movement.active) {
        this.target = null;
      }
    });
    this.settingsListener = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail : null;
      this.userSettings = detail ? { ...this.userSettings, ...detail } : loadUserSettings();
      this.configureCamera(this.scale.width, this.scale.height);
    };
    window.addEventListener("soltower:user-settings-changed", this.settingsListener);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
      this.clearMovementUnsubscribe?.();
      this.mobileMovementUnsubscribe?.();
      if (this.settingsListener) {
        window.removeEventListener("soltower:user-settings-changed", this.settingsListener);
      }
      this.persistPlayerPosition(this.time.now, true);
      this.options.onNearbyInteraction?.(null);
    });
  }

  override update(time: number, delta: number): void {
    this.animateRemotePlayers(time, delta);
    if (this.options.mode === "spectate") {
      return;
    }
    if (!this.player) {
      return;
    }
    if (!this.controlsEnabled()) {
      this.target = null;
      this.publishRealtimePosition(false, false);
      this.updateNearbyInteraction();
      this.updateCameraFollow();
      return;
    }

    const direction = this.keyboardDirection();
    const mobileDirection = this.mobileDirection();
    const running = this.isRunRequested(direction, mobileDirection);
    const speed = (running ? RUN_SPEED : WALK_SPEED) * (delta / 1000);
    let moving = false;
    let movement = new Phaser.Math.Vector2(0, 0);
    if (direction.lengthSq() > 0) {
      this.target = null;
      this.lastFacing = direction.clone().normalize();
      movement = direction.normalize().scale(speed);
      moving = true;
    } else if (mobileDirection.lengthSq() > 0) {
      this.target = null;
      this.lastFacing = mobileDirection.clone().normalize();
      movement = mobileDirection.normalize().scale(speed);
      moving = true;
    } else if (this.target) {
      const current = new Phaser.Math.Vector2(this.player.x, this.player.y);
      const distance = current.distance(this.target);
      if (distance < 5) {
        this.target = null;
      } else {
        movement = this.target
          .clone()
          .subtract(current)
          .normalize()
          .scale(Math.min(speed, distance));
        this.lastFacing = movement.clone().normalize();
        moving = true;
      }
    }
    if (moving) {
      this.movePlayerBy(movement.x, movement.y);
      this.playMovementSound(time, running);
    }
    this.player.x = Phaser.Math.Clamp(this.player.x, 54, WORLD_WIDTH - 54);
    this.player.y = Phaser.Math.Clamp(this.player.y, 120, WORLD_HEIGHT - 46);
    this.player.x = Math.round(this.player.x);
    this.player.y = Math.round(this.player.y);
    if (moving) {
      this.persistPlayerPosition(time);
    }
    this.publishRealtimePosition(moving, running);
    this.player.setDepth(this.player.y + 80);
    this.updateHeroSpriteFrame(this.player, time, moving);
    this.updateNearbyInteraction();
    this.updateCameraFollow();
  }

  private movePlayerBy(dx: number, dy: number): void {
    if (!this.player) {
      return;
    }

    if (dx !== 0) {
      const previousX = this.player.x;
      this.player.x += dx;
      this.resolvePlayerCollisions("x", dx, previousX);
    }
    if (dy !== 0) {
      const previousY = this.player.y;
      this.player.y += dy;
      this.resolvePlayerCollisions("y", dy, previousY);
    }
  }

  private resolvePlayerCollisions(axis: "x" | "y", delta: number, previousPosition: number): void {
    if (!this.player || this.collisionBodies.length === 0) {
      return;
    }

    for (let pass = 0; pass < 3; pass += 1) {
      const playerBody = this.playerCollisionRect();
      const hit = this.collisionBodies.find(({ rect }) =>
        Phaser.Geom.Intersects.RectangleToRectangle(playerBody, rect)
      );
      if (!hit) {
        return;
      }

      if (axis === "x") {
        this.player.x =
          delta > 0
            ? hit.rect.left - PLAYER_COLLISION_BODY.offsetX - PLAYER_COLLISION_BODY.width - 1
            : hit.rect.right - PLAYER_COLLISION_BODY.offsetX + 1;
      } else {
        this.player.y =
          delta > 0
            ? hit.rect.top - PLAYER_COLLISION_BODY.offsetY - PLAYER_COLLISION_BODY.height - 1
            : hit.rect.bottom - PLAYER_COLLISION_BODY.offsetY + 1;
      }

      this.target = null;
    }
    if (
      this.collisionBodies.some(({ rect }) =>
        Phaser.Geom.Intersects.RectangleToRectangle(this.playerCollisionRect(), rect)
      )
    ) {
      if (axis === "x") {
        this.player.x = previousPosition;
      } else {
        this.player.y = previousPosition;
      }
    }
  }

  private playerCollisionRect(): Phaser.Geom.Rectangle {
    return this.rectFromBody(this.player?.x ?? 0, this.player?.y ?? 0, PLAYER_COLLISION_BODY);
  }

  private safeInitialPlayerPosition(): TownPosition {
    const requested = this.options.initialPosition;
    const fallback: TownPosition = { x: PLAZA_X, y: PLAZA_Y + 126, facingX: 0, facingY: 1 };
    if (!requested) {
      return fallback;
    }
    const candidate: TownPosition = {
      x: Math.round(Phaser.Math.Clamp(requested.x, 54, WORLD_WIDTH - 54)),
      y: Math.round(Phaser.Math.Clamp(requested.y, 120, WORLD_HEIGHT - 46)),
      facingX: Phaser.Math.Clamp(requested.facingX, -1, 1),
      facingY: Phaser.Math.Clamp(requested.facingY, -1, 1)
    };
    const body = this.rectFromBody(candidate.x, candidate.y, PLAYER_COLLISION_BODY);
    const blocked = this.collisionBodies.some(({ rect }) =>
      Phaser.Geom.Intersects.RectangleToRectangle(body, rect)
    );
    return blocked ? fallback : candidate;
  }

  private persistPlayerPosition(time: number, force = false): void {
    if (!this.player || this.options.mode !== "game" || !this.options.onPositionChange) {
      return;
    }
    if (!force && time - this.lastPositionSaveAt < 1000) {
      return;
    }
    this.lastPositionSaveAt = time;
    const facing = this.lastFacing.lengthSq() > 0 ? this.lastFacing.clone().normalize() : new Phaser.Math.Vector2(0, 1);
    this.options.onPositionChange({
      x: Math.round(this.player.x),
      y: Math.round(this.player.y),
      facingX: Number(facing.x.toFixed(4)),
      facingY: Number(facing.y.toFixed(4))
    });
  }

  updateOptions(options: Partial<TownSceneOptions>): void {
    const controlsWereEnabled = this.controlsEnabled();
    const chatBubbleUpdated =
      Object.prototype.hasOwnProperty.call(options, "chatBubbleId") ||
      Object.prototype.hasOwnProperty.call(options, "chatBubbleText");
    this.options = { ...this.options, ...options };
    if (controlsWereEnabled && !this.controlsEnabled()) {
      this.clearMovement();
    }
    if (this.player && (options.selectedHeroId || options.heroAppearance)) {
      this.refreshActivePlayerVisual();
    }
    if (chatBubbleUpdated) {
      this.syncPlayerChatBubble();
    }
    this.updateNearbyInteraction();
  }

  syncRemotePlayers(players: TownRealtimePlayer[]): void {
    const visiblePlayerIds = new Set(players.map((player) => player.playerId));
    for (const [playerId, runtime] of this.remotePlayers) {
      if (!visiblePlayerIds.has(playerId)) {
        runtime.container.destroy(true);
        this.remotePlayers.delete(playerId);
      }
    }
    players.forEach((player) => this.upsertRemotePlayer(player));
  }

  applyRemoteMovement(movement: TownMovementBroadcast): void {
    const runtime = this.remotePlayers.get(movement.playerId);
    if (
      !runtime ||
      runtime.sessionId !== movement.sessionId ||
      movement.sequence <= runtime.sequence
    ) {
      return;
    }
    runtime.sequence = movement.sequence;
    runtime.target.set(movement.x, movement.y);
    runtime.lastReceivedAt = Date.now();
    runtime.moving = movement.moving;
    runtime.running = movement.running;
    const facing = new Phaser.Math.Vector2(movement.facingX, movement.facingY);
    if (facing.lengthSq() > 0.001) {
      runtime.container.setData("lastFacing", facing.normalize());
    }
  }

  centerCameraOnPlayer(immediate = false): void {
    if (!this.player || this.options.mode !== "game") {
      return;
    }
    this.updateCameraFollow(immediate);
  }

  private upsertRemotePlayer(player: TownRealtimePlayer): void {
    const current = this.remotePlayers.get(player.playerId);
    const heroChanged =
      current?.container.getData("heroId") !== player.heroId ||
      current?.sessionId !== player.sessionId;
    if (current && heroChanged) {
      current.container.destroy(true);
      this.remotePlayers.delete(player.playerId);
    }

    let runtime = this.remotePlayers.get(player.playerId);
    if (!runtime) {
      const container = this.createPlayer(
        player.x,
        player.y,
        player.displayName,
        player.heroId,
        0.94,
        player.appearance
      );
      const facing = new Phaser.Math.Vector2(player.facingX, player.facingY);
      container.setData(
        "lastFacing",
        facing.lengthSq() > 0.001 ? facing.normalize() : new Phaser.Math.Vector2(0, 1)
      );
      runtime = {
        sessionId: player.sessionId,
        sequence: player.sequence,
        container,
        target: new Phaser.Math.Vector2(player.x, player.y),
        lastReceivedAt: Date.now(),
        moving: player.moving,
        running: player.running
      };
      this.remotePlayers.set(player.playerId, runtime);
      return;
    }

    if (player.sequence < runtime.sequence) {
      return;
    }
    runtime.sequence = player.sequence;
    runtime.target.set(player.x, player.y);
    runtime.lastReceivedAt = Date.now();
    runtime.moving = player.moving;
    runtime.running = player.running;
    const facing = new Phaser.Math.Vector2(player.facingX, player.facingY);
    if (facing.lengthSq() > 0.001) {
      runtime.container.setData("lastFacing", facing.normalize());
    }
  }

  private animateRemotePlayers(time: number, delta: number): void {
    const now = Date.now();
    for (const runtime of this.remotePlayers.values()) {
      const container = runtime.container;
      const distance = Phaser.Math.Distance.Between(
        container.x,
        container.y,
        runtime.target.x,
        runtime.target.y
      );
      if (distance > REMOTE_PLAYER_SNAP_DISTANCE) {
        container.setPosition(runtime.target.x, runtime.target.y);
      } else if (distance > 0.35) {
        const interpolation = 1 - Math.exp(-delta / 82);
        container.x = Phaser.Math.Linear(container.x, runtime.target.x, interpolation);
        container.y = Phaser.Math.Linear(container.y, runtime.target.y, interpolation);
      } else {
        container.setPosition(runtime.target.x, runtime.target.y);
      }
      const recentlyMoving =
        runtime.moving &&
        now - runtime.lastReceivedAt <= REMOTE_PLAYER_IDLE_AFTER_MS;
      this.updateHeroSpriteFrame(container, time, recentlyMoving);
      container.setDepth(container.y + 70);
    }
  }

  private publishRealtimePosition(moving: boolean, running: boolean): void {
    if (!this.player || !this.options.onRealtimePositionChange) {
      return;
    }
    const changedMovementState =
      moving !== this.localPlayerWasMoving || running !== this.localPlayerWasRunning;
    if (!moving && !changedMovementState) {
      return;
    }
    this.localPlayerWasMoving = moving;
    this.localPlayerWasRunning = running;
    const facing =
      this.lastFacing.lengthSq() > 0
        ? this.lastFacing.clone().normalize()
        : new Phaser.Math.Vector2(0, 1);
    this.options.onRealtimePositionChange({
      x: Number(this.player.x.toFixed(2)),
      y: Number(this.player.y.toFixed(2)),
      facingX: Number(facing.x.toFixed(4)),
      facingY: Number(facing.y.toFixed(4)),
      moving,
      running
    });
  }

  private bindPointerControls(): void {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.y < 104) {
        return;
      }
      if (this.options.mode === "spectate") {
        this.dragStart = new Phaser.Math.Vector2(pointer.x, pointer.y);
        return;
      }
      if (this.options.mode === "game" && this.controlsEnabled()) {
        const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const clickedTarget = this.findInteractionAt(point.x, point.y);
        if (clickedTarget) {
          if (this.isInteractionInRange(clickedTarget)) {
            this.setCurrentInteraction(clickedTarget);
          }
          return;
        }
        this.target = new Phaser.Math.Vector2(point.x, point.y);
      }
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.options.mode !== "spectate") {
        return;
      }
      const firstTouch = this.input.pointer1;
      const secondTouch = this.input.pointer2;
      if (firstTouch?.isDown && secondTouch?.isDown) {
        const distance = Phaser.Math.Distance.Between(
          firstTouch.x,
          firstTouch.y,
          secondTouch.x,
          secondTouch.y
        );
        if (this.pinchDistance > 0) {
          const ratio = distance / this.pinchDistance;
          this.cameras.main.setZoom(
            Phaser.Math.Clamp(this.cameras.main.zoom * ratio, 0.68, 1.45)
          );
        }
        this.pinchDistance = distance;
        this.dragStart = null;
        return;
      }
      this.pinchDistance = 0;
      if (!this.dragStart || !pointer.isDown) {
        return;
      }
      const dx = pointer.x - this.dragStart.x;
      const dy = pointer.y - this.dragStart.y;
      this.cameras.main.scrollX -= dx / this.cameras.main.zoom;
      this.cameras.main.scrollY -= dy / this.cameras.main.zoom;
      this.dragStart.set(pointer.x, pointer.y);
    });

    this.input.on("pointerup", () => {
      this.dragStart = null;
      this.pinchDistance = 0;
    });

    this.input.on(
      "wheel",
      (
        pointer: Phaser.Input.Pointer,
        _objects: unknown,
        _deltaX: number,
        deltaY: number
      ) => {
        if (this.options.mode !== "spectate" && this.options.mode !== "game") {
          return;
        }
        const camera = this.cameras.main;
        const minZoom = this.options.mode === "game" ? Math.max(this.coverZoom(), GAME_ZOOM_MIN) : 0.68;
        const maxZoom = this.options.mode === "game" ? GAME_ZOOM_MAX : 1.45;
        const nextZoom = Phaser.Math.Clamp(camera.zoom + (deltaY > 0 ? -0.08 : 0.08), minZoom, maxZoom);

        if (this.options.mode === "game") {
          camera.setZoom(nextZoom);
          this.saveCameraZoomFromActual(nextZoom);
          this.updateCameraFollow(true);
          return;
        }

        const before = camera.getWorldPoint(pointer.x, pointer.y);
        camera.setZoom(nextZoom);
        const after = camera.getWorldPoint(pointer.x, pointer.y);
        camera.scrollX += before.x - after.x;
        camera.scrollY += before.y - after.y;
      }
    );
  }

  private configureCamera(width: number, height: number): void {
    const coverZoom = this.coverZoom(width, height);
    const isMobile = width < 720;
    const targetZoom =
      this.options.mode === "game" && !isMobile
        ? Math.max(coverZoom, this.gameZoomFromSetting())
        : isMobile
          ? Math.max(width / 900, height / 1000)
          : coverZoom;
    const maxZoom =
      this.options.mode === "game" && !isMobile ? GAME_ZOOM_MAX : Math.max(1.25, coverZoom);
    const zoom = Phaser.Math.Clamp(targetZoom, 0.68, maxZoom);
    const camera = this.cameras.main;
    camera.roundPixels = true;
    camera.setZoom(zoom);
    if (this.options.mode === "game" && this.player) {
      this.updateCameraFollow(true);
      return;
    }
    camera.stopFollow();
    camera.centerOn(PLAZA_X, isMobile ? 620 : PLAZA_Y);
  }

  private coverZoom(width = this.scale.width, height = this.scale.height): number {
    return Math.max(width / WORLD_WIDTH, height / WORLD_HEIGHT);
  }

  private gameZoomFromSetting(): number {
    return Phaser.Math.Linear(GAME_ZOOM_MIN, GAME_ZOOM_MAX, this.userSettings.cameraZoom);
  }

  private saveCameraZoomFromActual(zoom: number): void {
    const nextZoom = Phaser.Math.Clamp((zoom - GAME_ZOOM_MIN) / (GAME_ZOOM_MAX - GAME_ZOOM_MIN), 0, 1);
    if (Math.abs(nextZoom - this.userSettings.cameraZoom) < 0.005) {
      return;
    }
    this.userSettings = { ...this.userSettings, cameraZoom: nextZoom };
    saveUserSettings(this.userSettings);
  }

  private updateCameraFollow(immediate = false): void {
    if (!this.player || this.options.mode !== "game") {
      return;
    }
    if (!this.userSettings.cameraFollow && !immediate) {
      return;
    }
    const camera = this.cameras.main;
    const viewWidth = this.scale.width / camera.zoom;
    const viewHeight = this.scale.height / camera.zoom;
    const mobileBias = this.scale.width < 720 ? 0.54 : 0.5;
    const desiredScrollX = this.player.x - viewWidth * 0.5;
    const desiredScrollY = this.player.y - viewHeight * mobileBias;
    const maxScrollX = Math.max(0, WORLD_WIDTH - viewWidth);
    const maxScrollY = Math.max(0, WORLD_HEIGHT - viewHeight);
    const nextX = Phaser.Math.Clamp(desiredScrollX, 0, maxScrollX);
    const nextY = Phaser.Math.Clamp(desiredScrollY, 0, maxScrollY);
    if (immediate) {
      camera.scrollX = Math.round(nextX);
      camera.scrollY = Math.round(nextY);
      return;
    }
    camera.scrollX = Math.round(Phaser.Math.Linear(camera.scrollX, nextX, 0.28));
    camera.scrollY = Math.round(Phaser.Math.Linear(camera.scrollY, nextY, 0.28));
  }

  private keyboardDirection(): Phaser.Math.Vector2 {
    if (!this.controlsEnabled() || isTextEntryActive()) {
      return new Phaser.Math.Vector2(0, 0);
    }
    return new Phaser.Math.Vector2(
      (this.cursors?.right.isDown || this.keys?.D.isDown ? 1 : 0) -
        (this.cursors?.left.isDown || this.keys?.A.isDown ? 1 : 0),
      (this.cursors?.down.isDown || this.keys?.S.isDown ? 1 : 0) -
        (this.cursors?.up.isDown || this.keys?.W.isDown ? 1 : 0)
    );
  }

  private mobileDirection(): Phaser.Math.Vector2 {
    if (!this.controlsEnabled() || !this.mobileMovement.active || isTextEntryActive()) {
      return new Phaser.Math.Vector2(0, 0);
    }
    return new Phaser.Math.Vector2(this.mobileMovement.x, this.mobileMovement.y);
  }

  private isRunRequested(
    keyboardDirection: Phaser.Math.Vector2,
    mobileDirection: Phaser.Math.Vector2
  ): boolean {
    if (keyboardDirection.lengthSq() > 0) {
      return this.keys?.SHIFT.isDown === true;
    }
    return mobileDirection.lengthSq() > 0 && this.mobileMovement.running;
  }

  private controlsEnabled(): boolean {
    return this.options.mode === "game" && this.options.controlsEnabled !== false;
  }

  private clearMovement(): void {
    this.target = null;
    this.cursors?.up.reset();
    this.cursors?.down.reset();
    this.cursors?.left.reset();
    this.cursors?.right.reset();
    Object.values(this.keys ?? {}).forEach((key) => key.reset());
    this.mobileMovement = { active: false, x: 0, y: 0, running: false };
  }

  private applyNearestNeighborTextures(): void {
    Object.keys(townAssetManifest).forEach((asset) => {
      if (!this.textures.exists(environmentAssetKey(asset as TownAssetKey))) {
        return;
      }
      this.textures
        .get(environmentAssetKey(asset as TownAssetKey))
        ?.setFilter(Phaser.Textures.FilterMode.NEAREST);
    });
    heroAnimationNames.forEach((action) => {
      this.textures
        .get(heroSpriteKey("fallback", action))
        ?.setFilter(Phaser.Textures.FilterMode.NEAREST);
    });
    Object.values(heroAssetManifest).forEach((entry) => {
      heroAnimationNames.forEach((action) => {
        this.textures
          .get(heroSpriteKey(entry.heroId, action))
          ?.setFilter(Phaser.Textures.FilterMode.NEAREST);
      });
    });
  }

  private createVillage(): void {
    this.createTileField();
    this.createPaths();
    this.createWorldObjects();
    this.createTerrainCollisionZones();
  }

  private createTerrainCollisionZones(): void {
    townTerrainCollisionZones.forEach((zone) => {
      this.collisionBodies.push({
        id: zone.id,
        rect: new Phaser.Geom.Rectangle(zone.x, zone.y, zone.width, zone.height)
      });
    });
  }

  private registerInteractionTarget(target: InteractionTarget): void {
    this.interactionTargets.push(target);
  }

  private createInteractionPrompt(): void {
    this.interactionPromptKey = this.add
      .text(0, 0, "E", {
        color: "#fff7d6",
        fontSize: "12px",
        fontFamily: "monospace",
        fontStyle: "bold",
        backgroundColor: "rgba(8, 13, 20, .92)",
        padding: { x: 7, y: 5 },
        stroke: "#020617",
        strokeThickness: 3
      })
      .setOrigin(0.5)
      .setDepth(2601)
      .setVisible(false);
    this.interactionPrompt = this.add
      .text(0, 0, "", {
        color: "#fff7d6",
        fontSize: "12px",
        fontFamily: "monospace",
        fontStyle: "bold",
        backgroundColor: "rgba(5, 12, 22, .86)",
        padding: { x: 8, y: 5 },
        stroke: "#020617",
        strokeThickness: 3
      })
      .setOrigin(0, 0.5)
      .setDepth(2600)
      .setVisible(false);
  }

  private updateNearbyInteraction(): void {
    if (this.options.mode !== "game" || !this.player || !this.controlsEnabled()) {
      this.setCurrentInteraction(null);
      return;
    }
    this.setCurrentInteraction(this.findNearestInteraction());
  }

  private setCurrentInteraction(target: InteractionTarget | null): void {
    if (this.currentInteraction?.id === target?.id) {
      if (target) {
        this.positionInteractionPrompt(target);
      }
      return;
    }

    this.currentInteraction = target;
    if (!target) {
      this.interactionPrompt?.setVisible(false);
      this.interactionPromptKey?.setVisible(false);
      this.options.onNearbyInteraction?.(null);
      return;
    }

    this.interactionPrompt?.setText(target.label).setVisible(true);
    this.interactionPromptKey?.setVisible(true);
    this.positionInteractionPrompt(target);
    playUiSound("interactionNearby", { volume: 0.42, throttleMs: 2200 });
    this.options.onNearbyInteraction?.({
      id: target.id,
      modal: target.modal,
      label: target.label,
      prompt: target.prompt
    });
  }

  private playMovementSound(time: number, running: boolean): void {
    const interval = running ? 210 : 310;
    if (time - this.lastFootstepAt < interval) {
      return;
    }
    this.lastFootstepAt = time;
    playUiSound(running ? "footstepRun" : "footstepWalk", {
      volume: running ? 0.34 : 0.24,
      throttleMs: 90
    });
  }

  private positionInteractionPrompt(target: InteractionTarget): void {
    const y = target.y - 44;
    const keyWidth = this.interactionPromptKey?.width ?? 28;
    const labelWidth = this.interactionPrompt?.width ?? 120;
    const totalWidth = keyWidth + labelWidth + 8;
    this.interactionPromptKey?.setPosition(target.x - totalWidth / 2 + keyWidth / 2, y);
    this.interactionPrompt?.setPosition(target.x - totalWidth / 2 + keyWidth + 8, y);
  }

  private findNearestInteraction(): InteractionTarget | null {
    if (!this.player) {
      return null;
    }
    return (
      this.interactionTargets
      .map((target) => ({
        target,
        distance: Phaser.Math.Distance.Between(this.player!.x, this.player!.y, target.x, target.y)
      }))
      .filter(({ target, distance }) => distance <= target.radius)
      .sort((a, b) => a.distance - b.distance)[0]?.target ?? null
    );
  }

  private findInteractionAt(x: number, y: number): InteractionTarget | null {
    return (
      this.interactionTargets
        .map((target) => ({
          target,
          distance: Phaser.Math.Distance.Between(x, y, target.x, target.y)
        }))
        .filter(({ target, distance }) => distance <= Math.min(target.radius, 72))
        .sort((a, b) => a.distance - b.distance)[0]?.target ?? null
    );
  }

  private isInteractionInRange(target: InteractionTarget): boolean {
    if (!this.player) {
      return false;
    }
    return Phaser.Math.Distance.Between(this.player.x, this.player.y, target.x, target.y) <= target.radius;
  }

  private createTileField(): void {
    const ground = townAssetManifest.townGround;
    this.add
      .image(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, environmentAssetKey("townGround"))
      .setOrigin(ground.originX, ground.originY)
      .setDisplaySize(ground.renderWidth, ground.renderHeight)
      .setDepth(-100);
  }

  private createPaths(): void {
    // Paths are baked into the premium town ground asset for consistent cobble detail.
  }

  private createWorldObjects(): void {
    townWorldObjects.forEach((object) => {
      if (!isTownWorldObjectEnabled(object)) {
        return;
      }
      const sprite = this.placeWorldObject(object);
      if (object.displayLabel) {
        this.createWorldObjectLabel(object);
      }
      if (sprite.visible && object.id === "solheart-tower") {
        this.animate(sprite, {
          alpha: { from: 0.72, to: 1 },
          duration: 1900,
          yoyo: true,
          repeat: -1
        });
      }
      if (sprite.visible && object.id === "raid-gate") {
        this.animate(sprite, {
          alpha: { from: 0.82, to: 1 },
          duration: 1700,
          yoyo: true,
          repeat: -1
        });
      }
      if (sprite.visible && object.id === "fountain") {
        this.animate(sprite, {
          alpha: { from: 0.88, to: 1 },
          duration: 1800,
          yoyo: true,
          repeat: -1
        });
      }
    });
  }

  private createWorldObjectLabel(object: TownWorldObject): void {
    const scale = object.scale ?? 1;
    const anchor = object.labelAnchor ?? { offsetX: 0, offsetY: -72 };
    this.add
      .text(
        object.x + anchor.offsetX * scale,
        object.y + anchor.offsetY * scale,
        object.displayLabel ?? "",
        {
          color: "#fff0b8",
          fontSize: "12px",
          fontFamily: "monospace",
          fontStyle: "bold",
          backgroundColor: "rgba(5, 12, 22, .84)",
          padding: { x: 7, y: 4 },
          stroke: "#2b1807",
          strokeThickness: 2
        }
      )
      .setOrigin(0.5)
      .setDepth(2450);
  }

  private createLanterns(): void {
    townLampObjects.forEach((object) => {
      this.placeWorldObject(object);
    });

    const particleCount = this.reducedMotion || this.scale.width < 720 ? 10 : 34;
    for (let index = 0; index < particleCount; index += 1) {
      const particle = this.add
        .circle(
          Phaser.Math.Between(70, WORLD_WIDTH - 70),
          Phaser.Math.Between(150, WORLD_HEIGHT - 50),
          Phaser.Math.Between(1, 3),
          index % 3 === 0 ? 0xfde68a : 0xc4b5fd,
          0.34
        )
        .setDepth(1500);
      this.animate(particle, {
        y: particle.y - Phaser.Math.Between(30, 90),
        x: particle.x + Phaser.Math.Between(-28, 28),
        alpha: 0,
        duration: Phaser.Math.Between(2800, 5800),
        repeat: -1,
        delay: Phaser.Math.Between(0, 1900)
      });
    }
  }

  private placeWorldObject(object: TownWorldObject): Phaser.GameObjects.Image {
    const definition = townAssetManifest[object.assetKey];
    const scale = object.scale ?? 1;
    const renderWidth = (object.renderWidth ?? definition.renderWidth) * scale;
    const renderHeight = (object.renderHeight ?? definition.renderHeight) * scale;
    const originX = object.originX ?? definition.originX;
    const originY = object.originY ?? definition.originY;
    const sprite = this.add
      .image(object.x, object.y, environmentAssetKey(object.assetKey))
      .setOrigin(originX, originY)
      .setDisplaySize(...this.aspectSafeDisplaySize(object.assetKey, renderWidth, renderHeight))
      .setFlipX(object.flipX ?? false)
      .setVisible(object.visible ?? true)
      .setDepth(object.depth ?? object.y + (object.depthOffset ?? definition.depthOffset ?? 0));

    if (object.collidable) {
      const body = object.collisionBody ?? definition.collisionBody;
      if (body) {
        this.collisionBodies.push({
          id: object.id,
          rect: this.rectFromBody(object.x, object.y, this.scaledBody(body, scale))
        });
      }
    }

    if (object.interactable && object.interactionAction && object.interactionLabel) {
      const anchor = object.interactionAnchor ?? { offsetX: 0, offsetY: 0 };
      const anchorX = object.x + anchor.offsetX * scale;
      const anchorY = object.y + anchor.offsetY * scale;
      this.registerInteractionTarget({
        id: object.id,
        modal: object.interactionAction,
        label: object.interactionLabel,
        prompt: `[E] ${object.interactionLabel}`,
        x: anchorX,
        y: anchorY,
        radius: object.interactionRange ?? DEFAULT_INTERACTION_RANGE,
        kind: object.interactionKind ?? "prop",
        anchorId: object.id
      });
    }

    return sprite;
  }

  private aspectSafeDisplaySize(assetKey: TownAssetKey, targetWidth: number, targetHeight: number): [number, number] {
    const texture = this.textures.get(environmentAssetKey(assetKey));
    const source = texture.getSourceImage() as { width?: number; height?: number } | undefined;
    const sourceWidth = source?.width ?? targetWidth;
    const sourceHeight = source?.height ?? targetHeight;
    if (!sourceWidth || !sourceHeight) {
      return [targetWidth, targetHeight];
    }
    const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
    return [Math.round(sourceWidth * scale), Math.round(sourceHeight * scale)];
  }

  private scaledBody(body: TownRect, scale: number): TownRect {
    return {
      offsetX: body.offsetX * scale,
      offsetY: body.offsetY * scale,
      width: body.width * scale,
      height: body.height * scale
    };
  }

  private rectFromBody(x: number, y: number, body: TownRect): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(x + body.offsetX, y + body.offsetY, body.width, body.height);
  }

  private createDebugWorldOverlays(): void {
    if (!GAME_DEBUG) {
      return;
    }

    const graphics = this.add.graphics().setDepth(2700);
    graphics.lineStyle(1, 0x38bdf8, 0.72);
    this.collisionBodies.forEach(({ rect }) => {
      graphics.strokeRectShape(rect);
    });

    graphics.lineStyle(1, 0xfacc15, 0.82);
    this.interactionTargets.forEach((target) => {
      graphics.strokeCircle(target.x, target.y, target.radius);
      graphics.fillStyle(0xff4fd8, 0.9);
      graphics.fillTriangle(target.x, target.y - 6, target.x - 5, target.y + 4, target.x + 5, target.y + 4);
    });
  }

  private createNpcs(): void {
    const positions: Record<string, { x: number; y: number; labelX?: number; labelY?: number }> = {
      "market-broker": { x: 345, y: 485, labelX: 220, labelY: 272 },
      blacksmith: { x: 390, y: 940, labelX: 245, labelY: 642 },
      "quest-board": { x: 1145, y: 670, labelY: 565 },
      tavern: { x: 1025, y: 505, labelX: 1025, labelY: 268 },
      "event-board": { x: 627, y: 735, labelX: 627, labelY: 615 }
    };
    const prompts: Record<string, string> = {
      "market-broker": "Open Auction House",
      blacksmith: "Visit Emberforge",
      "quest-board": "View Quests",
      blackjack: "Play Blackjack",
      tavern: "Enter Tavern",
      "event-board": "View Event Board"
    };
    npcDefinitions.forEach((npc) => {
      if (npc.id === "blackjack" || npc.id === "raid-captain") {
        return;
      }
      const placement = positions[npc.id] ?? { x: PLAZA_X, y: PLAZA_Y };
      const { x, y } = placement;
      const modal = npc.id as ModalKey;
      const labelText = prompts[npc.id] ?? `Talk to ${npc.name}`;
      this.registerInteractionTarget({
        id: npc.id,
        modal,
        label: labelText,
        prompt: `[E] ${labelText}`,
        x,
        y,
        radius: DEFAULT_INTERACTION_RANGE,
        kind: "npc",
        anchorId: npc.id
      });
      this.collisionBodies.push({
        id: npc.id,
        rect: this.rectFromBody(x, y, { offsetX: -12, offsetY: -8, width: 24, height: 18 })
      });
      const labelX = placement.labelX ?? x;
      const labelY = placement.labelY ?? y - 58;
      const zone = this.add.container(labelX, labelY).setDepth(2450);
      const label = this.add
        .text(0, 0, npc.name, {
          color: "#fff7d6",
          fontSize: "11px",
          fontFamily: "monospace",
          backgroundColor: "rgba(5, 12, 22, .76)",
          padding: { x: 5, y: 3 },
          align: "center"
        })
        .setOrigin(0.5)
        .setVisible(true);
      zone.add([label]);
      zone.setSize(120, 32);
      zone.setInteractive({ useHandCursor: true });
      zone.on("pointerover", () => {
        const target = this.interactionTargets.find((entry) => entry.id === npc.id);
        if (this.options.mode === "game" && (!target || !this.isInteractionInRange(target))) {
          return;
        }
        label.setColor("#ffffff");
      });
      zone.on("pointerout", () => {
        label.setColor("#fff7d6");
      });
      zone.on("pointerdown", () => {
        const target = this.interactionTargets.find((entry) => entry.id === npc.id);
        if (target && this.options.mode === "game") {
          if (this.isInteractionInRange(target)) {
            this.setCurrentInteraction(target);
          }
          return;
        }
        if (this.options.mode !== "spectate") {
          this.options.onNpc(modal);
        }
      });
    });
  }

  private createPlayer(
    x: number,
    y: number,
    name: string,
    heroId: HeroId,
    alpha = 1,
    appearance: HeroAppearance = defaultHeroAppearance(heroId)
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y).setDepth(y + 70);
    const normalizedAppearance = normalizeHeroAppearance(heroId, appearance);
    const sprites = this.createHeroSprites(heroId, normalizedAppearance, alpha);
    const shadow = this.add.ellipse(0, 18, 38, 13, 0x000000, 0.24 * alpha);
    const label = this.add
      .text(0, -58, name, {
        color: "#ffffff",
        fontSize: "11px",
        fontFamily: "monospace",
        backgroundColor: "rgba(5, 12, 22, .62)",
        padding: { x: 4, y: 2 }
      })
      .setOrigin(0.5);
    container.add([shadow, ...sprites, label]);
    container.setData("heroSprites", sprites);
    container.setData("facing", "down");
    container.setData("heroId", heroId);
    container.setData("appearance", normalizedAppearance);
    return container;
  }

  private syncPlayerChatBubble(): void {
    if (!this.player || !this.options.chatBubbleId || !this.options.chatBubbleText) {
      return;
    }
    if (this.activeChatBubbleId === this.options.chatBubbleId) {
      return;
    }
    this.activeChatBubbleId = this.options.chatBubbleId;
    this.showPlayerChatBubble(this.options.chatBubbleText);
  }

  private showPlayerChatBubble(message: string): void {
    if (!this.player) {
      return;
    }
    if (!this.playerChatBubble) {
      this.createPlayerChatBubble();
    }
    const bubble = this.playerChatBubble;
    const background = this.playerChatBubbleBackground;
    const text = this.playerChatBubbleText;
    if (!bubble || !background || !text) {
      return;
    }
    text.setText(message.trim().replace(/\s+/g, " ").slice(0, 96));
    const width = Phaser.Math.Clamp(text.width + 18, 54, 214);
    const height = Math.max(28, text.height + 12);
    background.clear();
    background.fillStyle(0x050c16, 0.88);
    background.fillRoundedRect(-width / 2, -height / 2, width, height, 7);
    background.lineStyle(1, 0xf3c969, 0.46);
    background.strokeRoundedRect(-width / 2, -height / 2, width, height, 7);
    text.setPosition(0, 0);
    bubble.setPosition(0, -82);
    bubble.setAlpha(1).setVisible(true);
    this.tweens.killTweensOf(bubble);
    this.tweens.add({
      targets: bubble,
      alpha: 0,
      delay: 4500,
      duration: 360,
      onComplete: () => bubble.setVisible(false)
    });
  }

  private createPlayerChatBubble(): void {
    if (!this.player) {
      return;
    }
    const background = this.add.graphics();
    const text = this.add
      .text(0, 0, "", {
        color: "#fff7d6",
        fontSize: "10px",
        fontFamily: "monospace",
        fontStyle: "bold",
        align: "center",
        stroke: "#020617",
        strokeThickness: 3,
        wordWrap: { width: 190, useAdvancedWrap: true }
      })
      .setOrigin(0.5);
    const bubble = this.add.container(0, -82, [background, text]).setAlpha(0).setVisible(false);
    this.player.add(bubble);
    this.playerChatBubble = bubble;
    this.playerChatBubbleBackground = background;
    this.playerChatBubbleText = text;
  }

  private createHeroSprites(
    heroId: HeroId,
    appearance: HeroAppearance,
    alpha: number
  ): Phaser.GameObjects.Sprite[] {
    const baseKey = this.textures.exists(heroSpriteKey(heroId, "idle")) ? heroSpriteKey(heroId, "idle") : heroSpriteKey("fallback", "idle");
    const sprites: Phaser.GameObjects.Sprite[] = [
      this.add.sprite(0, 1, baseKey, 0).setOrigin(0.5, 0.88).setScale(HERO_SCALE).setAlpha(alpha)
    ];
    sprites[0].setData("role", "base");
    if (baseKey === heroSpriteKey("fallback", "idle")) {
      return sprites;
    }
    if (usesEightDirectionWalkSheet(heroId)) {
      return sprites;
    }
    const layerConfig: Array<{ name: HeroLayerName; key: string; tint: string }> = [
      { name: "skin", key: heroLayerKey(heroId, "idle", "skin"), tint: appearance.skinTone },
      { name: "outfit", key: heroLayerKey(heroId, "idle", "outfit", appearance.outfitVariant), tint: outfitTint(heroId, appearance.outfitVariant) },
      { name: "cloak", key: heroLayerKey(heroId, "idle", "cloak", appearance.backAccessory), tint: cloakTint(heroId, appearance.backAccessory) },
      { name: "hair", key: heroLayerKey(heroId, "idle", "hair", appearance.hairStyle), tint: appearance.hairColor },
      { name: "accent", key: heroLayerKey(heroId, "idle", "accent"), tint: appearance.accentColor },
      { name: "weapon", key: heroLayerKey(heroId, "idle", "weapon"), tint: appearance.weaponAccent }
    ];
    layerConfig.forEach((layer) => {
      if (!this.textures.exists(layer.key)) {
        return;
      }
      sprites.push(
        this.add
          .sprite(0, 1, layer.key, 0)
          .setOrigin(0.5, 0.88)
          .setScale(HERO_SCALE)
          .setTint(hexToNumber(layer.tint))
          .setAlpha(alpha)
      );
      sprites[sprites.length - 1].setData("role", layer.name);
    });
    return sprites;
  }

  private refreshActivePlayerVisual(): void {
    if (!this.player) {
      return;
    }
    const { x, y } = this.player;
    this.player.destroy(true);
    this.player = this.createPlayer(
      x,
      y,
      this.options.playerName,
      normalizeHeroId(this.options.selectedHeroId),
      1,
      this.currentHeroAppearance()
    );
    this.playerChatBubble = undefined;
    this.playerChatBubbleBackground = undefined;
    this.playerChatBubbleText = undefined;
    this.activeChatBubbleId = undefined;
    this.syncPlayerChatBubble();
  }

  private updateHeroSpriteFrame(
    container: Phaser.GameObjects.Container,
    time: number,
    moving: boolean
  ): void {
    const sprites = container.getData("heroSprites") as Phaser.GameObjects.Sprite[] | undefined;
    if (!sprites?.length) {
      return;
    }
    const facing = this.containerFacingDirection(container);
    const heroId = container.getData("heroId") as HeroId | undefined;
    const appearance = container.getData("appearance") as HeroAppearance | undefined;
    const action: HeroAnimationName = moving ? "walk" : "idle";
    const frameColumn = moving ? 1 + (Math.floor(time / 140) % 3) : 0;
    const nextFrame = this.heroFrameIndex(
      heroId,
      action,
      moving,
      facing,
      frameColumn,
      this.containerEightFacingDirection(container)
    );
    sprites.forEach((sprite) => {
      const nextTexture = heroId && appearance ? this.spriteTextureForRole(heroId, appearance, action, sprite.getData("role")) : undefined;
      if (nextTexture && this.textures.exists(nextTexture) && sprite.texture.key !== nextTexture) {
        sprite.setTexture(nextTexture);
      }
      sprite.setFrame(nextFrame);
    });
    container.setData("facing", facing);
  }

  private heroFrameIndex(
    heroId: HeroId | undefined,
    action: HeroAnimationName,
    moving: boolean,
    facing: FacingDirection,
    frameColumn: number,
    eightFacing: EightFacingDirection
  ): number {
    if (heroId && usesEightDirectionWalkSheet(heroId) && moving && action === "walk") {
      return eightDirectionWalkRows[eightFacing] * 4 + frameColumn;
    }
    return directionRows[facing] * 4 + frameColumn;
  }

  private spriteTextureForRole(
    heroId: HeroId,
    appearance: HeroAppearance,
    action: HeroAnimationName,
    role: unknown
  ): string | undefined {
    if (role === "base") return heroSpriteKey(heroId, action);
    if (role === "skin") return heroLayerKey(heroId, action, "skin");
    if (role === "outfit") return heroLayerKey(heroId, action, "outfit", appearance.outfitVariant);
    if (role === "cloak") return heroLayerKey(heroId, action, "cloak", appearance.backAccessory);
    if (role === "hair") return heroLayerKey(heroId, action, "hair", appearance.hairStyle);
    if (role === "accent") return heroLayerKey(heroId, action, "accent");
    if (role === "weapon") return heroLayerKey(heroId, action, "weapon");
    return undefined;
  }

  private containerFacingDirection(container: Phaser.GameObjects.Container): FacingDirection {
    const facing = container.getData("lastFacing") as Phaser.Math.Vector2 | undefined;
    return facingDirectionFromVector(facing ?? this.lastFacing);
  }

  private containerEightFacingDirection(container: Phaser.GameObjects.Container): EightFacingDirection {
    const facing = container.getData("lastFacing") as Phaser.Math.Vector2 | undefined;
    return eightFacingDirectionFromVector(facing ?? this.lastFacing);
  }

  private currentHeroAppearance(): HeroAppearance {
    return normalizeHeroAppearance(this.options.selectedHeroId, this.options.heroAppearance);
  }

  private animate(
    targets: Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[],
    config: Omit<Phaser.Types.Tweens.TweenBuilderConfig, "targets">
  ): void {
    if (!this.reducedMotion) {
      this.tweens.add({ targets, ...config });
    }
  }
}

function facingDirectionFromVector(facing: Phaser.Math.Vector2): FacingDirection {
  if (Math.abs(facing.x) > Math.abs(facing.y)) {
    return facing.x < 0 ? "left" : "right";
  }
  return facing.y < 0 ? "up" : "down";
}

function eightFacingDirectionFromVector(facing: Phaser.Math.Vector2): EightFacingDirection {
    const x = facing.x;
    const y = facing.y;
    const diagonalThreshold = 0.34;
    if (y < -diagonalThreshold && x < -diagonalThreshold) return "top-left";
    if (y > diagonalThreshold && x < -diagonalThreshold) return "bottom-left";
    if (y < -diagonalThreshold && x > diagonalThreshold) return "top-right";
    if (y > diagonalThreshold && x > diagonalThreshold) return "bottom-right";
    if (Math.abs(x) > Math.abs(y)) return x < 0 ? "left" : "right";
    return y < 0 ? "top" : "bottom";
}

function heroSpriteKey(heroId: HeroId | "fallback", action: HeroAnimationName): string {
  return `hero-world-${heroId}-${action}`;
}

function heroWorldSheetPath(heroId: HeroId, action: HeroAnimationName, defaultPath: string): string {
  if (heroId === "storm-archer" && action === "idle") return stormArcherIdlePath;
  if (heroId === "bombardier" && action === "idle") return bombardierIdlePath;
  if (action === "walk") return eightDirectionWalkPaths[heroId] ?? defaultPath;
  return defaultPath;
}

function usesEightDirectionWalkSheet(heroId: HeroId): boolean {
  return Boolean(eightDirectionWalkPaths[heroId]);
}

function environmentAssetKey(name: TownAssetKey): string {
  return `town-environment-${name}`;
}

function isTownAssetLoadable(definition: { assetStatus?: string; enabledForPlayerUse?: boolean }): boolean {
  return (definition.assetStatus ?? "ready") === "ready" && definition.enabledForPlayerUse !== false;
}

function isTownWorldObjectEnabled(object: TownWorldObject): boolean {
  const definition = townAssetManifest[object.assetKey];
  return (
    (object.assetStatus ?? definition.assetStatus ?? "ready") === "ready" &&
    object.enabledForPlayerUse !== false &&
    definition.enabledForPlayerUse !== false
  );
}

function heroLayerKey(heroId: HeroId, action: HeroAnimationName, layer: string, variant?: string): string {
  return `hero-world-${heroId}-${action}-${layer}${variant ? `-${variant}` : ""}`;
}

function hexToNumber(hex: string): number {
  return Number.parseInt(hex.replace("#", ""), 16);
}

function outfitTint(heroId: HeroId, outfit: HeroAppearance["outfitVariant"]): string {
  const base: Record<HeroId, string> = {
    "storm-archer": "#1f5d45",
    "tide-mage": "#1e4f78",
    bombardier: "#5b4033",
    "coral-alchemist": "#245f58",
    starcaller: "#31276b"
  };
  if (outfit === "traveler") return "#2f4156";
  if (outfit === "ceremonial") return "#46367e";
  return base[heroId];
}

function cloakTint(heroId: HeroId, cloak: HeroAppearance["backAccessory"]): string {
  const base: Record<HeroId, string> = {
    "storm-archer": "#173c3d",
    "tide-mage": "#173c65",
    bombardier: "#292a30",
    "coral-alchemist": "#45345f",
    starcaller: "#191f4f"
  };
  if (cloak === "wing-cape") return "#2f5368";
  if (cloak === "long-cloak") return "#17223f";
  return base[heroId];
}
