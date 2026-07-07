import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { HeroId, PublicPlayer } from "@soltower/shared";
import { apiGet, apiPost } from "../../lib/api";
import { HeroAppearancePreview } from "../ui/HeroAppearancePreview";

interface FriendsResponse {
  friends: Array<{ id: string; status: string; player: PublicPlayer }>;
}

interface ChatResponse {
  messages: Array<{ id: string; channel: string; fromPlayerId: string | null; message: string; createdAt: string }>;
}

export function FriendsPanel() {
  const queryClient = useQueryClient();
  const friends = useQuery({ queryKey: ["friends"], queryFn: () => apiGet<FriendsResponse>("/api/friends") });
  const chat = useQuery({ queryKey: ["chat"], queryFn: () => apiGet<ChatResponse>("/api/chat/recent") });
  const quickMessage = useMutation({
    mutationFn: (message: string) => apiPost("/api/chat/message", { channel: "TOWN", message }),
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
        {chat.data?.messages.map((message) => (
          <div className="row chat-row" key={message.id}>
            <HeroAppearancePreview heroId="storm-archer" className="mini-hero-avatar" label="Chat avatar" />
            <span>{message.channel}</span>
            <strong>{message.message}</strong>
          </div>
        ))}
      </section>
    </div>
  );
}

function friendHeroId(player: PublicPlayer): HeroId {
  const maybeHero = player as PublicPlayer & { selectedHeroId?: HeroId; selectedHero?: HeroId };
  return maybeHero.selectedHeroId ?? maybeHero.selectedHero ?? "storm-archer";
}
