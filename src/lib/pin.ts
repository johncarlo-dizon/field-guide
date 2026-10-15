import { createHmac } from "crypto";
import bcrypt from "bcryptjs";

// PIN handling. No Next.js imports here, so scripts can use it too.

function pepper(): string {
  const p = process.env.PIN_PEPPER;
  if (!p || p.length < 16) {
    throw new Error("PIN_PEPPER is missing or too short. Check .env.local");
  }
  return p;
}

// The PIN is first mixed with a server-side secret, then hashed with bcrypt.
// A stolen database alone is then not enough to guess the 10,000 possible PINs.
function prehash(pin: string): string {
  return createHmac("sha256", pepper()).update(pin).digest("hex");
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(prehash(pin), 10);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(prehash(pin), hash);
}

// Returns a message if the PIN is not allowed, or null if it is fine.
export function pinProblem(pin: string): string | null {
  if (!/^\d{4}$/.test(pin)) return "The PIN must be exactly 4 digits";
  if (/^(\d)\1{3}$/.test(pin)) return "That PIN is too easy to guess";
  const d = pin.split("").map(Number);
  const up = d.every((n, i) => i === 0 || n === d[i - 1] + 1);
  const down = d.every((n, i) => i === 0 || n === d[i - 1] - 1);
  if (up || down) return "That PIN is too easy to guess";
  return null;
}