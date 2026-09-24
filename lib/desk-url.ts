export function deskUrl(request?: Request): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (request) {
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    if (host) {
      const proto = request.headers.get("x-forwarded-proto") || "http";
      return `${proto}://${host}`;
    }
  }
  return `http://127.0.0.1:${process.env.PORT || "3000"}`;
}
