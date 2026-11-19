# Loyalty Passes

Digital stamp cards, points programs, multi-visit passes, memberships and coupons for a shop. Customers join from a link or QR code and get a pass on their phone; staff scan it at the counter.

Inspired by https://koroot.io

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Create stamp, points, multi-visit, membership and coupon programs with your own colours, logo and strip image.
- Share each program's install link or printed QR code; customers get a private pass page with their balance and code.
- Scan a pass with any camera or type its code to add stamps or points, check in, or redeem rewards, and undo mistakes.
- Post offers to one program or all of them, now or on a schedule, and end them early.
- Add and archive locations; every visit records where it happened.
- Search and sort customers, see each one's passes and history, cancel passes and export CSV.
- See new passes, visits, rewards and repeat customers over 7, 30 or 90 days, by program and location.
- Let customers add their pass to Apple Wallet or Google Wallet once you enter your own wallet credentials.

Left out: accounts and sign-in, which your Gateway handles; gift card, cashback and discount pass types; wallet lock-screen pushes; point-of-sale integrations; a native scanner app; plans and billing.

## Setup

```sh
pnpm install
pnpm dev              # run locally
pnpm types:check
pnpm run deploy       # or install a release: pnpm everyapp install <repository url>
```

Nothing has to be set before the app opens. Two optional features add wallet buttons to the pass page (`pnpm everyapp configure loyalty-passes`):

- Apple Wallet: `APPLE_PASS_TYPE_ID` and `APPLE_TEAM_ID` (settings), and `APPLE_PASS_CERTIFICATE`, `APPLE_PASS_PRIVATE_KEY` and `APPLE_WWDR_CERTIFICATE` (PEM files) from your Apple Developer account, to sign passes.
- Google Wallet: `GOOGLE_WALLET_ISSUER_ID` (setting) and `GOOGLE_WALLET_SERVICE_ACCOUNT` (the service account's JSON key), to sign Save to Google Wallet links.

`checks/` holds the acceptance suites; they run against a packaged release through the oss.new runtime.

## Limitations

- Wallet passes don't update on their own after a visit; the customer re-adds the pass, or uses the pass page, which is always current.
- Apple Wallet signing and Google Wallet saving with real credentials were not tested here; the Google link's signature was checked with a throwaway key.
- Images must be PNG, JPEG, WebP or GIF up to 2 MB; Apple Wallet shows PNG logos only.
- R2 must be enabled on the Cloudflare account.
