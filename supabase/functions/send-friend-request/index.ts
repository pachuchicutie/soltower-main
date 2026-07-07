import { handlers } from "../_shared/actions.ts";
import { serveAction } from "../_shared/http.ts";

serveAction("send-friend-request", handlers["send-friend-request"]);
