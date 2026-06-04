export function getClientTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function getClientDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: getClientTimeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts
    .filter((part) => part.type !== "literal")
    .map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

export function timeZoneHeaders(extra?: HeadersInit): HeadersInit {
  return {
    ...extra,
    "X-Loo-Time-Zone": getClientTimeZone()
  };
}
