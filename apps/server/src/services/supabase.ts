import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SupabaseServerClients {
  anon: SupabaseClient | null;
  serviceRole: SupabaseClient | null;
  configured: boolean;
}

export function createSupabaseServerClients(): SupabaseServerClients {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    anon: url && anonKey ? createClient(url, anonKey) : null,
    serviceRole: url && serviceRoleKey ? createClient(url, serviceRoleKey) : null,
    configured: Boolean(url && anonKey && serviceRoleKey)
  };
}
