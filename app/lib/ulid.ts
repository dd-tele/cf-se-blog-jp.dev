// Simple ULID generator for Cloudflare Workers (no crypto.getRandomValues dependency issues)
const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function encodeTime(now: number, len: number): string {
  let str = "";
  for (let i = len; i > 0; i--) {
    const mod = now % ENCODING.length;
    str = ENCODING[mod] + str;
    now = (now - mod) / ENCODING.length;
  }
  return str;
}

function encodeRandom(len: number): string {
  let str = "";
  const randomBytes = new Uint8Array(len);
  crypto.getRandomValues(randomBytes);
  for (let i = 0; i < len; i++) {
    str += ENCODING[randomBytes[i] % ENCODING.length];
  }
  return str;
}

export function ulid(): string {
  const time = encodeTime(Date.now(), 10);
  const random = encodeRandom(16);
  return time + random;
}
