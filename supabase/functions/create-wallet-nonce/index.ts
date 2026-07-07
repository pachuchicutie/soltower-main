import { handlers } from "../_shared/actions.ts";
import { serveAction } from "../_shared/http.ts";

serveAction("create-wallet-nonce", handlers["create-wallet-nonce"]);
