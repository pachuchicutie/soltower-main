import { handlers } from "../_shared/actions.ts";
import { serveAction } from "../_shared/http.ts";

serveAction("verify-wallet-signature", handlers["verify-wallet-signature"]);
