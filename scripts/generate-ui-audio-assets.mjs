import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const publicRoot = join(root, "apps/web/public");

const uiIcons = {
  inventory: { accent: "#f3c969", motif: "bag" },
  quests: { accent: "#77d4f2", motif: "scroll" },
  settings: { accent: "#a78bfa", motif: "gear" },
  market: { accent: "#f3c969", motif: "scales" },
  "hero-loadout": { accent: "#77d4f2", motif: "helm" },
  close: { accent: "#ff9a9a", motif: "x" },
  back: { accent: "#77d4f2", motif: "arrow-left" },
  buy: { accent: "#72d49b", motif: "coin-plus" },
  sell: { accent: "#f3c969", motif: "coin-up" },
  history: { accent: "#aab7c8", motif: "clock" },
  feed: { accent: "#77d4f2", motif: "spark-lines" },
  timer: { accent: "#f3c969", motif: "hourglass" },
  claim: { accent: "#72d49b", motif: "check" },
  sound: { accent: "#77d4f2", motif: "speaker" },
  music: { accent: "#a78bfa", motif: "note" },
  mute: { accent: "#ff9a9a", motif: "mute" },
  logout: { accent: "#ff9a9a", motif: "door" },
  disconnect: { accent: "#f3c969", motif: "broken-link" },
  wallet: { accent: "#77d4f2", motif: "wallet" },
  copy: { accent: "#aab7c8", motif: "copy" },
  party: { accent: "#72d49b", motif: "party" },
  achievement: { accent: "#f3c969", motif: "medal" },
  "mail-notifications": { accent: "#77d4f2", motif: "mail" }
};

const currencies = {
  "earned-gold": { accent: "#f3c969", motif: "earned-gold" },
  "locked-gold": { accent: "#f3c969", motif: "locked-gold" },
  "tower-token": { accent: "#77d4f2", motif: "tower-token" }
};

const heroes = {
  "storm-archer": { accent: "#7dd3fc", motif: "storm-archer" },
  "tide-mage": { accent: "#38bdf8", motif: "tide-mage" },
  bombardier: { accent: "#fb923c", motif: "bombardier" },
  "coral-alchemist": { accent: "#34d399", motif: "coral-alchemist" },
  starcaller: { accent: "#facc15", motif: "starcaller" }
};

const items = {
  "basic-bow": { accent: "#9ca3af", motif: "bow" },
  "basic-armor": { accent: "#9ca3af", motif: "armor" },
  "basic-relic": { accent: "#9ca3af", motif: "relic" },
  "basic-charm": { accent: "#9ca3af", motif: "charm" },
  "repair-kit": { accent: "#72d49b", motif: "repair-kit" },
  "mana-tonic": { accent: "#77d4f2", motif: "mana-tonic" },
  "scout-flare": { accent: "#f3c969", motif: "scout-flare" },
  "revive-feather": { accent: "#fff7df", motif: "revive-feather" },
  "treasure-compass": { accent: "#f3c969", motif: "treasure-compass" },
  "tower-shard": { accent: "#77d4f2", motif: "tower-shard" },
  "moss-thread": { accent: "#72d49b", motif: "moss-thread" },
  "ember-core": { accent: "#fb923c", motif: "ember-core" },
  "tidal-pearl": { accent: "#38bdf8", motif: "tidal-pearl" },
  "starlit-dust": { accent: "#facc15", motif: "starlit-dust" }
};

const rarityFrames = {
  common: "#9ca3af",
  uncommon: "#22c55e",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f97316"
};

for (const [name, spec] of Object.entries(uiIcons)) {
  writeSvg(`assets/ui/icons/${name}.svg`, iconSvg(spec));
}
for (const [name, spec] of Object.entries(currencies)) {
  writeSvg(`assets/currencies/${name}.svg`, iconSvg(spec));
}
for (const [name, spec] of Object.entries(heroes)) {
  writeSvg(`assets/heroes/icons/${name}.svg`, iconSvg(spec));
}
for (const [name, spec] of Object.entries(items)) {
  writeSvg(`assets/items/${name}.svg`, iconSvg(spec));
}
for (const [name, accent] of Object.entries(rarityFrames)) {
  writeSvg(`assets/items/frames/${name}.svg`, rarityFrameSvg(accent));
}

writeFile(
  "assets/ui/source/generated-asset-notes.md",
  `# SolTower Generated UI Asset Notes

These SVG and WAV assets were generated locally by \`scripts/generate-ui-audio-assets.mjs\`.

- Style: original dark-glass fantasy HUD icons with gold and blue magical accents.
- Format: transparent-background SVG for UI/item/currency/hero icons.
- Audio: original synthesized WAV tones/loops generated from simple oscillators and deterministic noise.
- No external copyrighted art, music packs, sound packs, or icon packs were used.
`
);

const uiSounds = {
  click: [[523.25, 0.08, 0.32], [783.99, 0.06, 0.16]],
  hover: [[659.25, 0.07, 0.18]],
  "open-modal": [[392.0, 0.12, 0.2], [587.33, 0.2, 0.22], [783.99, 0.16, 0.18]],
  "close-modal": [[659.25, 0.1, 0.2], [493.88, 0.12, 0.18], [329.63, 0.12, 0.12]],
  "tab-switch": [[587.33, 0.05, 0.2], [880.0, 0.08, 0.14]],
  success: [[523.25, 0.1, 0.22], [659.25, 0.12, 0.22], [880.0, 0.16, 0.2]],
  warning: [[220.0, 0.12, 0.24], [185.0, 0.14, 0.2]],
  "quest-claim": [[440.0, 0.1, 0.2], [659.25, 0.16, 0.26], [987.77, 0.24, 0.18]],
  "market-listing-created": [[329.63, 0.08, 0.2], [493.88, 0.12, 0.22], [659.25, 0.12, 0.18]],
  "market-sale-completed": [[392.0, 0.1, 0.2], [587.33, 0.14, 0.24], [783.99, 0.18, 0.18]],
  "blackjack-card": [[1567.98, 0.035, 0.12], [1174.66, 0.045, 0.1]],
  "blackjack-deal": [[440.0, 0.055, 0.18], [739.99, 0.055, 0.16], [987.77, 0.07, 0.12]],
  "blackjack-hit": [[783.99, 0.04, 0.18], [1046.5, 0.055, 0.12]],
  "blackjack-stand": [[392.0, 0.08, 0.2], [523.25, 0.1, 0.14]],
  "blackjack-double-down": [[329.63, 0.06, 0.24], [659.25, 0.08, 0.22], [1318.51, 0.12, 0.16]],
  "blackjack-win": [[523.25, 0.08, 0.24], [659.25, 0.1, 0.24], [783.99, 0.12, 0.22], [1046.5, 0.2, 0.18]],
  "blackjack-lose": [[329.63, 0.1, 0.22], [277.18, 0.12, 0.18], [220.0, 0.18, 0.14]],
  "blackjack-push": [[493.88, 0.08, 0.18], [493.88, 0.08, 0.12]],
  "interaction-open": [[587.33, 0.06, 0.2], [880.0, 0.11, 0.16]],
  "interaction-nearby": [[1174.66, 0.05, 0.1], [1567.98, 0.06, 0.08]],
  "npc-talk": [[659.25, 0.055, 0.15], [739.99, 0.055, 0.12], [659.25, 0.06, 0.1]],
  "structure-open": [[246.94, 0.09, 0.18], [493.88, 0.13, 0.2], [739.99, 0.12, 0.16]],
  "raid-start": [[196.0, 0.1, 0.28], [392.0, 0.12, 0.24], [783.99, 0.18, 0.2]],
  "raid-hit": [[146.83, 0.035, 0.28], [220.0, 0.045, 0.18]],
  "raid-damage": [[185.0, 0.07, 0.24], [123.47, 0.09, 0.18]],
  "raid-win": [[392.0, 0.09, 0.24], [587.33, 0.12, 0.24], [880.0, 0.18, 0.2], [1174.66, 0.2, 0.14]],
  "raid-lose": [[261.63, 0.12, 0.22], [196.0, 0.14, 0.18], [146.83, 0.2, 0.14]],
  "footstep-walk": [[98.0, 0.035, 0.18], [130.81, 0.025, 0.1]],
  "footstep-run": [[110.0, 0.028, 0.2], [164.81, 0.022, 0.12]]
};

for (const [name, notes] of Object.entries(uiSounds)) {
  writeWav(`assets/audio/ui/${name}.wav`, synthNotes(notes, 22050));
}

writeWav("assets/audio/ambience/soft-village-ambience-loop.wav", synthLoop(10, "village"));
writeWav("assets/audio/ambience/fountain-wind-ambience-loop.wav", synthLoop(10, "fountain"));
writeWav("assets/audio/music/cozy-fantasy-village-loop.wav", synthLoop(16, "music"));

function writeSvg(relativePath, svg) {
  writeFile(relativePath, svg.trim() + "\n");
}

function writeWav(relativePath, buffer) {
  const path = join(publicRoot, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buffer);
}

function writeFile(relativePath, contents) {
  const path = join(publicRoot, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function iconSvg({ accent, motif }) {
  const id = motif.replace(/[^a-z0-9]/gi, "-");
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" role="img" aria-label="${motif}">
  <defs>
    <linearGradient id="bg-${id}" x1="12" y1="8" x2="52" y2="58" gradientUnits="userSpaceOnUse">
      <stop stop-color="#1f3147" stop-opacity=".98"/>
      <stop offset="1" stop-color="#070d17" stop-opacity=".98"/>
    </linearGradient>
    <radialGradient id="glow-${id}" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(33 29) rotate(90) scale(28)">
      <stop stop-color="${accent}" stop-opacity=".32"/>
      <stop offset=".72" stop-color="${accent}" stop-opacity=".06"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft-${id}" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#020711" flood-opacity=".58"/>
      <feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="${accent}" flood-opacity=".42"/>
    </filter>
  </defs>
  <rect x="6" y="6" width="52" height="52" rx="12" fill="url(#bg-${id})" stroke="${accent}" stroke-opacity=".72" stroke-width="2"/>
  <rect x="9" y="9" width="46" height="46" rx="9" fill="url(#glow-${id})"/>
  <path d="M15 18C23 11 41 11 49 18" stroke="#fff7df" stroke-opacity=".18" stroke-width="2" stroke-linecap="round"/>
  <g filter="url(#soft-${id})" stroke="${accent}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    ${motifPath(motif)}
  </g>
  <path d="M18 50C27 54 38 54 47 49" stroke="#fff7df" stroke-opacity=".12" stroke-width="2" stroke-linecap="round"/>
</svg>`;
}

function motifPath(motif) {
  const paths = {
    bag: '<path d="M22 27h20l-2 18H24l-2-18Z"/><path d="M26 27c0-7 12-7 12 0"/><path d="M28 35h8"/>',
    scroll: '<path d="M21 18h19c4 0 4 7 0 7H24c-5 0-5-7 0-7"/><path d="M24 25v20h18"/><path d="M29 32h10M29 38h8"/>',
    gear: '<path d="M32 20v-5M32 49v-5M20 32h-5M49 32h-5M23 23l-4-4M45 45l-4-4M41 23l4-4M19 45l4-4"/><circle cx="32" cy="32" r="9"/>',
    scales: '<path d="M32 17v30M22 22h20M22 22l-7 14h14l-7-14ZM42 22l-7 14h14l-7-14Z"/><path d="M25 47h14"/>',
    helm: '<path d="M20 39V27c0-8 24-8 24 0v12"/><path d="M24 42h16M25 29h14M32 22v21"/>',
    x: '<path d="M23 23l18 18M41 23 23 41"/>',
    "arrow-left": '<path d="M42 32H22M30 22 20 32l10 10"/>',
    "coin-plus": '<circle cx="29" cy="34" r="12"/><path d="M45 21v12M39 27h12"/><path d="M25 34h8"/>',
    "coin-up": '<circle cx="32" cy="37" r="12"/><path d="M32 28v18M25 34l7-7 7 7"/>',
    clock: '<circle cx="32" cy="32" r="15"/><path d="M32 22v11l8 5"/>',
    "spark-lines": '<path d="M18 42h28M18 32h24M18 22h28"/><path d="M48 20l2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4Z"/>',
    hourglass: '<path d="M23 17h18M23 47h18M26 17c0 8 12 8 12 15S26 39 26 47M38 17c0 8-12 8-12 15s12 7 12 15"/>',
    check: '<path d="M19 33l8 8 19-21"/>',
    speaker: '<path d="M18 37h8l12 9V18L26 27h-8v10Z"/><path d="M43 27c3 3 3 7 0 10"/>',
    note: '<path d="M27 43V18l18-4v24"/><circle cx="22" cy="43" r="6"/><circle cx="40" cy="38" r="6"/>',
    mute: '<path d="M18 37h8l12 9V18L26 27h-8v10Z"/><path d="M44 28l8 8M52 28l-8 8"/>',
    door: '<path d="M23 17h15v30H23z"/><path d="M38 32h12M45 25l7 7-7 7"/><path d="M29 32h.1"/>',
    "broken-link": '<path d="M24 25l-5 5c-4 4-1 11 5 11h5M40 39l5-5c4-4 1-11-5-11h-5M28 32h8M18 18l8 8M38 38l8 8"/>',
    wallet: '<path d="M18 24h27v20H20c-4 0-6-2-6-6V25c0-4 2-6 6-6h22v5"/><path d="M41 31h8v8h-8c-6 0-6-8 0-8Z"/>',
    copy: '<path d="M22 22h21v21H22z"/><path d="M17 35V17h18"/>',
    party: '<path d="M19 45l11-27 16 16-27 11Z"/><path d="M35 18l3-5M43 26l6-2M27 30l8 8M25 38l5 5"/>',
    medal: '<path d="M25 16l7 10 7-10"/><circle cx="32" cy="38" r="11"/><path d="M32 33l2 4 5 .5-3.6 3 1 5-4.4-2.5-4.4 2.5 1-5-3.6-3 5-.5 2-4Z"/>',
    mail: '<path d="M18 22h28v20H18z"/><path d="M18 24l14 11 14-11"/>',
    "earned-gold": '<circle cx="32" cy="32" r="15"/><path d="M25 32h14M32 23v18M23 25c6 5 12 5 18 0"/>',
    "locked-gold": '<circle cx="32" cy="35" r="13"/><path d="M24 30v-5c0-9 16-9 16 0v5"/><path d="M32 35v6"/>',
    "tower-token": '<path d="M22 47h20M25 47l3-27h8l3 27M22 27h20M29 18h6"/><path d="M32 24v20"/>',
    "storm-archer": '<path d="M20 45c15-8 24-21 24-28"/><path d="M43 17c-11 2-21 12-23 28"/><path d="M28 31l15 14M41 17l-5 12"/><path d="M45 19l-11 4"/>',
    "tide-mage": '<path d="M18 39c9 7 19-7 28 0M18 30c9 7 19-7 28 0"/><path d="M32 17c7 8 7 17 0 26-7-9-7-18 0-26Z"/>',
    bombardier: '<path d="M25 39l14-14M25 25l14 14"/><circle cx="32" cy="32" r="12"/><path d="M43 21l4-7M47 14l3 3"/>',
    "coral-alchemist": '<path d="M24 44h16M27 44l3-20h4l3 20"/><path d="M24 23h16"/><path d="M19 36c6-3 5-11 13-11s7 8 13 11"/>',
    starcaller: '<path d="M32 16l4 11 11 4-11 4-4 11-4-11-11-4 11-4 4-11Z"/><path d="M45 18l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z"/>',
    bow: '<path d="M21 48c14-8 22-24 22-33"/><path d="M43 15C31 21 23 35 21 48"/><path d="M21 48l26-30"/><path d="M30 31l13 12"/>',
    armor: '<path d="M22 21l10-5 10 5v9c0 9-4 15-10 18-6-3-10-9-10-18v-9Z"/><path d="M32 20v25M24 30h16"/>',
    relic: '<path d="M32 17l13 12-13 18-13-18 13-12Z"/><path d="M24 29h16M32 17v30"/>',
    charm: '<path d="M32 20c9-8 20 5 0 23C12 25 23 12 32 20Z"/><path d="M32 24v12"/>',
    "repair-kit": '<path d="M21 27h22v18H21z"/><path d="M26 27v-5h12v5M32 32v8M28 36h8"/>',
    "mana-tonic": '<path d="M27 18h10M29 18v8l-8 14c-2 4 1 7 5 7h12c4 0 7-3 5-7l-8-14v-8"/><path d="M24 39h16"/>',
    "scout-flare": '<path d="M21 45l22-22M31 23l10-4 4 4-4 10"/><path d="M20 23l6 6M42 42l-6-6"/>',
    "revive-feather": '<path d="M21 46c14-2 24-13 25-29-15 1-26 11-29 27"/><path d="M24 39c7-5 12-11 17-18"/>',
    "treasure-compass": '<circle cx="32" cy="32" r="15"/><path d="M38 23l-4 13-8 5 4-13 8-5Z"/>',
    "tower-shard": '<path d="M32 16l13 31H19l13-31Z"/><path d="M32 16v31M24 35h16"/>',
    "moss-thread": '<path d="M18 39c10-20 26-19 28-5"/><path d="M22 43c9-15 21-13 24 2"/><path d="M27 27c-2-8 8-10 10-2"/>',
    "ember-core": '<path d="M32 49c-10-6-9-16-3-23 2-3 3-6 2-10 9 6 16 18 7 27"/><path d="M31 45c-4-5-3-10 3-15 4 5 5 11-3 15Z"/>',
    "tidal-pearl": '<circle cx="32" cy="34" r="13"/><path d="M21 30c6-10 16-10 22 0"/><path d="M24 38c6 4 11 4 16 0"/>',
    "starlit-dust": '<path d="M32 18l3 9 9 3-9 3-3 9-3-9-9-3 9-3 3-9Z"/><path d="M46 40l1 4 4 1-4 1-1 4-1-4-4-1 4-1 1-4Z"/>'
  };
  return paths[motif] ?? paths.bag;
}

function rarityFrameSvg(accent) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">
  <rect x="5" y="5" width="54" height="54" rx="12" stroke="${accent}" stroke-width="2.5"/>
  <path d="M12 18C21 10 43 10 52 18" stroke="#fff7df" stroke-opacity=".22" stroke-width="2" stroke-linecap="round"/>
  <path d="M10 46c12 7 32 7 44 0" stroke="${accent}" stroke-opacity=".42" stroke-width="2" stroke-linecap="round"/>
</svg>`;
}

function synthNotes(notes, sampleRate) {
  const gap = 0.018;
  const duration = notes.reduce((sum, [, seconds]) => sum + seconds + gap, 0) + 0.04;
  const samples = Math.ceil(duration * sampleRate);
  const data = new Float32Array(samples);
  let cursor = 0;
  for (const [freq, seconds, gain] of notes) {
    const length = Math.ceil(seconds * sampleRate);
    for (let i = 0; i < length && cursor + i < samples; i += 1) {
      const t = i / sampleRate;
      const env = Math.sin(Math.PI * (i / length)) ** 0.65;
      data[cursor + i] += Math.sin(2 * Math.PI * freq * t) * gain * env;
      data[cursor + i] += Math.sin(2 * Math.PI * freq * 2 * t) * gain * 0.18 * env;
    }
    cursor += length + Math.ceil(gap * sampleRate);
  }
  return wavFromFloat(data, sampleRate);
}

function synthLoop(seconds, kind) {
  const sampleRate = 22050;
  const samples = Math.ceil(seconds * sampleRate);
  const data = new Float32Array(samples);
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed / 0xffffffff) * 2 - 1;
  };
  for (let i = 0; i < samples; i += 1) {
    const t = i / sampleRate;
    const loopFade = Math.sin(Math.PI * (i / samples));
    if (kind === "music") {
      const chords = [
        [261.63, 329.63, 392.0],
        [293.66, 349.23, 440.0],
        [220.0, 329.63, 392.0],
        [246.94, 311.13, 392.0]
      ];
      const chord = chords[Math.floor((t / 4) % chords.length)];
      data[i] =
        chord.reduce((sum, freq) => sum + Math.sin(2 * Math.PI * freq * t) * 0.035, 0) +
        Math.sin(2 * Math.PI * 1046.5 * t) * 0.01 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.5 * t));
    } else if (kind === "fountain") {
      data[i] =
        rand() * 0.025 * loopFade +
        Math.sin(2 * Math.PI * 146.83 * t) * 0.025 +
        Math.sin(2 * Math.PI * 0.18 * t) * 0.035;
    } else {
      data[i] =
        rand() * 0.014 * loopFade +
        Math.sin(2 * Math.PI * 174.61 * t) * 0.025 +
        Math.sin(2 * Math.PI * 293.66 * t) * 0.018 +
        Math.sin(2 * Math.PI * 0.11 * t) * 0.03;
    }
  }
  return wavFromFloat(data, sampleRate);
}

function wavFromFloat(floatData, sampleRate) {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const buffer = Buffer.alloc(44 + floatData.length * bytesPerSample);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + floatData.length * bytesPerSample, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(floatData.length * bytesPerSample, 40);
  for (let i = 0; i < floatData.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, floatData[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * bytesPerSample);
  }
  return buffer;
}
