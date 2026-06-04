export function getClientTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function timeZoneHeaders(extra?: HeadersInit): HeadersInit {
  return {
    ...extra,
    "X-Loo-Time-Zone": getClientTimeZone()
  };
}
