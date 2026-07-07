import { uiAssetManifest } from "@soltower/shared";
import { loadUserSettings, type UserSettings } from "./userSettings";

type UiSound = keyof typeof uiAssetManifest.audio.ui;
type AmbienceTrack = keyof typeof uiAssetManifest.audio.ambience;

const activeLoops = new Map<string, HTMLAudioElement>();
const lastPlayedAt = new Map<UiSound, number>();

export function playUiSound(
  sound: UiSound,
  options: { volume?: number; throttleMs?: number } = {}
): void {
  if (typeof Audio === "undefined") {
    return;
  }
  const now = Date.now();
  const previous = lastPlayedAt.get(sound) ?? 0;
  if (options.throttleMs && now - previous < options.throttleMs) {
    return;
  }
  const settings = loadUserSettings();
  if (settings.muteAll || settings.muteSfx) {
    return;
  }
  const audio = new Audio(uiAssetManifest.audio.ui[sound]);
  if (
    typeof navigator !== "undefined" &&
    navigator.userAgent.toLowerCase().includes("jsdom") &&
    typeof HTMLMediaElement !== "undefined" &&
    audio.play === HTMLMediaElement.prototype.play
  ) {
    return;
  }
  audio.volume = clampVolume(effectiveSfxVolume(settings) * (options.volume ?? 1));
  lastPlayedAt.set(sound, now);
  try {
    const playback = audio.play();
    if (playback && typeof playback.catch === "function") {
      void playback.catch(() => {
        // Browser autoplay rules are expected until a trusted user interaction occurs.
      });
    }
  } catch {
    // Test browsers and some embedded views can expose Audio without playable media.
  }
}

export function playAmbience(track: AmbienceTrack): void {
  if (typeof Audio === "undefined") {
    return;
  }
  const key = `ambience:${track}`;
  const settings = loadUserSettings();
  let audio = activeLoops.get(key);
  if (!audio) {
    audio = new Audio(uiAssetManifest.audio.ambience[track]);
    audio.loop = true;
    audio.preload = "auto";
    activeLoops.set(key, audio);
  }
  applyAudioSettings(settings);
  if (settings.muteAll || settings.muteMusic) {
    return;
  }
  void audio.play().catch(() => {
    // Autoplay policies may reject until the user asks for an audio preview.
  });
}

export async function startTownMusic(): Promise<boolean> {
  if (typeof Audio === "undefined") {
    return false;
  }
  const key = "music:cozyVillage";
  const settings = loadUserSettings();
  let audio = activeLoops.get(key);
  if (!audio) {
    audio = new Audio(uiAssetManifest.audio.music.cozyVillage);
    audio.loop = true;
    audio.preload = "auto";
    activeLoops.set(key, audio);
  }
  if (
    typeof navigator !== "undefined" &&
    navigator.userAgent.toLowerCase().includes("jsdom") &&
    typeof HTMLMediaElement !== "undefined" &&
    audio.play === HTMLMediaElement.prototype.play
  ) {
    return false;
  }
  applyAudioSettings(settings);
  if (settings.muteAll || settings.muteMusic) {
    return false;
  }
  if (!audio.paused) {
    return true;
  }
  try {
    await audio.play();
    return true;
  } catch {
    // Autoplay policies may reject until the player next clicks or presses a key.
    return false;
  }
}

export function playMusic(): void {
  void startTownMusic();
}

export function pauseTownMusic(): void {
  activeLoops.get("music:cozyVillage")?.pause();
}

export function applyAudioSettings(settings: UserSettings = loadUserSettings()): void {
  for (const [key, audio] of activeLoops) {
    const musicOrAmbience = key.startsWith("music:") || key.startsWith("ambience:");
    audio.muted = settings.muteAll || (musicOrAmbience ? settings.muteMusic : settings.muteSfx);
    audio.volume = musicOrAmbience ? effectiveMusicVolume(settings) : effectiveSfxVolume(settings);
  }
}

export function stopAudioPreviews(): void {
  for (const audio of activeLoops.values()) {
    audio.pause();
    audio.currentTime = 0;
  }
}

function effectiveSfxVolume(settings: UserSettings): number {
  return settings.masterVolume * settings.sfxVolume;
}

function effectiveMusicVolume(settings: UserSettings): number {
  return settings.masterVolume * settings.musicVolume;
}

function clampVolume(value: number): number {
  return Math.max(0, Math.min(1, value));
}
