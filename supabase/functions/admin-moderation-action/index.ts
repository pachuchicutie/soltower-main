import { handlers } from "../_shared/actions.ts";
import { serveAction } from "../_shared/http.ts";

serveAction("admin-moderation-action", handlers["admin-moderation-action"]);
