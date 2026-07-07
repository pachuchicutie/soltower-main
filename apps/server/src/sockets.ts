import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { chatMessageSchema } from "@soltower/shared";
import { type DevStore, makeId, nowIso } from "./data/store";

export function attachSockets(server: HttpServer, store: DevStore): Server {
  const io = new Server(server, {
    cors: {
      origin: [process.env.WEB_ORIGIN ?? "http://localhost:5173", process.env.ADMIN_ORIGIN ?? "http://localhost:5174"],
      credentials: true
    }
  });

  io.on("connection", (socket) => {
    socket.emit("presence:snapshot", {
      channel: "solbloom-1",
      players: Array.from(store.players.values())
        .filter((player) => player.id !== "treasury")
        .map((player) => ({
          id: player.id,
          displayName: player.displayName,
          avatar: player.avatar,
          x: 180 + Math.floor(Math.random() * 320),
          y: 160 + Math.floor(Math.random() * 220),
          status: "IN_TOWN"
        }))
    });

    socket.on("presence:join", (payload: unknown) => {
      socket.broadcast.emit("presence:joined", payload);
    });

    socket.on("chat:message", (payload: unknown) => {
      const parsed = chatMessageSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit("chat:error", { error: "Invalid chat message" });
        return;
      }
      const message = {
        id: makeId("chat"),
        channel: parsed.data.channel,
        fromPlayerId: null,
        targetPlayerId: parsed.data.targetPlayerId ?? null,
        message: parsed.data.message.replace(/\s+/g, " ").trim(),
        moderationState: "VISIBLE" as const,
        createdAt: nowIso()
      };
      store.chat.push(message);
      io.emit("chat:message", message);
    });

    socket.on("lobby:subscribe", () => {
      socket.emit("lobby:snapshot", Array.from(store.lobbies.values()));
    });
  });

  return io;
}
