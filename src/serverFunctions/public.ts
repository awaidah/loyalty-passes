// What the customer pages load. No middleware: customers aren't members.
// Each takes the program's slug or the pass's private token, and returns
// only what that page shows.
import { createServerFn } from "@tanstack/react-start";
import { notFound } from "@tanstack/react-router";
import { z } from "zod";
import { getProgramBySlug, imageUrl } from "@/server/programs";
import { publicPass } from "@/server/passes";
import { qrSvg } from "@/server/qr";
import { appleWalletReady, googleWalletReady } from "@/server/wallet";

export const getJoinPage = createServerFn()
  .validator((data: unknown) => z.object({ slug: z.string().max(40) }).parse(data))
  .handler(async ({ data }) => {
    const program = await getProgramBySlug(data.slug);
    if (!program || program.status !== "active") throw notFound();
    return {
      slug: program.slug,
      name: program.name,
      rewardText: program.rewardText,
      bgColor: program.bgColor,
      textColor: program.textColor,
      logoUrl: imageUrl(program.logoKey),
    };
  });

export const getPassPage = createServerFn()
  .validator((data: unknown) => z.object({ token: z.string().max(100) }).parse(data))
  .handler(async ({ data }) => {
    const pass = await publicPass(data.token);
    if (!pass) throw notFound();
    return {
      ...pass,
      qr: qrSvg(pass.pass.code),
      wallets: { apple: appleWalletReady(), google: googleWalletReady() },
    };
  });
