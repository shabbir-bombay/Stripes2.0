import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, length: number) => Promise<Buffer>;

// Stored as "salt:hash", both hex.
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || hash?.length !== 128) return false;
  const actual = await scryptAsync(password, Buffer.from(salt, "hex"), 64);
  return timingSafeEqual(actual, Buffer.from(hash, "hex"));
}
