import { defineEveryApp } from "@every-app/sdk";

export default defineEveryApp({
  id: "loyalty-passes",
  name: "Loyalty Passes",
  description:
    "Digital stamp cards, points, memberships and coupons that customers join from a link and staff scan at the counter.",
  icon: "/icon.svg",
  access: "everyone",
  resources: {
    d1: ["DB"],
    // Program logos and strip images.
    r2: ["files"],
  },
  // Customers are not members: they join a program and open their pass
  // without signing in. Each route checks its own slug or pass token.
  public: [
    { path: "/j/:slug", methods: ["GET"] },
    { path: "/join/:slug", methods: ["POST"] },
    { path: "/p/:token", methods: ["GET"] },
    { path: "/wallet/apple/:token", methods: ["GET"] },
    { path: "/wallet/google/:token", methods: ["GET"] },
    { path: "/img/programs/:key", methods: ["GET"] },
  ],
  // What the public pages load.
  publicAssets: ["/assets/**", "/icon.svg"],
  features: {
    applewallet: {
      name: "Apple Wallet",
      why: "Customers can add their pass to Apple Wallet.",
      steps: [
        "Create a Pass Type ID and its certificate in your Apple Developer account: https://developer.apple.com/account/resources/identifiers/list/passTypeId",
        "Export the certificate and its private key as PEM files, and download Apple's WWDR G4 certificate: https://www.apple.com/certificateauthority/",
      ],
      settings: [
        { name: "APPLE_PASS_TYPE_ID", how: "The Pass Type ID, such as pass.com.example.loyalty" },
        { name: "APPLE_TEAM_ID", how: "Membership details → Team ID" },
      ],
      secrets: [
        { name: "APPLE_PASS_CERTIFICATE", file: true, how: "The pass certificate as a .pem file" },
        { name: "APPLE_PASS_PRIVATE_KEY", file: true, how: "The certificate's unencrypted private key as a .pem file" },
        { name: "APPLE_WWDR_CERTIFICATE", file: true, how: "Apple's WWDR G4 certificate as a .pem file" },
      ],
    },
    googlewallet: {
      name: "Google Wallet",
      why: "Customers can add their pass to Google Wallet.",
      steps: [
        "Get an issuer account in the Google Pay & Wallet Console: https://pay.google.com/business/console",
        "Create a Google Cloud service account, give it access to the issuer account and download its JSON key: https://developers.google.com/wallet/generic/web/prerequisites",
      ],
      settings: [
        { name: "GOOGLE_WALLET_ISSUER_ID", how: "Google Pay & Wallet Console → Google Wallet API → Issuer ID" },
      ],
      secrets: [
        { name: "GOOGLE_WALLET_SERVICE_ACCOUNT", file: true, how: "The service account's JSON key file" },
      ],
    },
  },
});
