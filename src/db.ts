import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types/supabase.js";
import type { Config } from "./config.js";

export type Db = SupabaseClient<Database>;

export function createDb(config: Config): Db {
  return createClient<Database>(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
