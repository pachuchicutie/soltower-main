import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, DoorOpen, MessageCircle, Send, Server, Users, X } from "lucide-react";
import {
  TOWN_PRESENCE_STALE_AFTER_SECONDS,
  TOWN_SERVER_CAPACITY,
  townServerIds,
  type TownServerId
} from "@soltower/shared";
import { apiGet, apiPost } from "../lib/api";
import { isEditableTarget } from "../lib/gameInput";
import { GameModal } from "./ui/GameUi";

interface TownChatMessage {
  id: string;
  channel: string;
  townChannel?: string;
  fromPlayerId: string | null;
  message: string;
  createdAt: string;
}

interface TownChatResponse {
  messages: TownChatMessage[];
}

interface TownServerStatus {
  id: TownServerId;
  label: string;
  online: number;
  capacity: number;
  isFull: boolean;
}

interface TownServersResponse {
  servers: TownServerStatus[];
}

interface SendChatResponse {
  message: TownChatMessage;
}

interface SelectTownServerResponse {
  townChannel: TownServerId;
  servers: TownServerStatus[];
}

interface TownChatProps {
  playerId: string;
  displayName: string;
  townChannel: TownServerId;
  realtimeOnline?: number | null;
  realtimeConnected?: boolean;
  mobileOpen: boolean;
  keyboardEnabled?: boolean;
  onTownChannelChange: (townChannel: TownServerId) => void;
  onMobileClose: () => void;
  onLocalMessageSent: (message: { id: string; text: string }) => void;
}

export function TownChat({
  playerId,
  displayName,
  townChannel,
  realtimeOnline,
  mobileOpen,
  keyboardEnabled = true,
  onTownChannelChange,
  onMobileClose,
  onLocalMessageSent
}: TownChatProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<TownChatMessage[]>([]);
  const [chatSessionStartedAtMs] = useState(() => Date.now());

  const servers = useQuery({
    queryKey: ["town-servers"],
    queryFn: () => apiGet<TownServersResponse>("/api/town/servers"),
    refetchInterval: realtimeOnline == null ? 5000 : 15000,
    staleTime: 2500
  });
  const chat = useQuery({
    queryKey: ["chat", townChannel],
    queryFn: () => apiGet<TownChatResponse>(`/api/chat/recent?townChannel=${townChannel}`),
    refetchInterval: 3500
  });
  const serverList = useMemo(() => {
    const list =
      servers.data?.servers ??
      townServerIds.map((id, index) => ({
        id,
        label: `SolBloom ${index + 1}`,
        online: 0,
        capacity: TOWN_SERVER_CAPACITY,
        isFull: false
      }));
    if (realtimeOnline == null) {
      return list;
    }
    return list.map((server) =>
      server.id === townChannel
        ? {
            ...server,
            online: realtimeOnline,
            isFull: realtimeOnline >= server.capacity
          }
        : server
    );
  }, [
    realtimeOnline,
    servers.data?.servers,
    townChannel
  ]);

  useEffect(() => {
    if (realtimeOnline == null) {
      return;
    }
    queryClient.setQueryData<TownServersResponse>(["town-servers"], (previous) => {
      const currentServers =
        previous?.servers ??
        townServerIds.map((id, index) => ({
          id,
          label: `SolBloom ${index + 1}`,
          online: 0,
          capacity: TOWN_SERVER_CAPACITY,
          isFull: false
        }));
      return {
        servers: currentServers.map((server) =>
          server.id === townChannel
            ? {
                ...server,
                online: realtimeOnline,
                isFull: realtimeOnline >= server.capacity
              }
            : server
        )
      };
    });
  }, [queryClient, realtimeOnline, townChannel]);
  const visibleMessages = useMemo(() => {
    const confirmedMessages = (chat.data?.messages ?? []).filter((message) => {
      const createdAtMs = Date.parse(message.createdAt);
      return Number.isFinite(createdAtMs) && createdAtMs >= chatSessionStartedAtMs;
    });
    const confirmedIds = new Set(confirmedMessages.map((message) => message.id));
    return [
      ...confirmedMessages,
      ...optimisticMessages.filter((message) => message.townChannel === townChannel && !confirmedIds.has(message.id))
    ].slice(-10);
  }, [chat.data?.messages, chatSessionStartedAtMs, optimisticMessages, townChannel]);

  useEffect(() => {
    let cancelled = false;

    const refreshPresence = () => {
      Promise.resolve()
        .then(() => apiPost<SelectTownServerResponse>("/api/town/server", { townChannel }))
        .then((data) => {
          if (cancelled || !data?.servers) {
            return;
          }
          queryClient.setQueryData(["town-servers"], { servers: data.servers });
        })
        .catch(() => undefined);
    };

    refreshPresence();
    const heartbeatMs = Math.max(5000, Math.floor((TOWN_PRESENCE_STALE_AFTER_SECONDS * 1000) / 3));
    const interval = window.setInterval(refreshPresence, heartbeatMs);
    const onVisibilityChange = () => {
      refreshPresence();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [queryClient, townChannel]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        !keyboardEnabled ||
        event.defaultPrevented ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.key !== "Enter" ||
        isEditableTarget(event.target)
      ) {
        return;
      }
      const selector = mobileOpen
        ? ".town-chat-modal .town-chat-form input"
        : ".town-chat-panel .town-chat-form input";
      const input = document.querySelector<HTMLInputElement>(selector);
      if (!input) {
        return;
      }
      event.preventDefault();
      input.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [keyboardEnabled, mobileOpen]);

  const selectServer = useMutation({
    mutationFn: (nextTownChannel: TownServerId) =>
      apiPost<SelectTownServerResponse>("/api/town/server", { townChannel: nextTownChannel }),
    onSuccess: async (data) => {
      setError(null);
      onTownChannelChange(data.townChannel);
      queryClient.setQueryData(["town-servers"], { servers: data.servers });
      await queryClient.invalidateQueries({ queryKey: ["chat", data.townChannel] });
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Could not enter that server.");
    }
  });

  const sendMessage = useMutation({
    mutationFn: ({ text }: { text: string; optimisticId: string }) =>
      apiPost<SendChatResponse>("/api/chat/message", {
        channel: "TOWN",
        townChannel,
        message: text
      }),
    onSuccess: async (data, variables) => {
      setError(null);
      setOptimisticMessages((messages) =>
        messages.filter((message) => message.id !== variables.optimisticId)
      );
      queryClient.setQueryData<TownChatResponse>(["chat", townChannel], (previous) => {
        const currentMessages = previous?.messages ?? [];
        if (!data.message || currentMessages.some((message) => message.id === data.message.id)) {
          return previous;
        }
        return { messages: [...currentMessages, data.message].slice(-10) };
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["chat", townChannel] }),
        queryClient.invalidateQueries({ queryKey: ["town-servers"] })
      ]);
    },
    onError: (mutationError, variables) => {
      setOptimisticMessages((messages) =>
        messages.filter((message) => message.id !== variables.optimisticId)
      );
      setDraft(variables.text);
      setError(mutationError instanceof Error ? mutationError.message : "Could not send chat.");
    }
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim().replace(/\s+/g, " ").slice(0, 220);
    if (!message || sendMessage.isPending) {
      return;
    }
    const optimisticId = `local-chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setDraft("");
    setError(null);
    blurActiveChatInput();
    onLocalMessageSent({ id: optimisticId, text: message });
    setOptimisticMessages((messages) => [
      ...messages.slice(-9),
      {
        id: optimisticId,
        channel: "TOWN",
        townChannel,
        fromPlayerId: playerId,
        message,
        createdAt: new Date().toISOString()
      }
    ]);
    sendMessage.mutate({ text: message, optimisticId });
  };

  const renderSurface = () => (
    <TownChatSurface
      playerId={playerId}
      displayName={displayName}
      townChannel={townChannel}
      servers={serverList}
      messages={visibleMessages}
      draft={draft}
      error={error}
      sending={sendMessage.isPending}
      selecting={selectServer.isPending}
      onDraftChange={setDraft}
      onSubmit={submit}
      onTownChannelChange={(nextTownChannel) => {
        if (nextTownChannel !== townChannel) {
          selectServer.mutate(nextTownChannel);
        }
      }}
    />
  );

  return (
    <>
      <aside className="town-chat-panel" aria-label="Town chat">
        {renderSurface()}
      </aside>
      {mobileOpen ? (
        <GameModal className="town-chat-modal" aria-modal="true" role="dialog" aria-labelledby="town-chat-title">
          <header className="town-chat-modal-header">
            <div>
              <span className="game-eyebrow">Town Chat</span>
              <h2 id="town-chat-title">SolBloom Messages</h2>
            </div>
            <button type="button" className="game-icon-button" onClick={onMobileClose} aria-label="Close chat">
              <X size={20} />
            </button>
          </header>
          {renderSurface()}
        </GameModal>
      ) : null}
    </>
  );
}

function TownChatSurface({
  playerId,
  displayName,
  townChannel,
  servers,
  messages,
  draft,
  error,
  sending,
  selecting,
  onDraftChange,
  onSubmit,
  onTownChannelChange
}: {
  playerId: string;
  displayName: string;
  townChannel: TownServerId;
  servers: TownServerStatus[];
  messages: TownChatMessage[];
  draft: string;
  error: string | null;
  sending: boolean;
  selecting: boolean;
  onDraftChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTownChannelChange: (townChannel: TownServerId) => void;
}) {
  const activeServer = servers.find((server) => server.id === townChannel);
  const [serverMenuOpen, setServerMenuOpen] = useState(false);

  return (
    <>
      <div className="town-chat-surface">
        <div className="town-chat-toolbar">
          <div className="town-chat-server">
          <span className="sr-only">Town server</span>
          <button
            type="button"
            className="town-chat-server-button"
            data-game-input="text"
            aria-label="Town server"
            aria-haspopup="dialog"
            aria-expanded={serverMenuOpen}
            disabled={selecting}
            onClick={() => setServerMenuOpen(true)}
          >
            <Server size={15} />
            <span className="town-chat-server-copy">
              <strong>{activeServer?.label ?? "SolBloom"}</strong>
              <em>
                {activeServer?.online ?? 0} players / {activeServer?.capacity ?? TOWN_SERVER_CAPACITY} max
              </em>
            </span>
            <span className="town-chat-server-action">
              <DoorOpen size={15} aria-hidden="true" />
              Enter
            </span>
          </button>
          </div>
          <span className="town-chat-capacity">
            <Users size={14} />
            <strong>{activeServer?.online ?? 0}</strong>
            <span>players</span>
            <em>/ {activeServer?.capacity ?? TOWN_SERVER_CAPACITY} max</em>
          </span>
        </div>
        <div className="town-chat-log" aria-live="polite">
          {messages.length ? (
            messages.map((message, index) => (
              <div
                className={`town-chat-line ${message.fromPlayerId === playerId ? "is-own" : ""}`}
                style={{ opacity: Math.max(0.42, 1 - (messages.length - index - 1) * 0.06) }}
                key={message.id}
              >
                <span>{message.fromPlayerId === playerId ? displayName : playerLabel(message.fromPlayerId)}</span>
                <p>{message.message}</p>
              </div>
            ))
          ) : (
            <div className="town-chat-empty">
              <MessageCircle size={17} />
              <span>No messages yet.</span>
            </div>
          )}
        </div>
        {error ? <p className="town-chat-error">{error}</p> : null}
        <form className="town-chat-form" onSubmit={onSubmit}>
          <input
            data-game-input="text"
            value={draft}
            maxLength={220}
            placeholder="Message SolBloom..."
            aria-label="Town chat message"
            onChange={(event) => onDraftChange(event.target.value)}
          />
          <button type="submit" aria-label="Send town chat message" disabled={!draft.trim() || sending}>
            <Send size={16} />
          </button>
        </form>
      </div>
      {serverMenuOpen ? (
        <GameModal
          className="town-server-modal"
          aria-modal="true"
          role="dialog"
          aria-labelledby="town-server-title"
        >
          <header className="town-server-modal-header">
            <div>
              <span className="game-eyebrow">SolBloom Servers</span>
              <h2 id="town-server-title">Choose Server</h2>
            </div>
            <button
              type="button"
              className="game-icon-button"
              onClick={() => setServerMenuOpen(false)}
              aria-label="Close server selector"
            >
              <X size={20} />
            </button>
          </header>
          <div className="town-server-grid" role="listbox" aria-label="Town server choices">
            {servers.map((server) => {
              const selected = server.id === townChannel;
              const disabled = server.isFull && !selected;
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`town-server-card ${selected ? "is-selected" : ""}`}
                  key={server.id}
                  disabled={disabled || selecting}
                  onClick={() => {
                    if (!disabled) {
                      setServerMenuOpen(false);
                      onTownChannelChange(normalizeTownServerId(server.id));
                    }
                  }}
                >
                  <span className="town-server-card-icon">{selected ? <Check size={18} /> : <Server size={18} />}</span>
                  <span>
                    <strong>{server.label}</strong>
                    <em>
                      {server.online} players / {server.capacity} max
                    </em>
                  </span>
                  <span className="town-server-card-action">{selected ? "Current" : "Enter"}</span>
                </button>
              );
            })}
          </div>
        </GameModal>
      ) : null}
    </>
  );
}

function normalizeTownServerId(value: string): TownServerId {
  return townServerIds.find((id) => id === value) ?? "solbloom-1";
}

function playerLabel(playerId: string | null): string {
  if (!playerId) {
    return "System";
  }
  return playerId.length > 10 ? `${playerId.slice(0, 6)}...${playerId.slice(-3)}` : playerId;
}

function blurActiveChatInput(): void {
  const active = document.activeElement;
  if (active instanceof HTMLInputElement && active.closest(".town-chat-surface")) {
    active.blur();
  }
}
