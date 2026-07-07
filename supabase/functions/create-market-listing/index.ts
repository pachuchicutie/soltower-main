import { handlers } from "../_shared/actions.ts";
import { serveAction } from "../_shared/http.ts";

serveAction("create-market-listing", handlers["create-market-listing"]);
