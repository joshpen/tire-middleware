export interface Config {
  supabaseUrl: string;
  serviceRoleKey: string;
  port: number;
  host: string;
  pollCron: string;
  /**
   * Optional dedicated token for the admin dashboard/API. When set, browser
   * operators use this instead of the service-role key (which then never
   * leaves the server side). Falls back to the service-role key when unset.
   */
  adminToken: string | null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const supabaseUrl = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) throw new Error("SUPABASE_URL is required");
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
  return {
    supabaseUrl,
    serviceRoleKey,
    port: Number(env.PORT ?? 8080),
    host: env.HOST ?? "0.0.0.0",
    pollCron: env.POLL_CRON ?? "*/15 * * * *",
    adminToken: env.GATEWAY_ADMIN_TOKEN || null,
  };
}
