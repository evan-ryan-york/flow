import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export function createSupabaseClient(req: Request, useServiceRole = false) {
  const authHeader = req.headers.get("Authorization");

  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    useServiceRole
      ? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      : Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    useServiceRole
      ? {}
      : {
          global: {
            headers: { Authorization: authHeader! },
          },
        }
  );
}

export function isServiceRoleRequest(req: Request): boolean {
  const authHeader = req.headers.get("Authorization");
  return authHeader?.includes(
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  ) ?? false;
}
