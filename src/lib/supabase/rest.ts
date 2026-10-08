const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serverKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

function config() {
  if (!supabaseUrl || !serverKey) {
    throw new Error("Supabase server environment variables are not configured.");
  }
  return { supabaseUrl, serverKey };
}

export async function supabaseRest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { supabaseUrl, serverKey } = config();
  const isModernSecret = serverKey.startsWith("sb_secret_");
  const headers: Record<string, string> = {
    apikey: serverKey,
    "Content-Type": "application/json",
    Prefer: "return=representation",
    ...((init.headers as Record<string, string> | undefined) ?? {}),
  };

  // Legacy service_role keys are JWTs and can be used as Bearer tokens.
  // Modern sb_secret_ keys must NOT be sent as Authorization: Bearer.
  if (!isModernSecret) headers.Authorization = `Bearer ${serverKey}`;

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    cache: "no-store",
    headers,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase REST ${response.status}: ${body}`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
