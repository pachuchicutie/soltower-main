import { serveAction } from "../_shared/http.ts";
import { handlers } from "../_shared/actions.ts";

serveAction("save-town-position", handlers["save-town-position"]);
