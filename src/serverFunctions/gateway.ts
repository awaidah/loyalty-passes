import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { ConfigurationError, gatewayUrl } from "@every-app/sdk/server";

/**
 * The Gateway's origin: the way back to the other apps, and the host the
 * light/dark cookie is set on. Null when the Worker has no GATEWAY_URL. Not
 * behind ensureUserMiddleware: the customer pages load it too, and it is the
 * address every member's browser already knows.
 */
export const getGatewayUrl = createServerFn().handler(() => {
  try {
    return { gatewayUrl: new URL(gatewayUrl(env)).origin };
  } catch (error) {
    if (!(error instanceof ConfigurationError)) throw error;
    return { gatewayUrl: null };
  }
});
