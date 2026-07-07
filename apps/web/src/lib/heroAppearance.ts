import {
  defaultHeroAppearance,
  normalizeHeroAppearance,
  normalizeHeroId,
  type HeroAppearance,
  type HeroId
} from "@soltower/shared";
import { useCallback, useEffect, useState } from "react";

export const heroAppearanceStorageKey = "soltower:hero-appearance:v1";
const heroAppearanceEvent = "soltower:hero-appearance";

type StoredAppearances = Partial<Record<HeroId, Partial<HeroAppearance>>>;

export function loadHeroAppearance(heroId: string | null | undefined): HeroAppearance {
  const normalizedHeroId = normalizeHeroId(heroId);
  if (typeof window === "undefined") {
    return defaultHeroAppearance(normalizedHeroId);
  }
  try {
    const stored = JSON.parse(window.localStorage.getItem(heroAppearanceStorageKey) ?? "{}") as StoredAppearances;
    return normalizeHeroAppearance(normalizedHeroId, stored[normalizedHeroId]);
  } catch {
    return defaultHeroAppearance(normalizedHeroId);
  }
}

export function saveHeroAppearance(heroId: string | null | undefined, appearance: HeroAppearance): void {
  if (typeof window === "undefined") {
    return;
  }
  const normalizedHeroId = normalizeHeroId(heroId);
  const normalizedAppearance = normalizeHeroAppearance(normalizedHeroId, appearance);
  const stored = readStoredAppearances();
  stored[normalizedHeroId] = normalizedAppearance;
  window.localStorage.setItem(heroAppearanceStorageKey, JSON.stringify(stored));
  window.dispatchEvent(
    new CustomEvent(heroAppearanceEvent, {
      detail: { heroId: normalizedHeroId, appearance: normalizedAppearance }
    })
  );
}

export function useHeroAppearance(heroId: string | null | undefined): [
  HeroAppearance,
  (patch: Partial<HeroAppearance>) => void
] {
  const normalizedHeroId = normalizeHeroId(heroId);
  const [appearance, setAppearance] = useState<HeroAppearance>(() => loadHeroAppearance(normalizedHeroId));

  useEffect(() => {
    setAppearance(loadHeroAppearance(normalizedHeroId));
  }, [normalizedHeroId]);

  useEffect(() => {
    const onAppearanceChange = (event: Event) => {
      const detail = (event as CustomEvent<{ heroId?: string }>).detail;
      if (!detail?.heroId || detail.heroId === normalizedHeroId) {
        setAppearance(loadHeroAppearance(normalizedHeroId));
      }
    };
    window.addEventListener(heroAppearanceEvent, onAppearanceChange);
    window.addEventListener("storage", onAppearanceChange);
    return () => {
      window.removeEventListener(heroAppearanceEvent, onAppearanceChange);
      window.removeEventListener("storage", onAppearanceChange);
    };
  }, [normalizedHeroId]);

  const updateAppearance = useCallback(
    (patch: Partial<HeroAppearance>) => {
      const next = normalizeHeroAppearance(normalizedHeroId, { ...loadHeroAppearance(normalizedHeroId), ...patch });
      saveHeroAppearance(normalizedHeroId, next);
      setAppearance(next);
    },
    [normalizedHeroId]
  );

  return [appearance, updateAppearance];
}

function readStoredAppearances(): StoredAppearances {
  try {
    return JSON.parse(window.localStorage.getItem(heroAppearanceStorageKey) ?? "{}") as StoredAppearances;
  } catch {
    return {};
  }
}
