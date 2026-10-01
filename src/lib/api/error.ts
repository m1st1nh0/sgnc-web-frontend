import { randomUUID } from "node:crypto";

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
    if (error.status >= 500) {
      const requestId = randomUUID();
      console.error("[api] handled server error", { request_id: requestId, type: error.name });
      return Response.json(
        { detail: "Serviço temporariamente indisponível.", request_id: requestId },
        { status: error.status },
      );
    }
    return Response.json({ detail: error.message }, { status: error.status });
  }

  const requestId = randomUUID();
  console.error("[api] unhandled error", {
    request_id: requestId,
    type: error instanceof Error ? error.name : "UnknownError",
  });
  return Response.json(
    { detail: "Serviço temporariamente indisponível.", request_id: requestId },
    { status: 500 },
  );
}
