import "server-only";
import { cookies } from "next/headers";
import crypto from "crypto";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PASSWORD = process.env.ADMIN_PASSWORD || "";

export const ADMIN_COOKIE = "trueline_admin";
export const adminConfigured = Boolean(URL && SERVICE_KEY && PASSWORD);

// Unforgeable cookie value derived from the password — set only after a correct
// login, and can't be produced without knowing ADMIN_PASSWORD.
export function adminToken(): string {
  return crypto.createHash("sha256").update("trueline-admin:" + PASSWORD).digest("hex");
}

export function checkPassword(pw: string): boolean {
  if (!PASSWORD) return false;
  // constant-time compare
  const a = Buffer.from(pw);
  const b = Buffer.from(PASSWORD);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function isAdmin(): boolean {
  if (!PASSWORD) return false;
  return cookies().get(ADMIN_COOKIE)?.value === adminToken();
}

// Service-role client — bypasses RLS. Server-only, admin routes only.
export function getServiceClient(): SupabaseClient | null {
  if (!URL || !SERVICE_KEY) return null;
  return createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });
}

// ---------------------------------------------------------------------------
// Login rate limiting — per-IP sliding window with lockout.
// In-memory (per warm serverless instance). Enough to stop rapid password
// guessing; paired with a strong ADMIN_PASSWORD and a delay on each attempt.
// For hardened, cross-instance limits, back this with Upstash/a DB table.
// ---------------------------------------------------------------------------
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60_000; // count failures over 15 minutes
const LOCK_MS = 15 * 60_000; // lock for 15 minutes once tripped

interface Bucket { fails: number; windowStart: number; lockedUntil: number; }
const buckets = new Map<string, Bucket>();

export function loginRate(ip: string): { locked: boolean; retryMin: number; left: number } {
  const now = Date.now();
  const b = buckets.get(ip);
  if (b && b.lockedUntil > now) {
    return { locked: true, retryMin: Math.max(1, Math.ceil((b.lockedUntil - now) / 60_000)), left: 0 };
  }
  if (!b || now - b.windowStart > WINDOW_MS) return { locked: false, retryMin: 0, left: MAX_FAILS };
  return { locked: false, retryMin: 0, left: Math.max(0, MAX_FAILS - b.fails) };
}

export function recordLoginFailure(ip: string): void {
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b || now - b.windowStart > WINDOW_MS) b = { fails: 0, windowStart: now, lockedUntil: 0 };
  b.fails += 1;
  if (b.fails >= MAX_FAILS) b.lockedUntil = now + LOCK_MS;
  buckets.set(ip, b);
}

export function clearLoginFailures(ip: string): void {
  buckets.delete(ip);
}
