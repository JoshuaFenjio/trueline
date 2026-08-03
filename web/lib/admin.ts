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
