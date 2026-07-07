import { handlers } from "../_shared/actions.ts";
import { serveAction } from "../_shared/http.ts";

serveAction("finalize-prototype-raid", handlers["finalize-prototype-raid"]);
