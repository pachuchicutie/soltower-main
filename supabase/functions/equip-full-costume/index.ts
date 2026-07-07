import { serveAction } from "../_shared/http.ts";
import { handlers } from "../_shared/actions.ts";

serveAction("equip-full-costume", handlers["equip-full-costume"]);
