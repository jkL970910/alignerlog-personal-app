import { normalizeTimeZone } from "@/lib/dates";

export function getRequestTimeZone(request: Request) {
  const url = new URL(request.url);

  return normalizeTimeZone(
    request.headers.get("x-loo-time-zone")
      ?? url.searchParams.get("timeZone")
      ?? "UTC"
  );
}
