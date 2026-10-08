const baseRequiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "OPERATOR_SESSION_SECRET",
] as const;

export function getEnvStatus() {
  const missing: string[] = baseRequiredEnv.filter((key) => !process.env[key]?.trim());
  const hasServerKey = Boolean(
    process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
  if (!hasServerKey) missing.push("SUPABASE_SECRET_KEY");

  const configured = [
    ...baseRequiredEnv.filter((key) => Boolean(process.env[key]?.trim())),
    ...(hasServerKey ? [process.env.SUPABASE_SECRET_KEY?.trim() ? "SUPABASE_SECRET_KEY" : "SUPABASE_SERVICE_ROLE_KEY"] : []),
  ];

  return { ok: missing.length === 0, missing, configured };
}

export function assertServerEnv() {
  const status = getEnvStatus();
  if (!status.ok) {
    throw new Error(`Missing required environment variables: ${status.missing.join(", ")}`);
  }
  return status;
}
