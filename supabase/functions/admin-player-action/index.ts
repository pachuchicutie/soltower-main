import { handlers } from "../_shared/actions.ts";
import { serveAction } from "../_shared/http.ts";

serveAction("admin-player-action", handlers["admin-player-action"]);
