import { handlers } from "../_shared/actions.ts";
import { serveAction } from "../_shared/http.ts";

serveAction("start-prototype-raid", handlers["start-prototype-raid"]);
