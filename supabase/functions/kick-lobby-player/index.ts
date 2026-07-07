import { handlers } from "../_shared/actions.ts";
import { serveAction } from "../_shared/http.ts";

serveAction("kick-lobby-player", handlers["kick-lobby-player"]);
