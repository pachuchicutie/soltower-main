import { handlers } from "../_shared/actions.ts";
import { serveAction } from "../_shared/http.ts";

serveAction("claim-quest-reward", handlers["claim-quest-reward"]);
