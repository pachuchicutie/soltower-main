import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { HeroId, PublicPlayer } from "@soltower/shared";
import { apiGet, apiPost } from "../../lib/api";
import { HeroAppearancePreview } from "../ui/HeroAppearancePreview";

interface FriendsResponse {
  friends: Array<{ id: string; status: string; player: PublicPlayer }>;
}

interface ChatResponse {
  messages: ChatMessage[];
}

interface ChatMessage {
  id: string;
  channel: string;
  fromPlayerId: string | null;
  fromDisplayName?: string | null;
  fromHeroId?: HeroId | null;
  message: string;
  createdAt: string;
}

export function FriendsPanel() {
  const queryClient = useQueryClient();
  const [panelOpenedAtMs] = useState(() => Date.now());
  const friends = useQuery({ queryKey: ["friends"], queryFn: () => apiGet<FriendsResponse>("/api/friends") });
  const chat = useQuery({
    queryKey: ["chat"],
    queryFn: () => apiGet<ChatResponse>("/api/chat/recent"),
    refetchInterval: 3500
  });
  const tavernMessages = useMemo(
    () =>
      (chat.data?.messages ?? [])
        .filter((message) => Date.parse(message.createdAt) >= panelOpenedAtMs)
        .slice(-8),
    [chat.data?.messages, panelOpenedAtMs]
  );
  const quickMessage = useMutation({
    mutationFn: (message: string) =>
      apiPost("/api/chat/message", { channel: "TOWN", townChannel: "solbloom-1", message }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["chat"] });
    }
  });
  return (
    <div className="two-column">
      <section className="compact-panel">
        <h3>Friends</h3>
        {friends.data?.friends.map((friend) => (
          <div className="row friend-row" key={friend.id}>
            <HeroAppearancePreview heroId={friendHeroId(friend.player)} className="mini-hero-avatar" label={friend.player.displayName} />
            <span>{friend.player.displayName}</span>
            <strong>{friend.status}</strong>
          </div>
        ))}
      </section>
      <section className="compact-panel">
        <h3>Quick Raid Messages</h3>
        {["Ready!", "Nice damage!", "Need help!", "Use your skill!", "Good run!", "Again?"].map((message) => (
          <button className="wide-command" type="button" key={message} onClick={() => quickMessage.mutate(message)}>
            {message}
          </button>
        ))}
      </section>
      <section className="compact-panel full-span">
        <h3>Town Chat</h3>
        {tavernMessages.length ? (
          tavernMessages.map((message) => {
            const author = chatAuthorName(message);
            return (
              <div className="row chat-row" key={message.id}>
                <HeroAppearancePreview heroId={chatHeroId(message)} className="mini-hero-avatar" label={author} />
                <span>{author}</span>
                <strong>{message.message}</strong>
              </div>
            );
          })
        ) : (
          <p className="empty-copy">No fresh tavern messages yet.</p>
        )}
      </section>
    </div>
  );
}

function friendHeroId(player: PublicPlayer): HeroId {
  const maybeHero = player as PublicPlayer & { selectedHeroId?: HeroId; selectedHero?: HeroId };
  return maybeHero.selectedHeroId ?? maybeHero.selectedHero ?? "storm-archer";
}

function chatAuthorName(message: ChatMessage): string {
  return message.fromDisplayName?.trim() || "Guardian";
}

function chatHeroId(message: ChatMessage): HeroId {
  return message.fromHeroId ?? "storm-archer";
}
