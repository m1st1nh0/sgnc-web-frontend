export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ detail: error.message }, { status: error.status });
  }

  console.error("[api] unhandled error", {
    type: error instanceof Error ? error.name : "UnknownError",
  });
  return Response.json({ detail: "Erro interno do servidor." }, { status: 500 });
}
