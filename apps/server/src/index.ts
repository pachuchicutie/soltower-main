import { createApp } from "./app";
import { attachSockets } from "./sockets";

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

const { app, store } = await createApp();
attachSockets(app.server, store);

try {
  await app.listen({ port, host });
  app.log.info(`SolTower server listening on http://${host}:${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
