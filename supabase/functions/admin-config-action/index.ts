import { handlers } from "../_shared/actions.ts";
import { serveAction } from "../_shared/http.ts";

serveAction("admin-config-action", handlers["admin-config-action"]);
