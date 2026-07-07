import { useCallback, useEffect, useState } from "react";

export interface UserSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muteAll: boolean;
  muteMusic: boolean;
  muteSfx: boolean;
  reducedMotion: boolean;
  cameraFollow: boolean;
  cameraZoom: number;
  showRaidRanges: boolean;
  screenShake: boolean;
  largerText: boolean;
  highContrast: boolean;
  reducedParticles: boolean;
}

export const userSettingsStorageKey = "soltower:user-settings:v1";

export const defaultUserSettings: UserSettings = {
  masterVolume: 0.7,
  musicVolume: 0.45,
  sfxVolume: 0.75,
  muteAll: false,
  muteMusic: false,
  muteSfx: false,
  reducedMotion: false,
  cameraFollow: true,
  cameraZoom: 0.5,
  showRaidRanges: true,
  screenShake: true,
  largerText: false,
  highContrast: false,
  reducedParticles: false
};

export function loadUserSettings(): UserSettings {
  if (typeof window === "undefined") {
    return defaultUserSettings;
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(userSettingsStorageKey) ?? "{}") as Partial<UserSettings>;
    return normalizeSettings(parsed);
  } catch {
    return defaultUserSettings;
  }
}

export function saveUserSettings(settings: UserSettings): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(userSettingsStorageKey, JSON.stringify(normalizeSettings(settings)));
  window.dispatchEvent(new CustomEvent("soltower:user-settings-changed", { detail: settings }));
}

export function useUserSettings(): [UserSettings, (patch: Partial<UserSettings>) => void] {
  const [settings, setSettings] = useState<UserSettings>(() => loadUserSettings());

  useEffect(() => {
    applyDocumentSettings(settings);
    saveUserSettings(settings);
  }, [settings]);

  const update = useCallback((patch: Partial<UserSettings>) => {
    setSettings((current) => normalizeSettings({ ...current, ...patch }));
  }, []);

  return [settings, update];
}

export function applyDocumentSettings(settings: UserSettings): void {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.classList.toggle("larger-ui-text", settings.largerText);
  document.documentElement.classList.toggle("higher-contrast", settings.highContrast);
  document.documentElement.classList.toggle("reduced-particles", settings.reducedParticles);
  document.documentElement.classList.toggle("manual-reduced-motion", settings.reducedMotion);
}

function normalizeSettings(settings: Partial<UserSettings>): UserSettings {
  return {
    masterVolume: clamp(settings.masterVolume ?? defaultUserSettings.masterVolume),
    musicVolume: clamp(settings.musicVolume ?? defaultUserSettings.musicVolume),
    sfxVolume: clamp(settings.sfxVolume ?? defaultUserSettings.sfxVolume),
    muteAll: Boolean(settings.muteAll ?? defaultUserSettings.muteAll),
    muteMusic: Boolean(settings.muteMusic ?? defaultUserSettings.muteMusic),
    muteSfx: Boolean(settings.muteSfx ?? defaultUserSettings.muteSfx),
    reducedMotion: Boolean(settings.reducedMotion ?? defaultUserSettings.reducedMotion),
    cameraFollow: Boolean(settings.cameraFollow ?? defaultUserSettings.cameraFollow),
    cameraZoom: clamp(settings.cameraZoom ?? defaultUserSettings.cameraZoom),
    showRaidRanges: Boolean(settings.showRaidRanges ?? defaultUserSettings.showRaidRanges),
    screenShake: Boolean(settings.screenShake ?? defaultUserSettings.screenShake),
    largerText: Boolean(settings.largerText ?? defaultUserSettings.largerText),
    highContrast: Boolean(settings.highContrast ?? defaultUserSettings.highContrast),
    reducedParticles: Boolean(settings.reducedParticles ?? defaultUserSettings.reducedParticles)
  };
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}
