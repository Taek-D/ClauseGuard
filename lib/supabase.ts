import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { appEnv, isSupabaseConfigured } from "@/lib/env";

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured || typeof window === "undefined") {
    return null;
  }

  if (!browserClient) {
    browserClient = createClient(appEnv.supabaseUrl, appEnv.supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }

  return browserClient;
}
