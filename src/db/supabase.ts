import { createClient } from "@supabase/supabase-js";

// Prefer the new personal Supabase project (*_NEW); fall back to the original
// MeDo project so the old keys keep working for re-syncing data.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL_NEW || import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY_NEW || import.meta.env.VITE_SUPABASE_ANON_KEY;

// Right after sign-in the API can reject a brand-new token for a moment because of
// clock skew between Supabase's auth and data servers ("JWT issued at future",
// PGRST303). Retry those requests briefly instead of failing the page load.
const fetchWithSkewRetry: typeof fetch = async (input, init) => {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(input, init);
    if (res.status !== 401 || attempt >= 4) return res;
    const body = await res.clone().text().catch(() => "");
    if (!body.includes("PGRST303")) return res;
    await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchWithSkewRetry },
});
