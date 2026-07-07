import {
  heroAssetManifest,
  normalizeHeroAppearance,
  normalizeHeroId,
  type HeroAppearance
} from "@soltower/shared";

type PreviewSize = "icon" | "portrait";

export function HeroAppearancePreview({
  heroId,
  appearance,
  size = "icon",
  className = "",
  label
}: {
  heroId: string | null | undefined;
  appearance?: Partial<HeroAppearance> | null;
  size?: PreviewSize;
  className?: string;
  label?: string;
}) {
  const normalizedHeroId = normalizeHeroId(heroId);
  const entry = heroAssetManifest[normalizedHeroId];
  const normalizedAppearance = normalizeHeroAppearance(normalizedHeroId, appearance);
  const basePath = size === "portrait" ? entry.portraitPath : entry.previewIconPath;
  const dimensionClass = size === "portrait" ? "hero-preview-portrait" : "hero-preview-icon";

  return (
    <span
      className={`hero-appearance-preview ${dimensionClass} ${className}`.trim()}
      role={label ? "img" : undefined}
      aria-label={label}
      data-hero-id={normalizedHeroId}
      data-hair-style={normalizedAppearance.hairStyle}
      data-outfit-variant={normalizedAppearance.outfitVariant}
      data-back-accessory={normalizedAppearance.backAccessory}
    >
      <img src={basePath} alt="" aria-hidden="true" loading="lazy" decoding="async" />
    </span>
  );
}
