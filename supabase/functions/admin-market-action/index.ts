import { handlers } from "../_shared/actions.ts";
import { serveAction } from "../_shared/http.ts";

serveAction("admin-market-action", handlers["admin-market-action"]);
