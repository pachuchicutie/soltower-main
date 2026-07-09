import { handlers } from "../_shared/actions.ts";
import { serveAction } from "../_shared/http.ts";

serveAction("gift-inventory-item", handlers["gift-inventory-item"]);
