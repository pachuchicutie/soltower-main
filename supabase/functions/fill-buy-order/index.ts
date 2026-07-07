import { handlers } from "../_shared/actions.ts";
import { serveAction } from "../_shared/http.ts";

serveAction("fill-buy-order", handlers["fill-buy-order"]);
