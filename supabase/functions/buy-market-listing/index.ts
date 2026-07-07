import { handlers } from "../_shared/actions.ts";
import { serveAction } from "../_shared/http.ts";

serveAction("buy-market-listing", handlers["buy-market-listing"]);
