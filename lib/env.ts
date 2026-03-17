const trimmed = (value?: string) => value?.replace(/\/$/, "") ?? "";

export const appEnv = {
  supabaseUrl: trimmed(process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  functionsUrl: trimmed(process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL),
};

export const functionsBaseUrl =
  appEnv.functionsUrl || (appEnv.supabaseUrl ? `${appEnv.supabaseUrl}/functions/v1` : "");

export const isSupabaseConfigured = Boolean(appEnv.supabaseUrl && appEnv.supabaseAnonKey && functionsBaseUrl);

export const runtimeMode = isSupabaseConfigured ? "supabase" : "mock";
