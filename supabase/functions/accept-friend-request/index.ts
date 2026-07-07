import { handlers } from "../_shared/actions.ts";
import { serveAction } from "../_shared/http.ts";

serveAction("accept-friend-request", handlers["accept-friend-request"]);
