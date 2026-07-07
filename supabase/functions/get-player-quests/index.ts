import { handlers } from "../_shared/actions.ts";
import { serveAction } from "../_shared/http.ts";

serveAction("get-player-quests", handlers["get-player-quests"]);
