import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = (
  Deno.env.get("ALLOWED_ORIGINS") ||
  "http://localhost:5173,http://127.0.0.1:5173,https://purolampros.github.io"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export function corsHeaders(origin: string | null) {
  const headers = new Headers({
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  });
  if (origin && allowedOrigins.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return headers;
}

export function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  origin: string | null,
) {
  const headers = corsHeaders(origin);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { status, headers });
}

export function isAllowedOrigin(origin: string | null) {
  return !origin || allowedOrigins.includes(origin);
}

export function getServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase service configuration is missing.");
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function getAuthenticatedUser(request: Request) {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = request.headers.get("Authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");
  if (!url || !anonKey || !token) return null;

  const userClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await userClient.auth.getUser(token);
  if (error) {
    console.error("Could not verify checkout user:", error.message);
    return null;
  }
  return data.user;
}

export function isMissingProductTable(error: { code?: string; message?: string }) {
  const message = String(error.message || "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    message.includes("does not exist") ||
    message.includes("not found") ||
    message.includes("schema cache")
  );
}
