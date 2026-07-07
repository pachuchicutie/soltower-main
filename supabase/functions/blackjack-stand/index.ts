import { handlers } from "../_shared/actions.ts";
import { serveAction } from "../_shared/http.ts";

serveAction("blackjack-stand", handlers["blackjack-stand"]);
