import type { HTMLAttributes, ReactNode } from "react";

export interface ShortcutGroupDefinition {
  keys: string[];
  label: string;
}

export const townShortcutGroups: ShortcutGroupDefinition[] = [
  { keys: ["W", "A", "S", "D"], label: "Move" },
  { keys: ["Shift"], label: "Run" },
  { keys: ["E"], label: "Interact" },
  { keys: ["I"], label: "Inventory" },
  { keys: ["Q"], label: "Quests" }
];

interface KeycapProps {
  children: ReactNode;
}

export function Keycap({ children }: KeycapProps) {
  return <kbd className="shortcut-keycap">{children}</kbd>;
}

interface ShortcutGroupProps {
  group: ShortcutGroupDefinition;
}

export function ShortcutGroup({ group }: ShortcutGroupProps) {
  return (
    <span className="shortcut-group">
      <span className="shortcut-key-row">
        {group.keys.map((key) => (
          <Keycap key={key}>{key}</Keycap>
        ))}
      </span>
      <span className="shortcut-label">{group.label}</span>
    </span>
  );
}

interface ShortcutHintProps extends HTMLAttributes<HTMLDivElement> {
  groups?: ShortcutGroupDefinition[];
  decorative?: boolean;
}

export function ShortcutHint({
  groups = townShortcutGroups,
  className = "",
  decorative = false,
  ...props
}: ShortcutHintProps) {
  return (
    <div
      className={`shortcut-hint ${className}`.trim()}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : "Keyboard shortcuts"}
      {...props}
    >
      {groups.map((group, index) => (
        <span className="shortcut-group-wrap" key={group.label}>
          {index > 0 ? <span className="shortcut-separator" aria-hidden="true" /> : null}
          <ShortcutGroup group={group} />
        </span>
      ))}
    </div>
  );
}
