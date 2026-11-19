export function newId(): string {
  return crypto.randomUUID();
}

function randomBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** 32 random bytes, base64url: the private link to a pass. */
export function newToken(): string {
  let s = "";
  for (const b of randomBytes(32)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A short code staff can type: 8 characters, no look-alikes. */
export function newCode(length = 8): string {
  return Array.from(randomBytes(length), (b) => CODE_ALPHABET[b % 32]).join("");
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function nowIso(): string {
  return new Date().toISOString();
}

export class AppError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}
