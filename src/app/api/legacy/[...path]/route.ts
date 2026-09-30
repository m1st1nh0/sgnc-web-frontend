import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ path: string[] }> };

async function proxyToFastApi(request: Request, context: RouteContext) {
  const { path } = await context.params;
  const method = request.method.toUpperCase();
  // Keep logs useful for diagnosing upstream failures without recording IDs,
  // query values, request bodies, or authentication tokens.
  const resource = path[0] ?? "unknown";

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    console.warn("[legacy-proxy] rejected request without a valid session", { method, resource });
    return Response.json(
      { detail: "Sessão inválida ou expirada. Faça login novamente." },
      { status: 401 },
    );
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    console.warn("[legacy-proxy] session has no access token", { method, resource });
    return Response.json(
      { detail: "Sessão inválida ou expirada. Faça login novamente." },
      { status: 401 },
    );
  }

  const upstreamBase = (process.env.LEGACY_API_URL ?? "https://sgnc-web-api.onrender.com").replace(/\/$/, "");
  const incoming = new URL(request.url);
  const target = `${upstreamBase}/${path.map(encodeURIComponent).join("/")}${incoming.search}`;
  const headers = new Headers();
  for (const name of ["accept", "content-type", "accept-language"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("authorization", `Bearer ${accessToken}`);

  const hasBody = !["GET", "HEAD"].includes(method);
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: "no-store",
    });
  } catch (error) {
    console.error("[legacy-proxy] upstream request failed", {
      method,
      resource,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ detail: "Não foi possível conectar ao servidor do SGNC." }, { status: 502 });
  }

  console.info("[legacy-proxy] upstream response", {
    method,
    resource,
    status: upstream.status,
  });

  const responseHeaders = new Headers();
  for (const name of ["content-type", "content-disposition", "cache-control"]) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  responseHeaders.set("cache-control", "private, no-store");
  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const GET = proxyToFastApi;
export const POST = proxyToFastApi;
export const PUT = proxyToFastApi;
export const PATCH = proxyToFastApi;
export const DELETE = proxyToFastApi;
