import { handlers } from "../_shared/actions.ts";
import { serveAction } from "../_shared/http.ts";

serveAction("cancel-market-listing", handlers["cancel-market-listing"]);
