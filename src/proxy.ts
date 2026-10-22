import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const contentSecurityPolicy = (nonce: string) =>
  [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://bxnuslxrlmqzytryxzvv.supabase.co",
    "connect-src 'self' https://bxnuslxrlmqzytryxzvv.supabase.co wss://bxnuslxrlmqzytryxzvv.supabase.co",
    "font-src 'self' data:",
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");

// Páginas que exigem sessão (grupo (app) e troca de senha). Rota nova autenticada entra aqui.
const ROTAS_AUTENTICADAS = ["abrir-nc", "causas", "equipe", "insights", "medidas", "minhas-ncs", "nc", "relatorios", "trocar-senha", "usuarios"];

function exigeSessao(pathname: string) {
  return pathname === "/" || ROTAS_AUTENTICADAS.includes(pathname.split("/")[1]);
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set("Content-Security-Policy", csp);
  requestHeaders.set("x-nonce", nonce);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    response.headers.set("Content-Security-Policy", csp);
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, cacheHeaders) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        requestHeaders.set("cookie", request.cookies.toString());
        response = NextResponse.next({ request: { headers: requestHeaders } });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(cacheHeaders ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  // Com cacheComponents a página começa a ser transmitida antes do layout checar a sessão,
  // e o redirect() dele vira navegação no cliente; quem não tem sessão sai daqui com 307.
  if (!data?.claims && exigeSessao(request.nextUrl.pathname)) {
    const redirect = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    redirect.headers.set("Content-Security-Policy", csp);
    return redirect;
  }
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
