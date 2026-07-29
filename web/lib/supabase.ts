import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Server-side ONLY data layer. Uses the anon public key — never the service key.
const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && anon);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!url || !anon) return null;
  if (!client) {
    client = createClient(url, anon, { auth: { persistSession: false } });
  }
  return client;
}
