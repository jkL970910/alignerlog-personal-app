import {
  differenceInMinutes,
  isAfter,
  isBefore
} from "date-fns";

const defaultTimeZone = "UTC";

export function normalizeTimeZone(timeZone?: string | null) {
  if (!timeZone) {
    return defaultTimeZone;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());

    return timeZone;
  } catch {
    return defaultTimeZone;
  }
}

export function toDateKey(date: Date, timeZone = defaultTimeZone) {
  const parts = getZonedParts(date, normalizeTimeZone(timeZone));

  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0")
  ].join("-");
}

export function parseDateKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export function todayKey(now = new Date(), timeZone = defaultTimeZone) {
  return toDateKey(now, timeZone);
}

export function dateKeysBetween(start: Date, end: Date) {
  return dateKeysBetweenKeys(toDateKey(start), toDateKey(end));
}

export function dateKeysBetweenKeys(startDate: string, endDate: string) {
  const dates: string[] = [];
  let cursor = startDate;

  while (cursor <= endDate) {
    dates.push(cursor);
    cursor = addDaysToDateKey(cursor, 1);
  }

  return dates;
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));

  return [
    String(date.getUTCFullYear()).padStart(4, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join("-");
}

export function dayBounds(dateKey: string, timeZone = defaultTimeZone) {
  const normalizedTimeZone = normalizeTimeZone(timeZone);
  const start = zonedDateTimeToUtc(dateKey, 0, 0, 0, normalizedTimeZone);
  const endDate = addDaysToDateKey(dateKey, 1);
  const end = zonedDateTimeToUtc(endDate, 0, 0, 0, normalizedTimeZone);

  return {
    start,
    end
  };
}

export function minutesInDay(dateKey: string, timeZone = defaultTimeZone) {
  const { start, end } = dayBounds(dateKey, timeZone);
  return differenceInMinutes(end, start);
}

export function elapsedMinutesInDay(dateKey: string, now = new Date(), timeZone = defaultTimeZone) {
  const { start, end } = dayBounds(dateKey, timeZone);

  if (isBefore(now, start)) {
    return 0;
  }

  if (isAfter(now, end) || now.getTime() === end.getTime()) {
    return differenceInMinutes(end, start);
  }

  return Math.max(0, differenceInMinutes(now, start));
}

function getZonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  const values = Object.fromEntries(formatter.formatToParts(date)
    .filter((part) => part.type !== "literal")
    .map((part) => [part.type, Number(part.value)]));

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);

  return asUtc - date.getTime();
}

export function zonedDateTimeToUtc(dateKey: string, hour: number, minute: number, second: number, timeZone: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const firstOffset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  const firstUtc = utcGuess - firstOffset;
  const secondOffset = getTimeZoneOffsetMs(new Date(firstUtc), timeZone);

  return new Date(utcGuess - secondOffset);
}

export function localDateTimeToUtc(value: string, timeZone = defaultTimeZone) {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    throw new Error("请输入有效的补记时间。");
  }

  const [, dateKey, hourText, minuteText] = match;
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error("请输入有效的补记时间。");
  }

  return zonedDateTimeToUtc(dateKey, hour, minute, 0, normalizeTimeZone(timeZone));
}
