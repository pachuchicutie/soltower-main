import { handlers } from "../_shared/actions.ts";
import { serveAction } from "../_shared/http.ts";

serveAction("send-chat-message", handlers["send-chat-message"]);
