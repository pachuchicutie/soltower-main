import { serveAction } from "../_shared/http.ts";
import { handlers } from "../_shared/actions.ts";

serveAction("select-town-server", handlers["select-town-server"]);
