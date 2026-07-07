import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  townAssetManifest,
  townLampObjects,
  townTerrainCollisionZones,
  townWorldObjects
} from "./config/townAssetManifest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(path: string): string {
  return readFileSync(join(webRoot, path), "utf8");
}

describe("authenticated town scene UX", () => {
  it("keeps authenticated camera follow separate from spectate/landing camera modes", () => {
    const scene = read("src/game/TownScene.ts");
    const canvas = read("src/components/TownCanvas.tsx");
    expect(scene).toContain('this.options.mode === "game"');
    expect(scene).toContain("updateCameraFollow");
    expect(scene).toContain("Phaser.Math.Linear(camera.scrollX, nextX, 0.28)");
    expect(scene).toContain("camera.stopFollow()");
    expect(scene).toContain("setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT)");
    expect(scene).toContain("camera.roundPixels = true");
    expect(scene).toContain("Math.max(1.25, coverZoom)");
    expect(scene).toContain("DESKTOP_GAME_ZOOM");
    expect(scene).toContain("GAME_ZOOM_MIN");
    expect(scene).toContain("GAME_ZOOM_MAX");
    expect(scene).toContain("gameZoomFromSetting");
    expect(scene).toContain("saveCameraZoomFromActual");
    expect(scene).toContain("this.updateCameraFollow(true);");
    expect(scene).toContain("soltower:user-settings-changed");
    expect(canvas).toContain("pixelArt: true");
    expect(canvas).toContain("antialias: false");
  });

  it("anchors player-mode wheel zoom to the active hero", () => {
    const scene = read("src/game/TownScene.ts");
    const wheelHandler = scene.slice(
      scene.indexOf('this.input.on(\n      "wheel"'),
      scene.indexOf("private configureCamera")
    );
    const gameBranch = wheelHandler.slice(
      wheelHandler.indexOf('if (this.options.mode === "game")'),
      wheelHandler.indexOf("const before = camera.getWorldPoint")
    );

    expect(gameBranch).toContain("camera.setZoom(nextZoom)");
    expect(gameBranch).toContain("this.saveCameraZoomFromActual(nextZoom)");
    expect(gameBranch).toContain("this.updateCameraFollow(true)");
    expect(gameBranch).toContain("return");
    expect(gameBranch).not.toContain("getWorldPoint");
  });

  it("centralizes input safety and movement clearing", () => {
    const input = read("src/lib/gameInput.ts");
    const shortcuts = read("src/hooks/useTownShortcuts.ts");
    const scene = read("src/game/TownScene.ts");
    expect(input).toContain("isEditableTarget");
    expect(input).toContain("contenteditable");
    expect(shortcuts).toContain('key === "i"');
    expect(shortcuts).toContain('key === "q"');
    expect(shortcuts).toContain('key === "e"');
    expect(shortcuts).toContain("event.isComposing");
    expect(scene).toContain("isTextEntryActive()");
    expect(scene).toContain("onClearMovementKeys");
    expect(scene).toContain('addKeys("W,A,S,D,SHIFT", false)');
    expect(scene).toContain('removeCapture("W,A,S,D,SHIFT,UP,DOWN,LEFT,RIGHT,SPACE")');
    expect(scene).toContain("disableGlobalCapture()");
  });

  it("supports Shift run and mobile outer-ring run movement", () => {
    const input = read("src/lib/gameInput.ts");
    const scene = read("src/game/TownScene.ts");
    expect(input).toContain("emitMobileMovement");
    expect(scene).toContain("RUN_SPEED");
    expect(scene).toContain("this.keys?.SHIFT.isDown");
    expect(scene).toContain("onMobileMovement");
    expect(scene).toContain("this.mobileMovement.running");
  });

  it("restores and throttles authenticated player town position", () => {
    const scene = read("src/game/TownScene.ts");
    const canvas = read("src/components/TownCanvas.tsx");
    const app = read("src/App.tsx");
    const actions = read("../../supabase/functions/_shared/actions.ts");
    const migration = read("../../supabase/migrations/20260704000100_player_town_position.sql");

    expect(scene).toContain("safeInitialPlayerPosition");
    expect(scene).toContain("persistPlayerPosition");
    expect(scene).toContain("time - this.lastPositionSaveAt < 1000");
    expect(scene).toContain("this.persistPlayerPosition(this.time.now, true)");
    expect(canvas).toContain("initialPosition");
    expect(canvas).toContain("onPositionChange");
    expect(app).toContain('"/api/town/position"');
    expect(actions).toContain("townPositionSchema.parse");
    expect(actions).toContain('"save-town-position": saveTownPosition');
    expect(actions).toContain("world_x: body.x");
    expect(migration).toContain("player_presence_world_position_check");
  });

  it("uses Supabase Broadcast for throttled movement and Phaser interpolation", () => {
    const realtime = read("src/lib/realtime.ts");
    const canvas = read("src/components/TownCanvas.tsx");
    const scene = read("src/game/TownScene.ts");

    expect(realtime).toContain("MOVEMENT_SEND_INTERVAL_MS = 125");
    expect(realtime).toContain('event: "player_move"');
    expect(realtime).toContain("presenceState()");
    expect(realtime).toContain("townMovementBroadcastSchema.safeParse");
    expect(canvas).toContain("new TownRealtimeSession");
    expect(canvas).toContain("syncRemotePlayers");
    expect(scene).toContain("animateRemotePlayers");
    expect(scene).toContain("REMOTE_PLAYER_SNAP_DISTANCE");
    expect(scene).toContain("Math.exp(-delta / 82)");
  });

  it("uses one proximity interaction registry without direct click-to-open activation", () => {
    const scene = read("src/game/TownScene.ts");
    expect(scene).toContain("findNearestInteraction");
    expect(scene).toContain("isInteractionInRange");
    expect(scene).toContain("setCurrentInteraction(clickedTarget)");
    expect(scene).not.toContain("activateInteraction");
    expect(scene).not.toContain("this.options.onNpc(target.modal)");
    expect(scene).toContain('"market-broker": "Open Auction House"');
    expect(scene).toContain("prompt: `[E] ${labelText}`");
    expect(scene).toContain("[E] ${object.interactionLabel}");
    expect(scene).toContain("interactionPromptKey");
    expect(scene).toContain("distance <= target.radius");
  });

  it("loads selected Hero spritesheets and uses a neutral fallback instead of player triangles", () => {
    const scene = read("src/game/TownScene.ts");
    const createPlayer = scene.slice(scene.indexOf("private createPlayer"), scene.indexOf("private createHeroSprites"));
    expect(scene).toContain("heroAssetManifest");
    expect(scene).toContain("heroAnimationNames.forEach");
    expect(scene).toContain("entry.worldSpritePaths[action]");
    expect(scene).toContain("stormArcherIdlePath");
    expect(scene).toContain("stormArcherEightDirectionWalkPath");
    expect(scene).toContain("tideMageEightDirectionWalkPath");
    expect(scene).toContain("bombardierEightDirectionWalkPath");
    expect(scene).toContain("coralAlchemistEightDirectionWalkPath");
    expect(scene).toContain("eightDirectionWalkRows[eightFacing]");
    expect(scene).toContain("/assets/soltower/heroes/shared/fallback-${action}.png");
    expect(scene).toContain("normalizeHeroAppearance");
    expect(createPlayer).toContain("this.createHeroSprites");
    expect(createPlayer).not.toContain(".triangle(");
    expect(createPlayer).not.toContain(".circle(");
  });

  it("does not spawn permanent walking NPCs in the player-facing town", () => {
    const scene = read("src/game/TownScene.ts");
    expect(scene).not.toContain("createGhostPlayers");
    expect(scene).not.toContain("updateAmbientHeroMotion");
    expect(scene).not.toContain('{ name: "Nyla", x:');
    expect(scene).not.toContain('{ name: "Orren", x:');
    expect(scene).not.toContain('{ name: "Safi", x:');
  });

  it("loads premium environment art assets instead of the geometric placeholder town", () => {
    const scene = read("src/game/TownScene.ts");
    const manifest = read("src/game/config/townAssetManifest.ts");
    expect(scene).toContain("townAssetManifest");
    expect(manifest).toContain("townGround");
    expect(manifest).toContain("solheartTower");
    expect(manifest).toContain("marketStall");
    expect(scene).toContain("placeWorldObject");
    expect(scene).toContain("environmentAssetKey");
    expect(scene).toContain("aspectSafeDisplaySize");
    expect(scene).toContain("setDisplaySize(...this.aspectSafeDisplaySize");
    expect(scene).not.toContain("rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2");
    expect(scene).not.toContain("polygon(x, y, [0, -28, 55, 0, 0, 28, -55, 0]");
  });

  it("defines scaled town asset metadata instead of raw generated canvas dimensions", () => {
    expect(townAssetManifest.moonpetalMarket.renderWidth).toBe(232);
    expect(townAssetManifest.lanternrootTavern.renderWidth).toBe(242);
    expect(townAssetManifest.blacksmith.renderWidth).toBe(336);
    expect(townAssetManifest.marketStall.renderWidth).toBe(144);
    expect(townAssetManifest.lampPost.renderWidth).toBe(42);
    expect(townAssetManifest.solheartTower.renderHeight).toBe(270);
    expect(townAssetManifest.moonpetalMarket.renderWidth).toBeLessThan(600);
    expect(townAssetManifest.lanternrootTavern.renderWidth).toBeLessThan(600);
    expect(townAssetManifest.blacksmith.renderWidth).toBeLessThan(600);
  });

  it("configures collision bodies for every physical town object category", () => {
    const collidableAssets = Object.entries(townAssetManifest)
      .filter(([, definition]) => definition.collidable)
      .map(([asset]) => asset);

    expect(collidableAssets).toEqual(
      expect.arrayContaining([
        "solheartTower",
        "raidPortal",
        "moonpetalMarket",
        "lanternrootTavern",
        "emberforge",
        "questGrove",
        "blacksmith",
        "starlightVault",
        "marketStall",
        "questBoard",
        "rockCluster",
        "lampPost",
        "bench",
        "barrelCrates",
        "fenceRail",
        "signpost",
        "fountain",
        "dock",
        "boat",
        "campfire"
      ])
    );
    expect(Object.values(townAssetManifest).filter((definition) => definition.collidable && definition.collisionBody).length).toBe(collidableAssets.length);
    expect(read("src/game/TownScene.ts")).toContain("resolvePlayerCollisions");
  });

  it("leaves trees and lamp glow baked into the town background", () => {
    expect("oakTree" in townAssetManifest).toBe(false);
    expect("pineTree" in townAssetManifest).toBe(false);
    expect("lampGlow" in townAssetManifest).toBe(false);

    const scene = read("src/game/TownScene.ts");
    expect(scene).not.toContain('environmentAssetKey("lampGlow")');
    expect(scene).not.toContain("Phaser.BlendModes.ADD");
  });

  it("declares visible Starlight Vault infrastructure with the production town asset", () => {
    const scene = read("src/game/TownScene.ts");
    const vaultAsset = townAssetManifest.starlightVault;
    const vaultObject = townWorldObjects.find((object) => object.id === "starlight-vault");

    expect(vaultAsset).toMatchObject({
      path: "/assets/soltower/environment/structures/starlight-vault.png",
      assetStatus: "ready",
      enabledForPlayerUse: true,
      collidable: true
    });
    expect(vaultAsset.collisionBody).toBeTruthy();
    expect(vaultObject).toMatchObject({
      x: 1000,
      y: 955,
      scale: 1.18,
      collidable: true,
      interactable: true,
      debugVisible: false,
      interactionLabel: "Enter Starlight Vault",
      interactionAction: "open_starlight_vault",
      displayLabel: "Starlight Vault",
      labelAnchor: { offsetX: 0, offsetY: -315 },
      assetStatus: "ready",
      enabledForPlayerUse: true
    });
    expect(scene).toContain("createWorldObjectLabel");
    expect(scene).toContain("isTownAssetLoadable");
    expect(scene).toContain("isTownWorldObjectEnabled");
    expect(scene).toContain("(definition.assetStatus ?? \"ready\") === \"ready\"");
  });

  it("resolves collisions by movement direction instead of snapping across object centers", () => {
    const scene = read("src/game/TownScene.ts");
    const resolver = scene.slice(scene.indexOf('private resolvePlayerCollisions(axis: "x" | "y"'), scene.indexOf("private playerCollisionRect"));

    expect(resolver).toContain("delta: number");
    expect(resolver).toContain("previousPosition");
    expect(resolver).toContain("delta > 0");
    expect(resolver).toContain("hit.rect.top - PLAYER_COLLISION_BODY.offsetY - PLAYER_COLLISION_BODY.height - 1");
    expect(resolver).toContain("hit.rect.bottom - PLAYER_COLLISION_BODY.offsetY + 1");
    expect(resolver).not.toContain("playerBody.centerX < hit.rect.centerX");
    expect(resolver).not.toContain("playerBody.centerY < hit.rect.centerY");
  });

  it("blocks water, cliffs, trees, and raised terrain from player movement", () => {
    const scene = read("src/game/TownScene.ts");
    const terrainCollision = scene.slice(
      scene.indexOf("private createTerrainCollisionZones"),
      scene.indexOf("private registerInteractionTarget")
    );

    expect(scene).toContain("this.createTerrainCollisionZones()");
    expect(terrainCollision).toContain("townTerrainCollisionZones.forEach");
    expect(townTerrainCollisionZones.map((zone) => zone.id)).toEqual(
      expect.arrayContaining([
        "northeast-waterfall",
        "south-water",
        "southwest-cliff",
        "southeast-cliff",
        "north-platform-west-wall",
        "central-raised-dais",
        "west-middle-trees",
        "east-middle-trees"
      ])
    );
    expect(townTerrainCollisionZones.every((zone) => zone.width > 0 && zone.height > 0)).toBe(true);
  });

  it("keeps interaction anchors reachable and labels every configured interactable", () => {
    const interactables = townWorldObjects.filter((object) => object.interactable);
    const goldMarketBoards = townWorldObjects.filter((object) =>
      object.id.startsWith("gold-market-board")
    );
    const questBoardEast = townWorldObjects.find((object) => object.id === "quest-board-east");
    expect(interactables.map((object) => object.interactionLabel)).toEqual(
      expect.arrayContaining([
        "Enter Raid Board",
        "Open Auction House",
        "Open Gold Exchange",
        "View Quests",
        "Play Blackjack",
        "Enter Tavern",
        "Visit Emberforge",
        "Enter Starlight Vault"
      ])
    );
    expect(goldMarketBoards).toHaveLength(1);
    expect(goldMarketBoards.map((object) => object.id).sort()).toEqual([
      "gold-market-board-left"
    ]);
    expect(goldMarketBoards.every((object) => object.interactable)).toBe(true);
    expect(goldMarketBoards.every((object) => object.assetKey === "marketStall")).toBe(true);
    expect(goldMarketBoards.every((object) => (object.scale ?? 1) >= 1.1)).toBe(true);
    expect(goldMarketBoards.every((object) => object.y === 620)).toBe(true);
    expect(goldMarketBoards.find((object) => object.id === "gold-market-board-left")).toMatchObject({
      x: 115,
      displayLabel: "Gold Exchange"
    });
    expect(goldMarketBoards.every((object) => object.interactionLabel === "Open Gold Exchange")).toBe(true);
    expect(questBoardEast).toMatchObject({
      assetKey: "questBoard",
      x: 1145,
      y: 635,
      scale: 1.2,
      interactionLabel: "View Quests",
      interactionAction: "quest-board"
    });
    expect(townWorldObjects.some((object) => object.id === "quest-grove")).toBe(false);
    expect(townWorldObjects.some((object) => object.id === "quest-board-prop")).toBe(false);
    expect(townWorldObjects.some((object) => object.id === "signpost-2")).toBe(false);
    expect(townWorldObjects.some((object) => object.id === "market-stall-west-south")).toBe(false);
    expect(townWorldObjects.some((object) => object.id === "market-stall-west-north")).toBe(false);
    expect(townWorldObjects.some((object) => object.id === "market-stall-east")).toBe(false);
    expect(townWorldObjects.find((object) => object.id === "blackjack-table")).toMatchObject({
      assetKey: "blackjackTable",
      x: 627,
      y: 985,
      displayLabel: "Lady Vesper's Blackjack",
      interactionRange: 78
    });
    expect(townWorldObjects.find((object) => object.id === "bench-west")).toMatchObject({
      x: 470,
      y: 715,
      flipX: true
    });
    expect(townWorldObjects.find((object) => object.id === "bench-east")).toMatchObject({
      x: 784,
      y: 715,
      flipX: false
    });
    for (const object of interactables) {
      expect(object.interactionLabel, object.id).toBeTruthy();
      expect(object.interactionAction, object.id).toBeTruthy();
      expect(object.interactionAnchor, object.id).toBeTruthy();
      expect(object.interactionRange ?? 0, object.id).toBeGreaterThanOrEqual(54);
      expect(object.interactionRange ?? 0, object.id).toBeLessThanOrEqual(object.interactionKind === "landmark" ? 160 : 58);
    }
    const blacksmithExterior = townWorldObjects.find((object) => object.id === "blacksmith-exterior");
    expect(blacksmithExterior?.interactionRange).toBe(158);
    expect(blacksmithExterior?.y).toBe(955);
  });

  it("does not spawn Captain Rook as a player-facing town NPC", () => {
    const scene = read("src/game/TownScene.ts");
    const createNpcs = scene.slice(scene.indexOf("private createNpcs"), scene.indexOf("private createPlayer"));

    expect(createNpcs).toContain('npc.id === "raid-captain"');
    expect(createNpcs).not.toContain('"raid-captain": { x:');
    expect(createNpcs).not.toContain('"raid-captain": "Enter Raid Board"');
    expect(townWorldObjects.some((object) => object.interactionAction === "raid-captain")).toBe(true);
  });

  it("renders town labels above structures instead of at blocked interaction anchors", () => {
    const scene = read("src/game/TownScene.ts");
    const npcSlice = scene.slice(scene.indexOf("private createNpcs"), scene.indexOf("private createPlayer"));

    expect(npcSlice).toContain("labelX");
    expect(npcSlice).toContain("labelY");
    expect(npcSlice).toContain("setDepth(2450)");
    expect(npcSlice).toContain("tavern: { x: 1025, y: 505, labelX: 1025, labelY: 268 }");
    expect(npcSlice).toContain("blacksmith: { x: 390, y: 940, labelX: 245, labelY: 642 }");
  });

  it("declares object collision, interaction, and debug visibility explicitly", () => {
    const objects = [...townWorldObjects, ...townLampObjects];
    expect(objects.length).toBeGreaterThan(15);

    for (const object of objects) {
      expect(typeof object.collidable, object.id).toBe("boolean");
      expect(typeof object.interactable, object.id).toBe("boolean");
      expect(object.debugVisible, object.id).toBe(false);
    }

    const fountain = townWorldObjects.find((object) => object.id === "fountain");
    expect(fountain).toMatchObject({
      collidable: true,
      interactable: false,
      debugVisible: false
    });
    expect(fountain?.interactionAction).toBeUndefined();
    expect(fountain?.interactionLabel).toBeUndefined();
  });

  it("keeps normal player view free of permanent interaction debug visuals", () => {
    const scene = read("src/game/TownScene.ts");
    const promptSlice = scene.slice(scene.indexOf("private createInteractionPrompt"), scene.indexOf("private updateNearbyInteraction"));
    const npcSlice = scene.slice(scene.indexOf("private createNpcs"), scene.indexOf("private createPlayer"));
    const debugSlice = scene.slice(scene.indexOf("private createDebugWorldOverlays"), scene.indexOf("private createNpcs"));

    expect(promptSlice).not.toContain(".circle(");
    expect(promptSlice).not.toContain("strokeCircle");
    expect(promptSlice).not.toContain("fillTriangle");
    expect(npcSlice).not.toContain(".triangle(");
    expect(npcSlice).not.toContain(".circle(");
    expect(npcSlice).not.toContain("setStrokeStyle");
    expect(debugSlice).toContain("if (!GAME_DEBUG)");
    expect(debugSlice).toContain("strokeRectShape");
    expect(debugSlice).toContain("strokeCircle");
    expect(debugSlice).toContain("fillTriangle");
  });

  it("gates world debug overlays behind the explicit VITE_GAME_DEBUG flag", () => {
    const scene = read("src/game/TownScene.ts");
    expect(scene).toContain('const GAME_DEBUG = import.meta.env.VITE_GAME_DEBUG === "true"');
    expect(scene).toContain("private createDebugWorldOverlays");
    expect(scene).toContain("if (!GAME_DEBUG)");
    expect(scene).toContain("createDebugWorldOverlays();");
  });

  it("supports player chat bubbles without stealing text-entry keys", () => {
    const scene = read("src/game/TownScene.ts");
    const canvas = read("src/components/TownCanvas.tsx");
    const chat = read("src/components/TownChat.tsx");
    const api = read("src/lib/api.ts");
    const realtime = read("src/lib/realtime.ts");
    const migration = read("../../supabase/migrations/20260630000500_town_chat_servers.sql");
    const actions = read("../../supabase/functions/_shared/actions.ts");

    expect(canvas).toContain("chatBubbleText");
    expect(scene).toContain("syncPlayerChatBubble");
    expect(scene).toContain("showPlayerChatBubble");
    expect(scene).toContain("delay: 4500");
    expect(chat).toContain('data-game-input="text"');
    expect(chat).toContain("isEditableTarget(event.target)");
    expect(chat).toContain("input.focus()");
    expect(chat).toContain("blurActiveChatInput");
    expect(chat).toContain("optimisticMessages");
    expect(chat).toContain("setOptimisticMessages");
    expect(chat).toContain("chatSessionStartedAtMs");
    expect(chat).toContain("createdAtMs >= chatSessionStartedAtMs");
    expect(chat).toContain("refreshPresence");
    expect(chat).not.toContain('document.visibilityState === "hidden"');
    expect(realtime).toContain("PRESENCE_VISIBLE_UNTIL_MS");
    expect(realtime).toContain("parsed.data.sentAt < freshSince");
    expect(chat).toContain("players / {server.capacity} max");
    expect(chat).toContain("/ {activeServer?.capacity ?? TOWN_SERVER_CAPACITY} max");
    expect(chat).toContain("refetchInterval: realtimeOnline == null ? 5000 : 15000");
    expect(chat).toContain("queryClient.setQueryData<TownServersResponse>([\"town-servers\"]");
    expect(chat).toContain("if (realtimeOnline == null)");
    expect(chat).toContain("townServerIds");
    expect(chat).toContain("/api/town/server");
    expect(chat).toContain("/api/chat/message");
    expect(api).toContain(".select(\"player_id,town_channel,presence_status,last_seen_at\")");
    expect(api).toContain("playersByServer");
    expect(api).toContain(".eq(\"town_channel\", channel)");
    expect(api).toContain(".gte(\"last_seen_at\", freshSince)");
    expect(actions).toContain("TOWN_SERVER_CAPACITY = 40");
    expect(actions).toContain("TOWN_PRESENCE_STALE_AFTER_SECONDS = 20");
    expect(actions).toContain(".select(\"player_id,town_channel,last_seen_at\")");
    expect(actions).toContain("playersByServer");
    expect(actions).toContain(".gte(\"last_seen_at\", freshSince)");
    expect(actions).toContain("assertTownServerCapacity");
    expect(actions).toContain("\"select-town-server\": selectTownServer");
    expect(migration).toContain("chat_messages_town_channel_check");
    expect(migration).toContain("idx_chat_town_channel_created");
  });

  it("keeps one looping town music instance across panels and browser tab changes", () => {
    const app = read("src/App.tsx");
    const audio = read("src/lib/audio.ts");
    const manifest = read("../../packages/shared/src/uiAssetManifest.ts");

    expect(manifest).toContain('cozyVillage: "/assets/soltower/Starlight Vault Walk.mp3"');
    expect(audio).toContain('const key = "music:cozyVillage"');
    expect(audio).toContain("audio.loop = true");
    expect(audio).toContain("activeLoops.get(key)");
    expect(app).toContain("startTownMusic");
    expect(app).toContain("townMusicEnabled");
    expect(app).toContain("pauseTownMusic");
    expect(app).toContain("soltower:user-settings-changed");
    expect(app).not.toContain("document.visibilityState === \"visible\"");
  });
});
