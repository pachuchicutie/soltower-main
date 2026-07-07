import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode
} from "react";
import { AlertTriangle, LoaderCircle, X } from "lucide-react";

type GameButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface GameButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GameButtonVariant;
}

export function GameButton({
  className = "",
  variant = "secondary",
  type = "button",
  ...props
}: GameButtonProps) {
  return (
    <button
      type={type}
      className={`game-button game-button-${variant} ${className}`.trim()}
      {...props}
    />
  );
}

export function AssetIcon({
  src,
  alt = "",
  className = "",
  decorative = true
}: {
  src: string;
  alt?: string;
  className?: string;
  decorative?: boolean;
}) {
  return (
    <img
      className={`asset-icon ${className}`.trim()}
      src={src}
      alt={decorative ? "" : alt}
      aria-hidden={decorative ? true : undefined}
      loading="lazy"
      decoding="async"
    />
  );
}

export function IconButton({
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`game-icon-button ${className}`.trim()}
      {...props}
    />
  );
}

interface GameModalProps extends HTMLAttributes<HTMLElement> {
  backdropClassName?: string;
  children: ReactNode;
}

export const GameModal = forwardRef<HTMLElement, GameModalProps>(function GameModal(
  { backdropClassName = "", className = "", children, ...props },
  ref
) {
  return (
    <div className={`game-modal-backdrop ${backdropClassName}`.trim()} role="presentation">
      <section ref={ref} className={`game-modal ${className}`.trim()} {...props}>
        {children}
      </section>
    </div>
  );
});

interface ModalHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  onClose: () => void;
  iconSrc?: string;
  iconAlt?: string;
  closeDisabled?: boolean;
  titleId: string;
  descriptionId?: string;
  closeLabel?: string;
}

export function ModalHeader({
  eyebrow,
  title,
  description,
  onClose,
  iconSrc,
  iconAlt,
  closeDisabled,
  titleId,
  descriptionId,
  closeLabel = "Close dialog"
}: ModalHeaderProps) {
  return (
    <header className={`game-modal-header ${iconSrc ? "has-icon" : ""}`}>
      {iconSrc ? (
        <div className="modal-icon-badge">
          <AssetIcon src={iconSrc} alt={iconAlt ?? title} decorative={!iconAlt} />
        </div>
      ) : null}
      <div className="game-modal-title-block">
        <span className="game-eyebrow">{eyebrow}</span>
        <h2 id={titleId}>{title}</h2>
        {description ? <p id={descriptionId}>{description}</p> : null}
      </div>
      <IconButton
        onClick={onClose}
        disabled={closeDisabled}
        aria-label={closeLabel}
        title="Close"
      >
        <X size={20} />
      </IconButton>
    </header>
  );
}

export function GameCard({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return (
    <article className={`game-card ${className}`.trim()} {...props}>
      {children}
    </article>
  );
}

export function ModalTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
  label
}: {
  tabs: Array<{ id: T; label: string; iconSrc?: string }>;
  activeTab: T;
  onChange: (tab: T) => void;
  label: string;
}) {
  return (
    <div className="modal-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          className={activeTab === tab.id ? "active" : ""}
          onClick={() => onChange(tab.id)}
        >
          {tab.iconSrc ? <AssetIcon src={tab.iconSrc} /> : null}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function StatRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <span className="stat-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </span>
  );
}

export function CurrencyChip({
  iconSrc,
  label,
  value,
  tone = "neutral"
}: {
  iconSrc: string;
  label: string;
  value?: ReactNode;
  tone?: "neutral" | "gold" | "blue";
}) {
  return (
    <span className={`currency-chip currency-chip-${tone}`}>
      <AssetIcon src={iconSrc} />
      <span>{label}</span>
      {value !== undefined ? <strong>{value}</strong> : null}
    </span>
  );
}

export function ItemCard({
  iconSrc,
  frameSrc,
  title,
  meta,
  children,
  className = ""
}: {
  iconSrc: string;
  frameSrc?: string;
  title: string;
  meta?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <article className={`item-card ${className}`.trim()}>
      <div className="item-icon-frame">
        <AssetIcon src={iconSrc} alt={title} decorative={false} />
        {frameSrc ? <AssetIcon src={frameSrc} className="rarity-frame" /> : null}
      </div>
      <div className="item-card-body">
        <strong>{title}</strong>
        {meta ? <small>{meta}</small> : null}
        {children}
      </div>
    </article>
  );
}

export function EmptyState({
  iconSrc,
  title,
  children
}: {
  iconSrc?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {iconSrc ? <AssetIcon src={iconSrc} /> : null}
      <strong>{title}</strong>
      {children ? <p>{children}</p> : null}
    </div>
  );
}

export function FeedList({
  entries,
  empty
}: {
  entries: Array<{ id: string; iconSrc?: string; title: string; detail: string; timestamp?: string }>;
  empty: ReactNode;
}) {
  if (!entries.length) {
    return <>{empty}</>;
  }
  return (
    <div className="feed-list">
      {entries.map((entry) => (
        <article key={entry.id} className="feed-entry">
          {entry.iconSrc ? <AssetIcon src={entry.iconSrc} /> : null}
          <div>
            <strong>{entry.title}</strong>
            <span>{entry.detail}</span>
          </div>
          {entry.timestamp ? <time>{entry.timestamp}</time> : null}
        </article>
      ))}
    </div>
  );
}

export function SettingsSlider({
  label,
  value,
  onChange,
  disabled = false
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="settings-slider">
      <span>
        {label}
        <strong>{Math.round(value * 100)}%</strong>
      </span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function ToggleRow({
  label,
  description,
  checked,
  onChange
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span>
        <strong>{label}</strong>
        {description ? <small>{description}</small> : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

export function ConfirmationDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="confirm-backdrop" role="presentation">
      <section className="confirmation-dialog" role="alertdialog" aria-modal="true">
        <strong>{title}</strong>
        <p>{description}</p>
        <div className="button-row">
          <GameButton variant="ghost" onClick={onCancel}>
            Cancel
          </GameButton>
          <GameButton variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </GameButton>
        </div>
      </section>
    </div>
  );
}

export function StatusPill({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: "neutral" | "dev" | "success";
}) {
  return <span className={`status-pill status-pill-${tone}`}>{children}</span>;
}

export function LoadingState({ children }: { children: ReactNode }) {
  return (
    <div className="inline-state inline-state-loading" role="status">
      <LoaderCircle className="spin" size={18} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export function ErrorState({
  children,
  title = "Could not open the village gate",
  action
}: {
  children: ReactNode;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <div className="inline-state inline-state-error" role="alert">
      <AlertTriangle size={18} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <span>{children}</span>
      </div>
      {action}
    </div>
  );
}
