import { handlers } from "../_shared/actions.ts";
import { serveAction } from "../_shared/http.ts";

serveAction("list-open-lobbies", handlers["list-open-lobbies"]);
