import { handlers } from "../_shared/actions.ts";
import { serveAction } from "../_shared/http.ts";

serveAction("start-blackjack-hand", handlers["start-blackjack-hand"]);
