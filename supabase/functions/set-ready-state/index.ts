import { handlers } from "../_shared/actions.ts";
import { serveAction } from "../_shared/http.ts";

serveAction("set-ready-state", handlers["set-ready-state"]);
