import { handlers } from "../_shared/actions.ts";
import { serveAction } from "../_shared/http.ts";

serveAction("buy-bound-shop-item", handlers["buy-bound-shop-item"]);
