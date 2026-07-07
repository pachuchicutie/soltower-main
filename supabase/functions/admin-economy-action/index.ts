import { handlers } from "../_shared/actions.ts";
import { serveAction } from "../_shared/http.ts";

serveAction("admin-economy-action", handlers["admin-economy-action"]);
