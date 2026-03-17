export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-key",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

const jsonHeaders = { "Content-Type": "application/json", ...corsHeaders };

export function ok(data: unknown, meta?: unknown): Response {
  const body: Record<string, unknown> = { data };
  if (meta !== undefined) body.meta = meta;
  return new Response(JSON.stringify(body), { status: 200, headers: jsonHeaders });
}

export function created(data: unknown): Response {
  return new Response(JSON.stringify({ data }), { status: 201, headers: jsonHeaders });
}

export function noContent(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}
