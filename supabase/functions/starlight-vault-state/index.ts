import { serveAction } from "../_shared/http.ts";
import { handlers } from "../_shared/actions.ts";

serveAction("starlight-vault-state", handlers["starlight-vault-state"]);
