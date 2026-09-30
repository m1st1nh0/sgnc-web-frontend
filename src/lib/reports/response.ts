export function downloadResponse(bytes: Uint8Array, filename: string, contentType: string) {
  return new Response(Buffer.from(bytes), { headers: { "Content-Type": contentType, "Content-Disposition": `attachment; filename="${filename}"`, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" } });
}
