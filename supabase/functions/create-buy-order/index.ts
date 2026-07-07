import { handlers } from "../_shared/actions.ts";
import { serveAction } from "../_shared/http.ts";

serveAction("create-buy-order", handlers["create-buy-order"]);
