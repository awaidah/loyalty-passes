/// <reference types="vite/client" />

// The bindings come from `cf workers types` (.cloudflare/types). An app secret
// listed under `secrets` in everyapp.config.ts is typed here, optional until set:
//   declare namespace Cloudflare { interface Env { GITHUB_TOKEN?: string } }

declare namespace Cloudflare {
  interface Env {
    APPLE_PASS_CERTIFICATE?: string;
    APPLE_PASS_PRIVATE_KEY?: string;
    APPLE_WWDR_CERTIFICATE?: string;
    APPLE_PASS_TYPE_ID?: string;
    APPLE_TEAM_ID?: string;
    GOOGLE_WALLET_SERVICE_ACCOUNT?: string;
    GOOGLE_WALLET_ISSUER_ID?: string;
  }
}
