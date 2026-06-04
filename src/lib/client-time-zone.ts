const timeZoneStorageKey = "loo-dental-time-zone";

export function getClientTimeZone() {
  if (typeof window !== "undefined") {
    const saved = window.localStorage.getItem(timeZoneStorageKey);

    if (saved && isValidTimeZone(saved)) {
      return saved;
    }
  }

  return getDetectedTimeZone();
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

export function getDetectedTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function setClientTimeZone(timeZone: string) {
  if (!isValidTimeZone(timeZone)) {
    return getClientTimeZone();
  }

  window.localStorage.setItem(timeZoneStorageKey, timeZone);

  return timeZone;
}

export function resetClientTimeZone() {
  window.localStorage.removeItem(timeZoneStorageKey);

  return getDetectedTimeZone();
}

export function isTimeZoneManuallySet() {
  if (typeof window === "undefined") {
    return false;
  }

  return Boolean(window.localStorage.getItem(timeZoneStorageKey));
}

export function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());

    return true;
  } catch {
    return false;
  }
}
