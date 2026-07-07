import { handlers } from "../_shared/actions.ts";
import { serveAction } from "../_shared/http.ts";

serveAction("leave-lobby", handlers["leave-lobby"]);
