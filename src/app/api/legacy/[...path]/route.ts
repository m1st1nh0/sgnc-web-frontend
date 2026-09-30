type RouteContext = { params: Promise<{ path: string[] }> };

async function routeNotFound(_request: Request, context: RouteContext) {
  const { path } = await context.params;
  console.warn("[api] unknown route", { resource: path[0] ?? "unknown" });
  return Response.json({ detail: "Rota não encontrada." }, { status: 404 });
}

export const GET = routeNotFound;
export const POST = routeNotFound;
export const PUT = routeNotFound;
export const PATCH = routeNotFound;
export const DELETE = routeNotFound;
