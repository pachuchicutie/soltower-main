import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { createDevStore, type DevStore } from "./data/store";
import { registerRoutes } from "./routes";

export async function createApp(store: DevStore = createDevStore()) {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info"
    }
  });

  await app.register(helmet, {
    contentSecurityPolicy: false
  });
  await app.register(cors, {
    origin: [process.env.WEB_ORIGIN ?? "http://localhost:5173", process.env.ADMIN_ORIGIN ?? "http://localhost:5174"],
    credentials: true
  });
  await app.register(cookie, {
    secret: process.env.SESSION_SECRET ?? "dev-only-change-me"
  });
  await app.register(rateLimit, {
    max: 240,
    timeWindow: "1 minute"
  });

  registerRoutes(app, store);
  return { app, store };
}
