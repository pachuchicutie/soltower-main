import { handlers } from "../_shared/actions.ts";
import { serveAction } from "../_shared/http.ts";

serveAction("get-player-bootstrap-data", handlers["get-player-bootstrap-data"]);
