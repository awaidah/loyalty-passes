// Wallet passes, when the shop has entered its own Apple or Google credentials.
import { env } from "cloudflare:workers";
import { SignJWT, importPKCS8 } from "jose";
import { zipSync, zlibSync } from "fflate";
import { publicPass } from "./passes";

const set = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

export function appleWalletReady(): boolean {
  return Boolean(
    set(env.APPLE_PASS_CERTIFICATE) && set(env.APPLE_PASS_PRIVATE_KEY) && set(env.APPLE_WWDR_CERTIFICATE) &&
      set(env.APPLE_PASS_TYPE_ID) && set(env.APPLE_TEAM_ID),
  );
}

export function googleWalletReady(): boolean {
  return Boolean(set(env.GOOGLE_WALLET_SERVICE_ACCOUNT) && set(env.GOOGLE_WALLET_ISSUER_ID));
}

type Pass = NonNullable<Awaited<ReturnType<typeof publicPass>>>;

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
}

/** A Save to Google Wallet link holding the pass, signed with the shop's service account. */
export async function googleSaveUrl(pass: Pass, origin: string): Promise<string> {
  const account = JSON.parse(env.GOOGLE_WALLET_SERVICE_ACCOUNT!) as { client_email: string; private_key: string };
  const issuer = env.GOOGLE_WALLET_ISSUER_ID!.trim();
  const key = await importPKCS8(account.private_key, "RS256");
  const classId = `${issuer}.loyalty_${pass.pass.code.toLowerCase()}_class`;
  const object: Record<string, unknown> = {
    id: `${issuer}.pass_${pass.pass.code.toLowerCase()}`,
    classId,
    state: pass.view.state === "ok" ? "ACTIVE" : "INACTIVE",
    hexBackgroundColor: pass.program.bgColor,
    cardTitle: { defaultValue: { language: "en", value: pass.program.name } },
    header: { defaultValue: { language: "en", value: pass.view.balance } },
    subheader: { defaultValue: { language: "en", value: pass.customerName } },
    barcode: { type: "QR_CODE", value: pass.pass.code, alternateText: pass.pass.code },
    textModulesData: pass.program.rewardText
      ? [{ id: "reward", header: "Reward", body: pass.program.rewardText }]
      : [],
    linksModuleData: { uris: [{ uri: `${origin}/p/${pass.pass.token}`, description: "Your pass" }] },
  };
  if (pass.program.logoUrl) object.logo = { sourceUri: { uri: origin + pass.program.logoUrl } };
  if (pass.program.stripUrl) object.heroImage = { sourceUri: { uri: origin + pass.program.stripUrl } };
  const jwt = await new SignJWT({
    typ: "savetowallet",
    origins: [origin],
    payload: { genericClasses: [{ id: classId }], genericObjects: [object] },
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(account.client_email)
    .setAudience("google")
    .setIssuedAt()
    .sign(key);
  return `https://pay.google.com/gp/v/save/${jwt}`;
}

/** A signed .pkpass file for Apple Wallet. */
export async function applePkpass(token: string, origin: string): Promise<Uint8Array | null> {
  const pass = await publicPass(token);
  if (!pass) return null;
  const forge = (await import("node-forge")).default;
  const program = pass.program;
  const [r, g, b] = hexToRgb(program.bgColor);
  const [fr, fg, fb] = hexToRgb(program.textColor);
  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: env.APPLE_PASS_TYPE_ID!.trim(),
    teamIdentifier: env.APPLE_TEAM_ID!.trim(),
    serialNumber: pass.pass.code,
    organizationName: program.name,
    description: program.name,
    logoText: program.name,
    backgroundColor: `rgb(${r}, ${g}, ${b})`,
    foregroundColor: `rgb(${fr}, ${fg}, ${fb})`,
    labelColor: `rgb(${fr}, ${fg}, ${fb})`,
    voided: pass.view.state !== "ok",
    barcodes: [{ format: "PKBarcodeFormatQR", message: pass.pass.code, messageEncoding: "iso-8859-1", altText: pass.pass.code }],
    storeCard: {
      primaryFields: [{ key: "balance", label: "Balance", value: pass.view.balance }],
      secondaryFields: [{ key: "name", label: "Member", value: pass.customerName }],
      backFields: [
        ...(program.rewardText ? [{ key: "reward", label: "Reward", value: program.rewardText }] : []),
        { key: "link", label: "Your pass", value: `${origin}/p/${pass.pass.token}` },
      ],
    },
  };
  const files: Record<string, Uint8Array> = {
    "pass.json": new TextEncoder().encode(JSON.stringify(passJson)),
    "icon.png": solidPng(58, [r, g, b]),
    "icon@2x.png": solidPng(116, [r, g, b]),
  };
  const bucket = env.files;
  for (const [name, url] of [["logo.png", program.logoUrl], ["strip.png", program.stripUrl]] as const) {
    if (!url) continue;
    const object = await bucket.get(url.replace("/img/", ""));
    if (object && object.httpMetadata?.contentType === "image/png") files[name] = new Uint8Array(await object.arrayBuffer());
  }
  const manifest: Record<string, string> = {};
  for (const [name, bytes] of Object.entries(files)) {
    const digest = await crypto.subtle.digest("SHA-1", bytes as Uint8Array<ArrayBuffer>);
    manifest[name] = [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, "0")).join("");
  }
  const manifestText = JSON.stringify(manifest);
  const cert = forge.pki.certificateFromPem(env.APPLE_PASS_CERTIFICATE!);
  const wwdr = forge.pki.certificateFromPem(env.APPLE_WWDR_CERTIFICATE!);
  const key = forge.pki.privateKeyFromPem(env.APPLE_PASS_PRIVATE_KEY!);
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifestText, "utf8");
  p7.addCertificate(cert);
  p7.addCertificate(wwdr);
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256!,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType!, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest! },
      { type: forge.pki.oids.signingTime!, value: new Date() as unknown as string },
    ],
  });
  p7.sign({ detached: true });
  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  files["manifest.json"] = new TextEncoder().encode(manifestText);
  files["signature"] = Uint8Array.from(der, (c) => c.charCodeAt(0));
  return zipSync(files);
}

/** A square PNG of one colour, for the icon a wallet pass must carry. */
function solidPng(size: number, [r, g, b]: readonly [number, number, number]): Uint8Array {
  const row = new Uint8Array(1 + size * 3);
  for (let x = 0; x < size; x++) row.set([r, g, b], 1 + x * 3);
  const raw = new Uint8Array(row.length * size);
  for (let y = 0; y < size; y++) raw.set(row, y * row.length);
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length);
    out.set(new TextEncoder().encode(type), 4);
    out.set(data, 8);
    view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  };
  const header = new Uint8Array(13);
  const hv = new DataView(header.buffer);
  hv.setUint32(0, size);
  hv.setUint32(4, size);
  header.set([8, 2, 0, 0, 0], 8);
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", zlibSync(raw)),
    chunk("IEND", new Uint8Array()),
  ];
  const png = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) (png.set(p, offset), (offset += p.length));
  return png;
}

function crc32(bytes: Uint8Array): number {
  let c = ~0;
  for (const byte of bytes) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

